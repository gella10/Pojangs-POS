// /api/orders/*
import { Router } from 'express';
import { orderController } from '../controllers/orderController.js';
import { requireAuth } from '../middleware/auth.js';

export default function orderRoutes(db) {
  const router = Router();
  const c = orderController(db);

  router.post('/orders', requireAuth(), c.create);              // owner or staff can take an order
  router.get('/orders', requireAuth('owner'), c.list);          // owner only: view a day's orders
  router.patch('/orders/:id', requireAuth('owner'), c.correct); // owner only: correct a total
  router.put('/orders/:id', requireAuth('owner'), c.correct);   // same handler, for clients that use PUT
  return router;
}
