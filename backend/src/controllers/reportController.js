// Daily sales, history, cash count and reconciliation (all owner-only, see routes).
import { DENOMS } from '../config/constants.js';
import { dateFromQuery, httpError, isDate, isInt } from '../utils/helpers.js';

export const reportController = (db) => ({
  /** GET /api/sales/daily?date= -> { date, orders, total, items: [{ category, name, qty }] } */
  async daily(req, res) {
    const date = dateFromQuery(req);
    const { rows: totals } = await db.query(
      'SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0)::int AS total FROM orders WHERE order_date = $1', [date]);
    const { rows: items } = await db.query(
      `SELECT oi.category, oi.name, SUM(oi.qty)::int AS qty
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.order_date = $1 GROUP BY oi.category, oi.name ORDER BY oi.category, qty DESC`, [date]);
    res.json({ date, ...totals[0], items });
  },

  /** GET /api/sales/history -> every date that has orders, newest first. */
  async history(_req, res) {
    const { rows } = await db.query(
      `SELECT to_char(order_date, 'YYYY-MM-DD') AS date, COUNT(*)::int AS orders, SUM(total)::int AS total
       FROM orders GROUP BY order_date ORDER BY order_date DESC`);
    res.json(rows);
  },

  /** POST /api/cash-counts  { date, counts: {"1000": n, ...}, replace? } -> saves the cash box count. */
  async saveCash(req, res) {
    const { date, counts, replace } = req.body ?? {};
    if (!isDate(date)) throw httpError(400, 'Invalid date');
    if (!counts || DENOMS.some((d) => !isInt(counts[d]) || counts[d] < 0)) {
      throw httpError(400, 'Every count must be a whole number, 0 or more');
    }
    const total = DENOMS.reduce((sum, d) => sum + d * counts[d], 0);

    const { rows: existing } = await db.query('SELECT 1 FROM cash_counts WHERE count_date = $1', [date]);
    if (existing.length && !replace) throw httpError(409, 'A cash count already exists for this date');

    await db.query(
      `INSERT INTO cash_counts (count_date, counts, total, saved_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (count_date) DO UPDATE SET counts = $2, total = $3, saved_by = $4`,
      [date, JSON.stringify(counts), total, req.user.username]);
    res.status(201).json({ date, total });
  },

  /** GET /api/reconciliation?date= -> sales vs counted cash. difference = cash - sales. */
  async reconciliation(req, res) {
    const date = dateFromQuery(req);
    const { rows: sales } = await db.query('SELECT COALESCE(SUM(total), 0)::int AS total FROM orders WHERE order_date = $1', [date]);
    const { rows: cash } = await db.query('SELECT total FROM cash_counts WHERE count_date = $1', [date]);

    if (!cash.length) return res.json({ date, sales: sales[0].total, cash: null, difference: null, status: 'No cash count' });
    const difference = cash[0].total - sales[0].total;
    res.json({ date, sales: sales[0].total, cash: cash[0].total, difference, status: difference === 0 ? 'Matched' : 'Check' });
  },
});
