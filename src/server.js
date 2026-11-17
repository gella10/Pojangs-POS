const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const crypto = require("crypto");
const { createApp, hashPw } = require("./app");
const db = require("./db");

async function seedUsers() {
  for (const [role, u, p] of [
    ["owner", process.env.OWNER_USER, process.env.OWNER_PASSWORD],
    ["staff", process.env.STAFF_USER, process.env.STAFF_PASSWORD],
  ]) {
    if (!u || !p) {
      console.warn(`Skipping ${role} seed: missing user or password in .env`);
      continue;
    }
    if (p.length < 8) {
      throw new Error(
        `${role} password must be at least 8 characters (NFR-07)`
      );
    }
    const salt = crypto.randomBytes(8).toString("hex");
    await db.query(
      "INSERT INTO users (username, salt, hash, role) VALUES ($1,$2,$3,$4) ON CONFLICT (username) DO UPDATE SET salt=$2, hash=$3",
      [u, salt, hashPw(p, salt), role]
    );
  }
}

seedUsers()
  .then(() => {
    const port = process.env.PORT || 4000;
    createApp(db).listen(port, () => console.log(`API ready on port ${port}`));
  })
  .catch((err) => {
    console.error("FATAL STARTUP ERROR:", err);
    process.exit(1);
  });