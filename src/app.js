// Builds the Express app. It takes `db` (the real pool, or a fake one in tests) and does NOT start listening.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import buildRoutes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp(db) {
  const app = express();

  app.set('trust proxy', 1); // on Render the real client IP is in a proxy header (needed for rate limiting)
  app.use(helmet());         // safe default security headers
  app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : '*',
  }));
  app.use(express.json());   // read JSON request bodies

  app.use('/api', buildRoutes(db)); // every endpoint lives under /api
  app.use(notFound);                // unknown URL -> 404 JSON
  app.use(errorHandler);            // any error -> clean JSON
  return app;
}
