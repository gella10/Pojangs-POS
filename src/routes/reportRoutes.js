// /api/sales/*, /api/cash-counts, /api/reconciliation  (all owner-only)
import { Router } from 'express';
import { reportController } from '../controllers/reportController.js';
import { requireAuth } from '../middleware/auth.js';

export default function reportRoutes(db) {
  const router = Router();
  const c = reportController(db);
  const owner = requireAuth('owner');

  router.get('/sales/daily', owner, c.daily);
  router.get('/sales/history', owner, c.history);
  router.post('/cash-counts', owner, c.saveCash);
  router.get('/reconciliation', owner, c.reconciliation);
  return router;
}
