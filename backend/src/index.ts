import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/database';
import taxRoutes from './routes/taxRoutes';

dotenv.config();

// Add UNIQUE constraints on transaction_id so multi-CSV uploads safely skip
// duplicates via ON CONFLICT DO NOTHING. Idempotent — safe to re-run.
async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'tax_lots_txid_key' AND conrelid = 'tax_lots'::regclass
        ) THEN
          ALTER TABLE tax_lots ADD CONSTRAINT tax_lots_txid_key UNIQUE (transaction_id);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'crypto_sales_txid_key' AND conrelid = 'crypto_sales'::regclass
        ) THEN
          ALTER TABLE crypto_sales ADD CONSTRAINT crypto_sales_txid_key UNIQUE (transaction_id);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'income_events_txid_key' AND conrelid = 'income_events'::regclass
        ) THEN
          ALTER TABLE income_events ADD CONSTRAINT income_events_txid_key UNIQUE (transaction_id);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'unmatched_txid_key' AND conrelid = 'unmatched_transactions'::regclass
        ) THEN
          ALTER TABLE unmatched_transactions ADD CONSTRAINT unmatched_txid_key UNIQUE (transaction_id);
        END IF;
      END $$;
    `);
    console.log('[DB] Migrations complete');
  } catch (err) {
    console.error('[DB] Migration error (non-fatal):', err);
  } finally {
    client.release();
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', taxRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
  });
});
