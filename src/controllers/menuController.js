// Menu management. Reading is for any signed-in user; every change is owner-only (see routes).
import { CATEGORIES, COMBO_CODES, FLAVOURS } from '../config/constants.js';
import { httpError, isPrice, isText, parseId } from '../utils/helpers.js';

export const menuController = (db) => ({
  /** GET /api/menu -> { items: [...], flavours: [...] } */
  async getMenu(_req, res) {
    const { rows } = await db.query('SELECT id, category, name, code, price, available FROM menu_items ORDER BY id');
    res.json({ items: rows, flavours: FLAVOURS });
  },

  /** GET /api/menu/:id */
  async getItem(req, res) {
    const { rows } = await db.query('SELECT id, category, name, code, price, available FROM menu_items WHERE id = $1', [parseId(req)]);
    if (!rows.length) throw httpError(404, 'Menu item not found');
    res.json(rows[0]);
  },

  /** POST /api/menu  { name, category, price } -> adds a new menu item (available by default). */
  async create(req, res) {
    const { name, category, price } = req.body ?? {};
    if (!isText(name)) throw httpError(400, 'Name is required');
    if (!CATEGORIES.includes(category)) throw httpError(400, `Category must be one of: ${CATEGORIES.join(', ')}`);
    if (!isPrice(price)) throw httpError(400, 'Price must be a whole number above 0');
    const { rows } = await db.query(
      'INSERT INTO menu_items (name, category, price, available) VALUES ($1, $2, $3, TRUE) RETURNING *',
      [name.trim(), category, price]);
    res.status(201).json(rows[0]);
  },

  /** PUT /api/menu/:id  any of { name, category, price, available } -> edits only the fields sent. */
  async update(req, res) {
    const { name, category, price, available } = req.body ?? {};
    if (name !== undefined && !isText(name)) throw httpError(400, 'Name cannot be empty');
    if (category !== undefined && !CATEGORIES.includes(category)) throw httpError(400, 'Unknown category');
    if (price !== undefined && !isPrice(price)) throw httpError(400, 'Price must be a whole number above 0');
    if (available !== undefined && typeof available !== 'boolean') throw httpError(400, 'available must be true or false');
    const { rows } = await db.query(
      `UPDATE menu_items SET name = COALESCE($1, name), category = COALESCE($2, category),
              price = COALESCE($3, price), available = COALESCE($4, available)
       WHERE id = $5 RETURNING *`,
      [name?.trim() ?? null, category ?? null, price ?? null, available ?? null, parseId(req)]);
    if (!rows.length) throw httpError(404, 'Menu item not found');
    res.json(rows[0]);
  },

  /** PUT /api/menu/:id/price  { price } (SRS FR-08) */
  async setPrice(req, res) {
    const { price } = req.body ?? {};
    if (!isPrice(price)) throw httpError(400, 'Price must be a whole number above 0');
    const { rows } = await db.query('UPDATE menu_items SET price = $1 WHERE id = $2 RETURNING *', [price, parseId(req)]);
    if (!rows.length) throw httpError(404, 'Menu item not found');
    res.json(rows[0]);
  },

  /** PATCH /api/menu/:id/availability  { available: true|false } (SRS FR-09: Available / Unavailable) */
  async setAvailability(req, res) {
    const { available } = req.body ?? {};
    if (typeof available !== 'boolean') throw httpError(400, 'available must be true or false');
    const { rows } = await db.query('UPDATE menu_items SET available = $1 WHERE id = $2 RETURNING *', [available, parseId(req)]);
    if (!rows.length) throw httpError(404, 'Menu item not found');
    res.json(rows[0]);
  },

  /** PUT /api/combos/:code  { price }  code is A, B or C (SRS FR-10) */
  async setComboPrice(req, res) {
    const { code } = req.params;
    if (!COMBO_CODES.includes(code)) throw httpError(404, 'Unknown combo');
    const { price } = req.body ?? {};
    if (!isPrice(price)) throw httpError(400, 'Price must be a whole number above 0');
    const { rows } = await db.query('UPDATE menu_items SET price = $1 WHERE code = $2 RETURNING *', [price, code]);
    if (!rows.length) throw httpError(404, 'Combo not found');
    res.json(rows[0]);
  },

  /** DELETE /api/menu/:id  Hides the item instead of deleting it, so old orders keep their history. */
  async remove(req, res) {
    const { rows } = await db.query('UPDATE menu_items SET available = FALSE WHERE id = $1 RETURNING id', [parseId(req)]);
    if (!rows.length) throw httpError(404, 'Menu item not found');
    res.json({ message: 'Menu item marked as unavailable', id: rows[0].id });
  },
});
