import pool from './src/config/db.js';
import crypto from 'crypto';

async function updatePasswords() {
  try {
    const ownerHash = crypto.createHash('sha256').update('owner123').digest('hex');
    const staffHash = crypto.createHash('sha256').update('staff123').digest('hex');

    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE username = 'owner'`,
      [ownerHash]
    );
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE username = 'staff'`,
      [staffHash]
    );

    const res = await pool.query('SELECT username, password_hash, salt, role FROM users;');
    console.log('Successfully updated users:', res.rows);
  } catch (err) {
    console.error('Error updating passwords:', err);
  } finally {
    await pool.end();
  }
}

updatePasswords();