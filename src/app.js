const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const FLAVOURS = [
  "Mild",
  "Spicy",
  "Shin",
  "Ottogi",
  "Carbo",
  "Creamy",
  "Cheese",
  "Quattro",
  "Rose",
];
const DENOMS = [1000, 100, 50, 20, 10, 5, 1];
const IDLE = 15 * 60 * 1000,
  LOCK = 15 * 60 * 1000;
const hashPw = (p, salt) => crypto.scryptSync(p, salt, 32).toString("hex");
const int = (v) => Number.isInteger(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const todayPH = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

function createApp(db, { now = () => Date.now() } = {}) {
  const app = express();
  const sessions = new Map(),
    fails = new Map();
  app.sessions = sessions;
  app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
  app.use(express.json());
  const w = (fn) => (req, res) =>
    fn(req, res).catch((e) => {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    });
  // FR-18 / NFR-08: token required, ends after 15 idle minutes
  const auth =
    (...roles) =>
    (req, res, next) => {
      const t = (req.headers.authorization || "").replace("Bearer ", "");
      const s = sessions.get(t);
      if (!s || now() - s.last > IDLE) {
        sessions.delete(t);
        return res.status(401).json({ error: "Please sign in" });
      }
      if (roles.length && !roles.includes(s.role))
        return res.status(403).json({ error: "Owner access only" });
      s.last = now();
      req.user = s;
      next();
    };
  const dateOf = (q) => {
    const d = q || todayPH();
    return DATE.test(d) ? d : null;
  };

  app.get("/api/health", (_q, res) => res.json({ status: "ok" }));

  app.post(
    "/api/auth/login",
    w(async (req, res) => {
      const { username, password } = req.body || {};
      if (!username || !password)
        return res.status(400).json({ error: "Enter username and password" });
      const f = fails.get(username) || { n: 0, until: 0 };
      if (f.until > now())
        return res.status(423).json({ error: "Account locked for 15 minutes" });
      const { rows } = await db.query(
        "SELECT username, salt, hash, role FROM users WHERE username = $1",
        [username],
      );
      const u = rows[0];
      if (!u || hashPw(password, u.salt) !== u.hash) {
        f.n += 1;
        if (f.n >= 5) {
          f.until = now() + LOCK;
          f.n = 0;
        }
        fails.set(username, f);
        return res.status(401).json({ error: "Wrong username or password" });
      }
      fails.delete(username);
      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, { user: u.username, role: u.role, last: now() });
      res.json({ token, role: u.role, username: u.username });
    }),
  );

  app.get(
    "/api/menu",
    auth(),
    w(async (_q, res) => {
      const { rows } = await db.query(
        "SELECT id, category, name, code, price, available FROM menu_items ORDER BY id",
      );
      res.json({ items: rows, flavours: FLAVOURS });
    }),
  );
  app.put(
    "/api/menu/:id/price",
    auth("owner"),
    w(async (req, res) => {
      const { price } = req.body || {};
      if (!int(price) || price <= 0)
        return res
          .status(400)
          .json({ error: "Price must be a whole number above 0" });
      const { rows } = await db.query(
        "UPDATE menu_items SET price = $1 WHERE id = $2 RETURNING *",
        [price, Number(req.params.id)],
      );
      rows.length
        ? res.json(rows[0])
        : res.status(404).json({ error: "Item not found" });
    }),
  );
  app.patch(
    "/api/menu/:id/availability",
    auth("owner"),
    w(async (req, res) => {
      const { available } = req.body || {};
      if (typeof available !== "boolean")
        return res
          .status(400)
          .json({ error: "available must be true or false" });
      const { rows } = await db.query(
        "UPDATE menu_items SET available = $1 WHERE id = $2 RETURNING *",
        [available, Number(req.params.id)],
      );
      rows.length
        ? res.json(rows[0])
        : res.status(404).json({ error: "Item not found" });
    }),
  );
  app.put(
    "/api/combos/:code",
    auth("owner"),
    w(async (req, res) => {
      const { price } = req.body || {};
      if (!["A", "B", "C"].includes(req.params.code))
        return res.status(404).json({ error: "Unknown combo" });
      if (!int(price) || price <= 0)
        return res
          .status(400)
          .json({ error: "Price must be a whole number above 0" });
      const { rows } = await db.query(
        "UPDATE menu_items SET price = $1 WHERE code = $2 RETURNING *",
        [price, req.params.code],
      );
      res.json(rows[0]);
    }),
  );

  app.post(
    "/api/orders",
    auth(),
    w(async (req, res) => {
      const {
        items,
        order_type,
        boxes = 0,
        plastics = 0,
        payment,
      } = req.body || {};
      if (!Array.isArray(items) || !items.length)
        return res.status(400).json({ error: "Add at least one item" });
      if (items.some((i) => !int(i.id) || !int(i.qty) || i.qty < 1))
        return res.status(400).json({ error: "Invalid item or quantity" });
      if (!["dine_in", "take_out"].includes(order_type))
        return res.status(400).json({ error: "Choose Dine-in or Take-out" });
      if (!["Cash", "InstaPay"].includes(payment))
        return res.status(400).json({ error: "Choose Cash or InstaPay" });
      const tk = order_type === "take_out";
      if (tk && ![boxes, plastics].every((n) => int(n) && n >= 0 && n <= 20))
        return res
          .status(400)
          .json({
            error: "Boxes and plastics must be whole numbers from 0 to 20",
          });
      const { rows: menu } = await db.query(
        "SELECT id, name, category, price, available FROM menu_items WHERE id = ANY($1)",
        [items.map((i) => i.id)],
      );
      const byId = Object.fromEntries(menu.map((m) => [m.id, m]));
      for (const i of items) {
        const m = byId[i.id];
        if (!m) return res.status(400).json({ error: "Unknown menu item" });
        if (!m.available)
          return res.status(400).json({ error: `${m.name} is unavailable` });
        if (m.category === "Noodles" && !FLAVOURS.includes(i.flavour))
          return res
            .status(400)
            .json({ error: `Choose a flavour for ${m.name}` });
      }
      const total = items.reduce((s, i) => s + byId[i.id].price * i.qty, 0); // FR-07 server is source of truth
      const col = (f) => items.map(f);
      const { rows } = await db.query(
        `WITH o AS (INSERT INTO orders (order_type, boxes, plastics, payment, total, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *),
            i AS (INSERT INTO order_items (order_id, menu_item_id, name, category, flavour, qty, unit_price)
                  SELECT o.id, x.id, x.n, x.c, x.f, x.q, x.p FROM o,
                  unnest($7::int[], $8::text[], $9::text[], $10::text[], $11::int[], $12::int[]) AS x(id, n, c, f, q, p))
       SELECT * FROM o`,
        [
          order_type,
          tk ? boxes : 0,
          tk ? plastics : 0,
          payment,
          total,
          req.user.user,
          col((i) => i.id),
          col((i) => byId[i.id].name),
          col((i) => byId[i.id].category),
          col((i) => i.flavour || null),
          col((i) => i.qty),
          col((i) => byId[i.id].price),
        ],
      );
      res.status(201).json(rows[0]);
    }),
  );

  app.get(
    "/api/orders",
    auth("owner"),
    w(async (req, res) => {
      const d = dateOf(req.query.date);
      if (!d) return res.status(400).json({ error: "Invalid date" });
      const { rows } = await db.query(
        `SELECT o.*, COALESCE((SELECT json_agg(c ORDER BY c.at) FROM order_changes c WHERE c.order_id = o.id), '[]') AS changes
       FROM orders o WHERE order_date = $1 ORDER BY id`,
        [d],
      );
      res.json(rows);
    }),
  );

  // FR-19: owner-only correction of the total, reason required, old value logged
  app.patch(
    "/api/orders/:id",
    auth("owner"),
    w(async (req, res) => {
      const { total, reason } = req.body || {};
      if (!int(total) || total < 0)
        return res
          .status(400)
          .json({ error: "Total must be a whole number, 0 or more" });
      if (!reason || !String(reason).trim())
        return res.status(400).json({ error: "A reason is required" });
      const id = Number(req.params.id);
      const { rows: old } = await db.query(
        "SELECT total FROM orders WHERE id = $1",
        [id],
      );
      if (!old.length)
        return res.status(404).json({ error: "Order not found" });
      await db.query(
        "INSERT INTO order_changes (order_id, old_total, new_total, reason, changed_by) VALUES ($1,$2,$3,$4,$5)",
        [id, old[0].total, total, String(reason).trim(), req.user.user],
      );
      const { rows } = await db.query(
        "UPDATE orders SET total = $1 WHERE id = $2 RETURNING *",
        [total, id],
      );
      res.json(rows[0]);
    }),
  );

  app.get(
    "/api/sales/daily",
    auth("owner"),
    w(async (req, res) => {
      const d = dateOf(req.query.date);
      if (!d) return res.status(400).json({ error: "Invalid date" });
      const { rows: t } = await db.query(
        "SELECT COUNT(*)::int AS orders, COALESCE(SUM(total),0)::int AS total FROM orders WHERE order_date = $1",
        [d],
      );
      const { rows: items } = await db.query(
        `SELECT oi.category, oi.name, SUM(oi.qty)::int AS qty FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.order_date = $1 GROUP BY oi.category, oi.name ORDER BY oi.category, qty DESC`,
        [d],
      );
      res.json({ date: d, ...t[0], items });
    }),
  );
  app.get(
    "/api/sales/history",
    auth("owner"),
    w(async (_q, res) => {
      const { rows } = await db.query(
        "SELECT to_char(order_date,'YYYY-MM-DD') AS date, COUNT(*)::int AS orders, SUM(total)::int AS total FROM orders GROUP BY order_date ORDER BY order_date DESC",
      );
      res.json(rows);
    }),
  );

  app.post(
    "/api/cash-counts",
    auth("owner"),
    w(async (req, res) => {
      const { date, counts, replace } = req.body || {};
      if (!DATE.test(date || ""))
        return res.status(400).json({ error: "Invalid date" });
      if (!counts || DENOMS.some((d) => !int(counts[d]) || counts[d] < 0))
        return res
          .status(400)
          .json({ error: "Every count must be a whole number, 0 or more" });
      const total = DENOMS.reduce((s, d) => s + d * counts[d], 0);
      const { rows: ex } = await db.query(
        "SELECT 1 FROM cash_counts WHERE count_date = $1",
        [date],
      );
      if (ex.length && !replace)
        return res
          .status(409)
          .json({ error: "A cash count already exists for this date" });
      await db.query(
        "INSERT INTO cash_counts (count_date, counts, total, saved_by) VALUES ($1,$2,$3,$4) ON CONFLICT (count_date) DO UPDATE SET counts = $2, total = $3, saved_by = $4",
        [date, JSON.stringify(counts), total, req.user.user],
      );
      res.status(201).json({ date, total });
    }),
  );
  app.get(
    "/api/reconciliation",
    auth("owner"),
    w(async (req, res) => {
      const d = dateOf(req.query.date);
      if (!d) return res.status(400).json({ error: "Invalid date" });
      const { rows: s } = await db.query(
        "SELECT COALESCE(SUM(total),0)::int AS total FROM orders WHERE order_date = $1",
        [d],
      );
      const { rows: c } = await db.query(
        "SELECT total FROM cash_counts WHERE count_date = $1",
        [d],
      );
      if (!c.length)
        return res.json({
          date: d,
          sales: s[0].total,
          cash: null,
          difference: null,
          status: "No cash count",
        });
      const difference = c[0].total - s[0].total;
      res.json({
        date: d,
        sales: s[0].total,
        cash: c[0].total,
        difference,
        status: difference === 0 ? "Matched" : "Check",
      });
    }),
  );
  return app;
}
module.exports = { createApp, hashPw };
