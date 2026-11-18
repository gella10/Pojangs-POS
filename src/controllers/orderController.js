import pool from '../config/db.js';

export async function getOrders(req, res) {
  const { date } = req.query; // Optional filter: ?date=YYYY-MM-DD
  try {
    const query = date
      ? `SELECT o.*, COALESCE(json_agg(oi.*) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
         FROM orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         WHERE o.order_date = $1
         GROUP BY o.id
         ORDER BY o.created_at DESC`
      : `SELECT o.*, COALESCE(json_agg(oi.*) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
         FROM orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         GROUP BY o.id
         ORDER BY o.created_at DESC`;

    const result = await pool.query(query, date ? [date] : []);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching orders' });
  }
}

export async function createOrder(req, res) {
  const {
    order_type = 'dine_in',
    boxes = 0,
    plastics = 0,
    payment = 'Cash',
    items = []
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must include at least one item' });
  }

  const total = items.reduce((sum, item) => sum + (item.unit_price * item.qty), 0);
  const created_by = req.user?.username || 'system';
  const order_date = new Date().toISOString().split('T')[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders (order_date, order_type, boxes, plastics, payment, total, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [order_date, order_type, boxes, plastics, payment, total, created_by]
    );
    const order = orderResult.rows[0];

    const insertedItems = [];
    for (const item of items) {
      const itemRes = await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name, category, flavour, qty, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          order.id,
          item.menu_item_id || null,
          item.name,
          item.category || null,
          item.flavour || null,
          item.qty,
          item.unit_price
        ]
      );
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ ...order, items: insertedItems });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Detailed order creation error:', err);
    res.status(500).json({ error: 'Server error creating order', details: err.message });
  } finally {
    client.release();
  }
}

export async function updateOrder(req, res) {
  const { id } = req.params;
  const { order_type, boxes, plastics, payment, items, reason = 'Order updated' } = req.body;
  const changed_by = req.user?.username || 'system';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingRes = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    const existingOrder = existingRes.rows[0];

    const newTotal = Array.isArray(items)
      ? items.reduce((sum, item) => sum + (item.unit_price * item.qty), 0)
      : existingOrder.total;

    const updatedRes = await client.query(
      `UPDATE orders
       SET order_type = COALESCE($1, order_type),
           boxes = COALESCE($2, boxes),
           plastics = COALESCE($3, plastics),
           payment = COALESCE($4, payment),
           total = $5
       WHERE id = $6
       RETURNING *`,
      [order_type, boxes, plastics, payment, newTotal, id]
    );

    if (Array.isArray(items)) {
      await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, name, category, flavour, qty, unit_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            item.menu_item_id || null,
            item.name,
            item.category || null,
            item.flavour || null,
            item.qty,
            item.unit_price
          ]
        );
      }
    }

    if (newTotal !== existingOrder.total) {
      await client.query(
        `INSERT INTO order_changes (order_id, old_total, new_total, reason, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, existingOrder.total, newTotal, reason, changed_by]
      );
    }

    await client.query('COMMIT');
    res.json(updatedRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error updating order' });
  } finally {
    client.release();
  }
}