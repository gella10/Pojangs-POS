// Entry point: `npm run dev` or `npm start`.
import 'dotenv/config'; // MUST be first so .env is loaded before anything reads process.env
import crypto from 'node:crypto';
import pool from './config/db.js';
import { createApp } from './app.js';
import { hashPw } from './utils/helpers.js';

/** Create or refresh the owner (and staff) account from .env. The .env password is the source of truth. */
async function seedUsers() {
  const accounts = [
    ['owner', process.env.OWNER_USER, process.env.OWNER_PASSWORD, true],
    ['staff', process.env.STAFF_USER, process.env.STAFF_PASSWORD, false], // staff account is optional
  ];
  for (const [role, username, password, required] of accounts) {
    if (!username || !password) {
      if (required) throw new Error(`${role} credentials are missing in .env`);
      continue;
    }
    if (password.length < 8) throw new Error(`${role} password must be at least 8 characters`);
    const salt = crypto.randomBytes(8).toString('hex');
    await pool.query(
      `INSERT INTO users (username, salt, hash, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET salt = $2, hash = $3`,
      [username, salt, hashPw(password, salt), role]);
  }
}

try {
  await seedUsers();
  const port = process.env.PORT || 4000;
  createApp(pool).listen(port, () => console.log(`API ready on port ${port}`));
} catch (err) {
  console.error('Startup failed:', err.message);
  process.exit(1);
}
