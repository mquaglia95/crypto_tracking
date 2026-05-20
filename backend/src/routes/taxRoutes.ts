import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import pool from '../config/database';
import { ingestCoinbaseCSV } from '../services/parser';

const router = Router();
const upload = multer({ dest: path.join(__dirname, '../../uploads/') });

// POST /api/upload
// Accepts a Coinbase CSV, parses it, runs the HIFO engine, returns ingestion summary.
router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const summary = await ingestCoinbaseCSV(req.file.path);
    res.json({ success: true, summary });
  } catch (err) {
    console.error('Ingestion error:', err);
    res.status(500).json({ error: (err as Error).message });
  } finally {
    // Clean up the uploaded temp file
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
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
