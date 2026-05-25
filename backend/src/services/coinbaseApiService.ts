import crypto from 'crypto';
import pool from '../config/database';

const COINBASE_BASE = 'https://api.coinbase.com';

// Builds a CDP JWT for the Coinbase Advanced Trade / v2 API.
// keyName:       organizations/{org_id}/apiKeys/{key_id}
// privateKeyPem: EC private key PEM — escaped \n sequences are normalized automatically.
function makeJWT(keyName: string, privateKeyPem: string, method: string, path: string): string {
  const uri = `${method.toUpperCase()} api.coinbase.com${path}`;
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({
    alg: 'ES256',
    kid: keyName,
    nonce: crypto.randomBytes(16).toString('hex'),
  })).toString('base64url');

  const payload = Buffer.from(JSON.stringify({
    sub: keyName,
    iss: 'cdp',
    nbf: now,
    exp: now + 120,
    uri,
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;

  // Env vars often store newlines as the literal two-char sequence \n — fix that.
  const pem = privateKeyPem.replace(/\\n/g, '\n');

  const signature = crypto.sign('SHA256', Buffer.from(signingInput), {
    key: pem,
    dsaEncoding: 'ieee-p1363', // raw r||s required by JWT ES256
  });

  return `${signingInput}.${signature.toString('base64url')}`;
}

async function apiGet(keyName: string, privateKeyPem: string, path: string): Promise<any> {
  const jwt = makeJWT(keyName, privateKeyPem, 'GET', path);
  const res = await fetch(`${COINBASE_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Coinbase API ${res.status}: ${body}`);
  }

  return res.json();
}

async function paginate(key: string, secret: string, startPath: string): Promise<any[]> {
  const all: any[] = [];
  let path: string | null = startPath;

  while (path) {
    const { data, pagination } = await apiGet(key, secret, path);
    all.push(...(data ?? []));
    path = pagination?.next_uri ?? null;
  }

  return all;
}

export interface SyncSummary {
  lots: number;
  sales: number;
  income: number;
  skipped: number;
  accounts_scanned: number;
}

export async function syncFromCoinbase(apiKey: string, apiSecret: string): Promise<SyncSummary> {
  // Fetch all wallet accounts
  const accounts = await paginate(apiKey, apiSecret, '/v2/accounts?limit=100');

  const allTransactions: any[] = [];

  for (const account of accounts) {
    // Skip fiat (USD, EUR, etc.) — only crypto accounts have taxable events
    if (account.type === 'fiat' || account.currency?.code === 'USD') continue;

    const txns = await paginate(
      apiKey,
      apiSecret,
      `/v2/accounts/${account.id}/transactions?limit=100&expand[]=buy&expand[]=sell`
    );
    allTransactions.push(...txns);
  }

  // Sort chronologically before inserting so the HIFO engine processes them in order
  allTransactions.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const client = await pool.connect();
  let lots = 0;
  let sales = 0;
  let income = 0;
  let skipped = 0;

  try {
    await client.query('BEGIN');

    // Wipe existing data and rebuild from scratch on every sync
    await client.query('DELETE FROM unmatched_transactions');
    await client.query('DELETE FROM income_events');
    await client.query('DELETE FROM crypto_sales');
    await client.query('DELETE FROM tax_lots');

    for (const tx of allTransactions) {
      // Only process completed transactions
      if (tx.status !== 'completed') {
        skipped++;
        continue;
      }

      const asset: string = tx.amount?.currency;
      if (!asset || asset === 'USD') {
        skipped++;
        continue;
      }

      const qty = parseFloat(tx.amount?.amount ?? '0');
      const nativeAmt = parseFloat(tx.native_amount?.amount ?? '0');
      const timestamp = new Date(tx.created_at);

      switch (tx.type) {
        case 'buy': {
          if (qty <= 0) { skipped++; break; }

          // Prefer the expanded buy.total (exact amount paid including fees).
          // Fall back to |native_amount| which Coinbase also populates with total cost.
          const totalCost = tx.buy?.total?.amount
            ? parseFloat(tx.buy.total.amount)
            : Math.abs(nativeAmt);
          const pricePerUnit = qty > 0 ? totalCost / qty : 0;

          await client.query(
            `INSERT INTO tax_lots
               (transaction_id, asset_symbol, buy_timestamp, initial_qty, remaining_qty, price_per_unit, total_cost_usd)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [tx.id, asset, timestamp, qty, qty, pricePerUnit, totalCost]
          );
          lots++;
          break;
        }

        case 'sell': {
          const absQty = Math.abs(qty);
          if (absQty <= 0) { skipped++; break; }

          // Prefer expanded sell.total (net proceeds after fees).
          const proceeds = tx.sell?.total?.amount
            ? parseFloat(tx.sell.total.amount)
            : Math.abs(nativeAmt);
          const pricePerUnit = absQty > 0 ? proceeds / absQty : 0;

          await client.query(
            `INSERT INTO crypto_sales
               (transaction_id, asset_symbol, sell_timestamp, qty, price_per_unit, total_proceeds_usd)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [tx.id, asset, timestamp, absQty, pricePerUnit, proceeds]
          );
          sales++;
          break;
        }

        case 'staking_reward':
        case 'interest':
        case 'rewards_income': {
          if (qty <= 0 || nativeAmt <= 0) { skipped++; break; }

          await client.query(
            `INSERT INTO income_events
               (transaction_id, asset_symbol, event_timestamp, qty, value_usd, income_type)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [tx.id, asset, timestamp, qty, nativeAmt, tx.type]
          );
          income++;
          break;
        }

        // Non-taxable wallet movements
        case 'send':
        case 'receive':
        case 'pro_withdrawal':
        case 'pro_deposit':
        case 'exchange_withdrawal':
        case 'exchange_deposit':
        case 'transfer':
          skipped++;
          break;

        default:
          // Log anything unrecognized for manual review
          await client.query(
            `INSERT INTO unmatched_transactions
               (transaction_id, raw_timestamp, transaction_type, asset, quantity, notes, reason)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              tx.id,
              tx.created_at,
              tx.type,
              asset,
              qty.toString(),
              tx.description ?? null,
              `Unknown Coinbase API transaction type: ${tx.type}`,
            ]
          );
          skipped++;
      }
    }

    await client.query('SELECT run_hifo_matching_engine()');
    await client.query('COMMIT');

    return { lots, sales, income, skipped, accounts_scanned: accounts.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
