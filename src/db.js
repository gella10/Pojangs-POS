const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Completely disable SSL for local development
  ssl: false,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};