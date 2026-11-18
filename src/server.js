import app from './app.js';
import pool from './config/db.js';
import crypto from 'crypto';

const PORT = process.env.PORT || 4000;

async function seedUsers() {
  try {
    const ownerUser = process.env.OWNER_USER || 'owner';
    const ownerPass = process.env.OWNER_PASSWORD || 'owner123';
    const ownerHash = crypto.createHash('sha256').update(ownerPass).digest('hex');
    const dummySalt = 'a17239469b5a7b39';

    await pool.query(
      `INSERT INTO users (username, salt, hash, role, password_hash) 
       VALUES ($1, $2, $3, 'owner', $3) 
       ON CONFLICT (username) DO UPDATE SET password_hash = $3, hash = $3, salt = $2`,
      [ownerUser, dummySalt, ownerHash]
    );
    console.log('◇ seeded users successfully');
  } catch (err) {
    console.error('Seeding error:', err);
  }
}

async function startServer() {
  await seedUsers();
  
  app.listen(PORT, () => {
    console.log(`API ready on port ${PORT}`);
  });
}

startServer();