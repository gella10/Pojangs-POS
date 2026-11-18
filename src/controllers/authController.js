import pool from '../config/db.js';
import crypto from 'crypto';

export async function login(req, res) {
  const { username, password } = req.body;
  try {
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const result = await pool.query(
    'SELECT * FROM users WHERE username = $1 AND password_hash = $2',
    [username, hashedPassword]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Wrong username or password' });
    }

    const user = result.rows[0];
    // Generate a simple token representation
    const token = crypto.randomBytes(24).toString('hex');

    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}