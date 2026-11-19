// /api/menu/* and /api/combos/*
import { Router } from 'express';
import { menuController } from '../controllers/menuController.js';
import { requireAuth } from '../middleware/auth.js';

export default function menuRoutes(db) {
  const router = Router();
  const c = menuController(db);

  // Any signed-in user can read the menu (staff need it to take orders)
  router.get('/menu', requireAuth(), c.getMenu);
  router.get('/menu/:id', requireAuth(), c.getItem);

  // Only the owner can change it
  router.post('/menu', requireAuth('owner'), c.create);
  router.put('/menu/:id', requireAuth('owner'), c.update);
  router.put('/menu/:id/price', requireAuth('owner'), c.setPrice);
  router.patch('/menu/:id/availability', requireAuth('owner'), c.setAvailability);
  router.put('/combos/:code', requireAuth('owner'), c.setComboPrice);
  router.delete('/menu/:id', requireAuth('owner'), c.remove);
  return router;
}
