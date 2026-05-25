import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import pool from '../config/database';
import { ingestCoinbaseCSV } from '../services/parser';
import { syncFromCoinbase } from '../services/coinbaseApiService';

const router = Router();
const upload = multer({ dest: path.join(__dirname, '../../uploads/') });

// POST /api/upload
// Accepts one or more Coinbase CSVs. Existing transactions are skipped (deduped
// by transaction_id), so overlapping date ranges across files are safe. HIFO
// runs once after all files are ingested.
router.post('/upload', upload.array('files', 20), async (req: Request, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  const perFile: { name: string; lots: number; sales: number; income: number; unmatched: number; skipped: number }[] = [];
  const totals = { lots: 0, sales: 0, income: 0, unmatched: 0, skipped: 0 };

  try {
    for (const file of files) {
      const summary = await ingestCoinbaseCSV(file.path);
      perFile.push({ name: file.originalname, ...summary });
      totals.lots      += summary.lots;
      totals.sales     += summary.sales;
      totals.income    += summary.income;
      totals.unmatched += summary.unmatched;
      totals.skipped   += summary.skipped;
    }

    // Run HIFO once across all accumulated data
    console.log('[HIFO] Running matching engine after all uploads...');
    const client = await pool.connect();
    try {
      await client.query('SELECT run_hifo_matching_engine()');
      const { rows } = await client.query('SELECT COUNT(*) AS count FROM matched_trades');
      console.log(`[HIFO] Matched trades: ${rows[0].count}`);
    } finally {
      client.release();
    }

    res.json({ success: true, totals, files: perFile });
  } catch (err) {
    console.error('Ingestion error:', err);
    res.status(500).json({ error: (err as Error).message });
  } finally {
    for (const file of files) {
      fs.unlink(file.path, () => {});
    }
  }
});

// POST /api/sync
// Pulls transaction history directly from the Coinbase API using the provided
// API key and secret. Credentials are used only in memory and never stored.
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  const { apiKey, apiSecret } = req.body as { apiKey?: string; apiSecret?: string };

  if (!apiKey || !apiSecret) {
    res.status(400).json({ error: 'apiKey and apiSecret are required' });
    return;
  }

  try {
    const summary = await syncFromCoinbase(apiKey, apiSecret);
    res.json({ success: true, summary });
  } catch (err) {
    console.error('Coinbase sync error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/report
// Returns Form 8949-structured matched trade data.
router.get('/report', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query('SELECT * FROM irs_form_8949_export');
    res.json(rows);
  } catch (err) {
    console.error('Report query error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/summary
// Returns aggregate stats for dashboard cards.
router.get('/summary', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [summaryResult, incomeResult] = await Promise.all([
      pool.query('SELECT * FROM tax_summary'),
      pool.query('SELECT COALESCE(SUM(value_usd), 0) AS total_income FROM income_events'),
    ]);

    res.json({
      ...summaryResult.rows[0],
      total_staking_income: incomeResult.rows[0].total_income,
    });
  } catch (err) {
    console.error('Summary query error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/lots
// Returns open (unrealized) tax lots.
router.get('/lots', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query('SELECT * FROM open_tax_lots');
    res.json(rows);
  } catch (err) {
    console.error('Lots query error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/income
// Returns staking and other income events.
router.get('/income', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM income_events ORDER BY event_timestamp DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Income query error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/portfolio-events
// Returns all buy and sell events in chronological order so the frontend can
// reconstruct the quantity held for each asset at any point in time.
router.get('/portfolio-events', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT asset_symbol, buy_timestamp AS timestamp, initial_qty AS qty, 'buy' AS event_type
      FROM tax_lots
      UNION ALL
      SELECT asset_symbol, sell_timestamp AS timestamp, qty, 'sell' AS event_type
      FROM crypto_sales
      ORDER BY timestamp ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Portfolio events error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/unmatched
// Returns transactions flagged for manual review.
router.get('/unmatched', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM unmatched_transactions ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Unmatched query error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
