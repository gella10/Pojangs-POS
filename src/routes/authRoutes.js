// /api/auth/*  (public: no token needed)
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/authController.js';

export default function authRoutes(db) {
  const router = Router();
  const c = authController(db);

  // Slow down password guessing from one IP (skipped while running tests)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: { error: 'Too many attempts. Try again later.' },
  });

  router.post('/auth/login', limiter, c.login);
  router.post('/auth/register', limiter, c.register);
  return router;
}
