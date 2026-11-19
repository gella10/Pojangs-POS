// Orders: take an order, list a day's orders, correct a total.
import { FLAVOURS, ORDER_TYPES, PAYMENTS } from '../config/constants.js';
import { dateFromQuery, httpError, isBuldak, isInt, isText, parseId } from '../utils/helpers.js';

export const orderController = (db) => ({
  /**
   * POST /api/orders
   * { items: [{ id, qty, flavour? }], order_type, boxes?, plastics?, payment }
   * Validates everything, prices the order from the MENU (never from the client), then saves
   * the order and its lines together in one transaction.
   */
  async create(req, res) {
    const { items, order_type, boxes = 0, plastics = 0, payment } = req.body ?? {};

    // 1) Shape checks (no database needed)
    if (!Array.isArray(items) || items.length === 0) throw httpError(400, 'Add at least one item');
    if (items.some((i) => !isInt(i?.id) || !isInt(i?.qty) || i.qty < 1 || i.qty > 99)) throw httpError(400, 'Invalid item or quantity');
    if (!ORDER_TYPES.includes(order_type)) throw httpError(400, 'Choose Dine-in or Take-out');
    if (!PAYMENTS.includes(payment)) throw httpError(400, 'Choose Cash or InstaPay');
    const takeOut = order_type === 'take_out';
    if (takeOut && ![boxes, plastics].every((n) => isInt(n) && n >= 0 && n <= 20)) {
      throw httpError(400, 'Boxes and plastics must be whole numbers from 0 to 20');
    }

    // 2) Menu checks: item exists, is available, Buldak has a flavour
    const wanted = [...new Set(items.map((i) => i.id))];
    const { rows: menu } = await db.query(
      'SELECT id, name, category, price, available FROM menu_items WHERE id = ANY($1::int[])', [wanted]);
    const byId = new Map(menu.map((m) => [m.id, m]));
    for (const i of items) {
      const m = byId.get(i.id);
      if (!m) throw httpError(400, 'Unknown menu item');
      if (!m.available) throw httpError(400, `${m.name} is unavailable`);
      if (isBuldak(m) && !FLAVOURS.includes(i.flavour)) throw httpError(400, `Choose a flavour for ${m.name}`);
    }

    // 3) Price it from the menu: the server is the source of truth
    const total = items.reduce((sum, i) => sum + byId.get(i.id).price * i.qty, 0);

    // 4) Save order + lines atomically: either both are saved or neither is
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'INSERT INTO orders (order_type, boxes, plastics, payment, total, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [order_type, takeOut ? boxes : 0, takeOut ? plastics : 0, payment, total, req.user.username]);
      const order = rows[0];
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name, category, flavour, qty, unit_price)
         SELECT $1, x.id, x.name, x.category, x.flavour, x.qty, x.price
         FROM unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[]) AS x(id, name, category, flavour, qty, price)`,
        [order.id,
          items.map((i) => i.id),
          items.map((i) => byId.get(i.id).name),
          items.map((i) => byId.get(i.id).category),
          items.map((i) => (isBuldak(byId.get(i.id)) ? i.flavour : null)), // flavour only kept for Buldak
          items.map((i) => i.qty),
          items.map((i) => byId.get(i.id).price)]); // price snapshot (AC-15)
      await client.query('COMMIT');
      res.status(201).json(order);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** GET /api/orders?date=YYYY-MM-DD  (owner) -> that day's orders, each with its change log. */
  async list(req, res) {
    const date = dateFromQuery(req);
    const { rows } = await db.query(
      `SELECT o.id, to_char(o.order_date, 'YYYY-MM-DD') AS order_date, o.order_type, o.boxes, o.plastics,
              o.payment, o.total, o.created_by, o.created_at,
              COALESCE((SELECT json_agg(c ORDER BY c.at) FROM order_changes c WHERE c.order_id = o.id), '[]') AS changes
       FROM orders o WHERE o.order_date = $1 ORDER BY o.id`, [date]);
    res.json(rows);
  },

  /** PATCH /api/orders/:id  { total, reason } (owner) -> corrects the total and logs old value, user, reason. */
  async correct(req, res) {
    const id = parseId(req);
    const { total, reason } = req.body ?? {};
    if (!isInt(total) || total < 0) throw httpError(400, 'Total must be a whole number, 0 or more');
    if (!isText(reason)) throw httpError(400, 'A reason is required');

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows: found } = await client.query('SELECT total FROM orders WHERE id = $1 FOR UPDATE', [id]); // lock the row
      if (!found.length) throw httpError(404, 'Order not found');
      await client.query(
        'INSERT INTO order_changes (order_id, old_total, new_total, reason, changed_by) VALUES ($1, $2, $3, $4, $5)',
        [id, found[0].total, total, reason.trim(), req.user.username]);
      const { rows } = await client.query('UPDATE orders SET total = $1 WHERE id = $2 RETURNING *', [total, id]);
      await client.query('COMMIT');
      res.json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
});
