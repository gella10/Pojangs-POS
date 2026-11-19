// PostgreSQL connection pool, shared by the whole app.
// The pool opens connections lazily, so importing this file never needs the database to be up.
import pg from 'pg';

const url = process.env.DATABASE_URL ?? '';
// Local databases do not use SSL; hosted ones (Neon, Render, Supabase) do.
const isLocal = /localhost|127\.0\.0\.1/.test(url);

const pool = new pg.Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// An idle client dropping its connection must not crash the server.
pool.on('error', (err) => console.error('Idle database client error:', err.message));

export default pool;
