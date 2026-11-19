// Collects every route file under one router, mounted at /api by app.js.
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import menuRoutes from './menuRoutes.js';
import orderRoutes from './orderRoutes.js';
import reportRoutes from './reportRoutes.js';

export default function buildRoutes(db) {
  const router = Router();
  router.get('/health', (_req, res) => res.json({ status: 'ok' })); // Render health check
  router.use(authRoutes(db));
  router.use(menuRoutes(db));
  router.use(orderRoutes(db));
  router.use(reportRoutes(db));
  return router;
}
