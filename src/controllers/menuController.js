import pool from '../config/db.js';

export async function getMenu(req, res) {
  try {
    const itemsResult = await pool.query('SELECT * FROM menu_items ORDER BY id ASC');
    const flavours = ["Mild", "Spicy", "Shin", "Ottogi", "Carbo", "Creamy", "Cheese", "Quattro", "Rose"];
    
    res.json({
      items: itemsResult.rows,
      flavours
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching menu' });
  }
}

export async function createMenuItem(req, res) {
  const { category, name, code = null, price, available = true } = req.body;
  if (!category || !name || price === undefined) {
    return res.status(400).json({ error: 'category, name, and price are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO menu_items (category, name, code, price, available)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [category, name, code, price, available]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Detailed menu creation error:', err);
    res.status(500).json({ error: 'Server error creating menu item', details: err.message });
  }
}

export async function updateMenuItem(req, res) {
  const { id } = req.params;
  const { category, name, code, price, available } = req.body;

  try {
    const result = await pool.query(
      `UPDATE menu_items
       SET category = COALESCE($1, category),
           name = COALESCE($2, name),
           code = COALESCE($3, code),
           price = COALESCE($4, price),
           available = COALESCE($5, available)
       WHERE id = $6
       RETURNING *`,
      [category, name, code, price, available, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating menu item' });
  }
}

export async function deleteMenuItem(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM menu_items WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json({ deletedId: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deleting menu item' });
  }
}