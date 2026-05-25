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

// Advanced Trade API uses cursor-based pagination.
// accounts endpoint: has_next + cursor
// fills endpoint: non-empty cursor string means more pages
async function paginateAccounts(keyName: string, pem: string): Promise<any[]> {
  const all: any[] = [];
  let cursor = '';

  do {
    const path = cursor
      ? `/api/v3/brokerage/accounts?limit=250&cursor=${encodeURIComponent(cursor)}`
      : '/api/v3/brokerage/accounts?limit=250';
    const data = await apiGet(keyName, pem, path);
    all.push(...(data.accounts ?? []));
    cursor = data.has_next ? (data.cursor ?? '') : '';
  } while (cursor);

  return all;
}

async function paginateFills(keyName: string, pem: string): Promise<any[]> {
  const all: any[] = [];
  let cursor = '';

  do {
    const path = cursor
      ? `/api/v3/brokerage/orders/historical/fills?limit=250&cursor=${encodeURIComponent(cursor)}`
      : '/api/v3/brokerage/orders/historical/fills?limit=250';
    const data = await apiGet(keyName, pem, path);
    all.push(...(data.fills ?? []));
    // Empty string cursor means no more pages
    cursor = data.cursor ?? '';
  } while (cursor);

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
  // Verify credentials work by fetching accounts (also used for accounts_scanned count)
  const accounts = await paginateAccounts(apiKey, apiSecret);

  // Fetch all filled orders (buys & sells) via Advanced Trade API.
  // Note: staking income is not available through this API — use CSV upload for that.
  const fills = await paginateFills(apiKey, apiSecret);

  // Sort chronologically so HIFO engine processes lots before their matched sales
  fills.sort((a, b) => new Date(a.trade_time).getTime() - new Date(b.trade_time).getTime());

  const client = await pool.connect();
  let lots = 0;
  let sales = 0;
  const income = 0;
  let skipped = 0;

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM unmatched_transactions');
    await client.query('DELETE FROM income_events');
    await client.query('DELETE FROM crypto_sales');
    await client.query('DELETE FROM tax_lots');

    for (const fill of fills) {
      // product_id is "BTC-USD" or "ETH-USDC" — base asset is before the dash
      const productId: string = fill.product_id ?? '';
      const asset = productId.split('-')[0];
      if (!asset) { skipped++; continue; }

      const qty       = parseFloat(fill.size ?? '0');
      const quoteAmt  = parseFloat(fill.size_in_quote ?? '0');   // total before fees
      const commission = parseFloat(fill.commission ?? '0');
      const timestamp  = new Date(fill.trade_time);
      const fillId     = fill.fill_id;

      if (!fillId || qty <= 0) { skipped++; continue; }

      if (fill.side === 'BUY') {
        const totalCost    = quoteAmt + commission;
        const pricePerUnit = qty > 0 ? totalCost / qty : 0;

        const r = await client.query(
          `INSERT INTO tax_lots
             (transaction_id, asset_symbol, buy_timestamp, initial_qty, remaining_qty, price_per_unit, total_cost_usd)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (transaction_id) DO NOTHING`,
          [fillId, asset, timestamp, qty, qty, pricePerUnit, totalCost]
        );
        r.rowCount ? lots++ : skipped++;

      } else if (fill.side === 'SELL') {
        const proceeds     = quoteAmt - commission;
        const pricePerUnit = qty > 0 ? proceeds / qty : 0;

        const r = await client.query(
          `INSERT INTO crypto_sales
             (transaction_id, asset_symbol, sell_timestamp, qty, price_per_unit, total_proceeds_usd)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (transaction_id) DO NOTHING`,
          [fillId, asset, timestamp, qty, pricePerUnit, proceeds]
        );
        r.rowCount ? sales++ : skipped++;

      } else {
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
