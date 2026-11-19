// Creates the tables and the starting menu by running db/schema.sql.
// Run with: npm run db:init   (no psql install needed, it uses the same pg driver as the API)
import 'dotenv/config'; // load .env first
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../src/config/db.js';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../database/schema.sql');
try {
  await pool.query(fs.readFileSync(file, 'utf8'));
  console.log('Database ready: tables and starting menu are in place.');
} catch (err) {
  console.error('Could not run schema.sql:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
