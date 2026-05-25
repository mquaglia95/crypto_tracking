import fs from 'fs';
import csvParser from 'csv-parser';
import pool from '../config/database';

// Coinbase CSV column headers (the actual transaction data row headers)
interface CoinbaseRow {
  ID: string;
  Timestamp: string;
  'Transaction Type': string;
  Asset: string;
  'Quantity Transacted': string;
  'Price Currency': string;
  'Price at Transaction': string;
  Subtotal: string;
  'Total (inclusive of fees and/or spread)': string;
  'Fees and/or Spread': string;
  Notes: string;
  'Sender Address': string;
  'Recipient Address': string;
}

function parseCurrency(value: string): number {
  if (!value || value.trim() === '' || value.trim() === '--') return 0;
  const cleaned = value.replace(/[$,\s]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseQty(value: string): number {
  if (!value || value.trim() === '') return 0;
  return parseFloat(value.replace(/,/g, '')) || 0;
}

function parseTimestamp(value: string): Date {
  // "2026-05-20 14:36:46 UTC" → valid Date
  return new Date(value.replace(' UTC', 'Z').replace(' ', 'T'));
}

export async function ingestCoinbaseCSV(filePath: string): Promise<{
  lots: number;
  sales: number;
  income: number;
  unmatched: number;
}> {
  const rows: CoinbaseRow[] = [];
  let rawLineCount = 0;

  // Peek at first 5 lines so we can log the detected structure
  const firstLines = await new Promise<string[]>((resolve, reject) => {
    const lines: string[] = [];
    fs.createReadStream(filePath)
      .on('data', (chunk: Buffer) => {
        chunk.toString().split('\n').forEach(l => lines.push(l));
      })
      .on('end', () => resolve(lines.slice(0, 5)))
      .on('error', reject);
  });
  console.log('[CSV] First 5 raw lines:', firstLines);

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(
        csvParser({
          // Coinbase CSVs have 3 metadata rows before the real header:
          //   line 1: blank
          //   line 2: "Transactions,,,..."
          //   line 3: "User,<name>,<id>,..."
          //   line 4: "ID,Timestamp,Transaction Type,..." ← real headers
          skipLines: 3,
          mapHeaders: ({ header }) => header.trim(),
          mapValues: ({ value }) => value.trim(),
        })
      )
      .on('headers', (headers: string[]) => {
        console.log('[CSV] Detected headers:', headers);
      })
      .on('data', (row: Record<string, string>) => {
        rawLineCount++;
        if (!row['ID']) {
          console.log(`[CSV] Skipping row ${rawLineCount} — no ID field. Keys: ${Object.keys(row).slice(0, 4).join(', ')}`);
          return;
        }
        rows.push(row as unknown as CoinbaseRow);
      })
      .on('end', () => {
        console.log(`[CSV] Total raw data rows seen: ${rawLineCount}, rows kept: ${rows.length}`);
        resolve();
      })
      .on('error', reject);
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clear existing data before re-ingestion
    await client.query('DELETE FROM unmatched_transactions');
    await client.query('DELETE FROM income_events');
    await client.query('DELETE FROM crypto_sales');
    await client.query('DELETE FROM tax_lots');

    let lotsInserted = 0;
    let salesInserted = 0;
    let incomeInserted = 0;
    let unmatchedInserted = 0;

    // Log a frequency table of transaction types before processing
    const typeCounts: Record<string, number> = {};
    for (const row of rows) {
      const t = row['Transaction Type'] || '(empty)';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    console.log('[CSV] Transaction type breakdown:', typeCounts);

    for (const row of rows) {
      const txType = (row['Transaction Type'] || '').trim();
      const asset = (row['Asset'] || '').trim();
      const qty = parseQty(row['Quantity Transacted']);
      const total = parseCurrency(row['Total (inclusive of fees and/or spread)']);
      const priceAtTx = parseCurrency(row['Price at Transaction']);
      const timestamp = parseTimestamp(row['Timestamp']);
      const txId = (row['ID'] || '').trim();

      // --- Staking Income / Rewards ---
      if (txType === 'Staking Income' || txType === 'Learning Reward' || txType === 'Rewards Income') {
        if (asset && qty > 0 && total > 0) {
          await client.query(
            `INSERT INTO income_events (transaction_id, asset_symbol, event_timestamp, qty, value_usd, income_type)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [txId, asset, timestamp, qty, total, txType]
          );
          incomeInserted++;
        }
        continue;
      }

      // --- Convert: sell source asset, buy destination asset ---
      // Notes field: "Converted 26.14 USDC to 0.0409805 ZEC"
      if (txType === 'Convert') {
        if (!asset) {
          await insertUnmatched(client, row, 'Convert with no asset');
          unmatchedInserted++;
          continue;
        }

        if (qty < 0) {
          // Selling the source asset
          const absQty = Math.abs(qty);
          const absTotal = Math.abs(total);
          const salePrice = absQty > 0 ? absTotal / absQty : priceAtTx;

          await client.query(
            `INSERT INTO crypto_sales (transaction_id, asset_symbol, sell_timestamp, qty, price_per_unit, total_proceeds_usd)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [txId, asset, timestamp, absQty, salePrice, absTotal]
          );
          salesInserted++;
        } else if (qty > 0) {
          // Receiving the destination asset — parse from Notes if possible
          const destAsset = parseConvertDestAsset(row['Notes'], asset);
          const destQty = parseConvertDestQty(row['Notes']) ?? qty;
          const costUsd = Math.abs(total);
          const costPerUnit = destQty > 0 ? costUsd / destQty : priceAtTx;

          if (destAsset) {
            await client.query(
              `INSERT INTO tax_lots (transaction_id, asset_symbol, buy_timestamp, initial_qty, remaining_qty, price_per_unit, total_cost_usd)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [txId, destAsset, timestamp, destQty, destQty, costPerUnit, costUsd]
            );
            lotsInserted++;
          } else {
            await insertUnmatched(client, row, 'Convert: could not determine destination asset');
            unmatchedInserted++;
          }
        }
        continue;
      }

      // --- Dex Buy ---
      if (txType === 'Dex Buy' || txType === 'Buy') {
        if (!asset) {
          // Unnamed token — log for manual review
          await insertUnmatched(client, row, 'Asset name missing');
          unmatchedInserted++;
          continue;
        }

        if (qty > 0 && asset !== 'USDC' && asset !== 'USDT') {
          // Receiving a token: create a tax lot
          const costUsd = Math.abs(total);
          const costPerUnit = qty > 0 ? costUsd / qty : priceAtTx;

          await client.query(
            `INSERT INTO tax_lots (transaction_id, asset_symbol, buy_timestamp, initial_qty, remaining_qty, price_per_unit, total_cost_usd)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [txId, asset, timestamp, qty, qty, costPerUnit, costUsd]
          );
          lotsInserted++;
        } else if (qty < 0 && (asset === 'USDC' || asset === 'USDT')) {
          // Spending USDC/USDT to buy another token.
          // USDC ≈ $1 so the gain/loss is minimal, but technically taxable.
          // We record a sale of USDC at $1/unit.
          const absQty = Math.abs(qty);
          await client.query(
            `INSERT INTO crypto_sales (transaction_id, asset_symbol, sell_timestamp, qty, price_per_unit, total_proceeds_usd)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [txId, asset, timestamp, absQty, 1.0, absQty]
          );
          salesInserted++;
        }
        continue;
      }

      // --- Dex Sell ---
      if (txType === 'Dex Sell' || txType === 'Sell') {
        if (!asset) {
          await insertUnmatched(client, row, 'Asset name missing');
          unmatchedInserted++;
          continue;
        }

        if (qty < 0 && asset !== 'USDC' && asset !== 'USDT') {
          // Selling a token
          const absQty = Math.abs(qty);
          const proceedsUsd = Math.abs(total);
          const salePrice = absQty > 0 ? proceedsUsd / absQty : priceAtTx;

          await client.query(
            `INSERT INTO crypto_sales (transaction_id, asset_symbol, sell_timestamp, qty, price_per_unit, total_proceeds_usd)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [txId, asset, timestamp, absQty, salePrice, proceedsUsd]
          );
          salesInserted++;
        } else if (qty > 0 && (asset === 'USDC' || asset === 'USDT')) {
          // Receiving USDC/USDT — create a lot at $1/unit for completeness
          await client.query(
            `INSERT INTO tax_lots (transaction_id, asset_symbol, buy_timestamp, initial_qty, remaining_qty, price_per_unit, total_cost_usd)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [txId, asset, timestamp, qty, qty, 1.0, qty]
          );
          lotsInserted++;
        }
        continue;
      }

      // --- Receive / Send / Transfer (non-taxable) ---
      if (
        txType === 'Send' ||
        txType === 'Receive' ||
        txType === 'Transfer'
      ) {
        // Not taxable — skip
        continue;
      }

      // --- Anything else ---
      await insertUnmatched(client, row, `Unrecognized transaction type: ${txType}`);
      unmatchedInserted++;
    }

    console.log(`[CSV] Insertions — lots: ${lotsInserted}, sales: ${salesInserted}, income: ${incomeInserted}, unmatched: ${unmatchedInserted}`);

    // Run the HIFO matching engine after all data is inserted
    console.log('[HIFO] Running matching engine...');
    await client.query('SELECT run_hifo_matching_engine()');
    const { rows: matchedRows } = await client.query('SELECT COUNT(*) AS count FROM matched_trades');
    console.log(`[HIFO] Matched trades created: ${matchedRows[0].count}`);

    await client.query('COMMIT');

    return {
      lots: lotsInserted,
      sales: salesInserted,
      income: incomeInserted,
      unmatched: unmatchedInserted,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function insertUnmatched(
  client: import('pg').PoolClient,
  row: CoinbaseRow,
  reason: string
): Promise<void> {
  await client.query(
    `INSERT INTO unmatched_transactions (transaction_id, raw_timestamp, transaction_type, asset, quantity, notes, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      row['ID'] || null,
      row['Timestamp'] || null,
      row['Transaction Type'] || null,
      row['Asset'] || null,
      row['Quantity Transacted'] || null,
      row['Notes'] || null,
      reason,
    ]
  );
}

// "Converted 26.14 USDC to 0.0409805 ZEC" → "ZEC"
function parseConvertDestAsset(notes: string, sourceAsset: string): string | null {
  if (!notes) return null;
  const match = notes.match(/to\s+[\d.]+\s+([A-Z]+)/i);
  return match ? match[1].toUpperCase() : null;
}

// "Converted 26.14 USDC to 0.0409805 ZEC" → 0.0409805
function parseConvertDestQty(notes: string): number | null {
  if (!notes) return null;
  const match = notes.match(/to\s+([\d.]+)\s+[A-Z]+/i);
  return match ? parseFloat(match[1]) : null;
}
