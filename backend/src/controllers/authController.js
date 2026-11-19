// Sign in and sign up. Each controller receives `db` so tests can pass a fake database.
import { MAX_FAILS, LOCK_MS, MAX_STAFF } from '../config/constants.js';
import { createSession } from '../middleware/auth.js';
import { httpError, hashPw, safeEqual } from '../utils/helpers.js';
import crypto from 'node:crypto';

// Wrong-password counter per username: { count, lockedUntil }
const fails = new Map();

export const authController = (db) => ({
  /** POST /api/auth/login  { username, password } -> { token, role, username } */
  async login(req, res) {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      throw httpError(400, 'Enter username and password');
    }

    const record = fails.get(username) ?? { count: 0, lockedUntil: 0 };
    if (record.lockedUntil > Date.now()) throw httpError(423, 'Account locked for 15 minutes');

    const { rows } = await db.query('SELECT username, salt, hash, role FROM users WHERE username = $1', [username]);
    const user = rows[0];

    if (!user || !safeEqual(hashPw(password, user.salt), user.hash)) {
      record.count += 1;
      if (record.count >= MAX_FAILS) { record.lockedUntil = Date.now() + LOCK_MS; record.count = 0; }
      fails.set(username, record);
      throw httpError(401, 'Wrong username or password');
    }

    fails.delete(username);
    res.json(createSession(user.username, user.role));
  },

  /** POST /api/auth/register  { username, password, code? } -> creates a STAFF account and signs in. */
  async register(req, res) {
    const { username, password, code } = req.body ?? {};
    const name = String(username ?? '').trim();

    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw httpError(400, 'Username must be 3 to 20 letters, numbers or underscores');
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) throw httpError(400, 'Password must be 8 to 72 characters');
    if (process.env.SIGNUP_CODE && code !== process.env.SIGNUP_CODE) throw httpError(403, 'Invalid staff code');

    const { rows: count } = await db.query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'staff'");
    if (count[0].n >= MAX_STAFF) throw httpError(403, 'Staff account limit reached. Ask the owner.');

    const salt = crypto.randomBytes(8).toString('hex');
    const { rows } = await db.query(
      "INSERT INTO users (username, salt, hash, role) VALUES ($1, $2, $3, 'staff') ON CONFLICT (username) DO NOTHING RETURNING username",
      [name, salt, hashPw(password, salt)]);
    if (!rows.length) throw httpError(409, 'That username is already taken');

    res.status(201).json(createSession(name, 'staff'));
  },
});
