-- Pojangmacha database schema. Safe to run more than once (IF NOT EXISTS / ON CONFLICT).

-- Accounts. Passwords are never stored: only a random salt and a scrypt hash.
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  salt     TEXT NOT NULL,
  hash     TEXT NOT NULL,
  role     TEXT NOT NULL CHECK (role IN ('owner', 'staff'))
);

-- Everything that can be sold. "code" is only used by Combo A/B/C. "available" = Available / Unavailable.
CREATE TABLE IF NOT EXISTS menu_items (
  id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category  TEXT    NOT NULL,
  name      TEXT    NOT NULL UNIQUE,
  code      TEXT,
  price     INT     NOT NULL CHECK (price > 0),
  available BOOLEAN NOT NULL DEFAULT TRUE
);

-- One row per confirmed customer order.
CREATE TABLE IF NOT EXISTS orders (
  id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_date DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'Asia/Manila')::date),
  order_type TEXT NOT NULL CHECK (order_type IN ('dine_in', 'take_out')),
  boxes      INT  NOT NULL DEFAULT 0 CHECK (boxes BETWEEN 0 AND 20),
  plastics   INT  NOT NULL DEFAULT 0 CHECK (plastics BETWEEN 0 AND 20),
  payment    TEXT NOT NULL CHECK (payment IN ('Cash', 'InstaPay')),
  total      INT  NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);

-- The lines of an order. name/category/unit_price are COPIED from the menu at sale time,
-- so changing a price later never changes old orders (AC-15).
CREATE TABLE IF NOT EXISTS order_items (
  id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id     INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INT REFERENCES menu_items(id),
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  flavour      TEXT,
  qty          INT NOT NULL CHECK (qty > 0),
  unit_price   INT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id     ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

-- Audit log: every owner correction keeps the old value, who changed it and why (FR-19).
CREATE TABLE IF NOT EXISTS order_changes (
  id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   INT  NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_total  INT  NOT NULL,
  new_total  INT  NOT NULL,
  reason     TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_changes_order_id ON order_changes(order_id);

-- End-of-day cash box count, one per date. counts looks like {"1000":1,"100":8,...}.
CREATE TABLE IF NOT EXISTS cash_counts (
  count_date DATE PRIMARY KEY,
  counts     JSONB NOT NULL,
  total      INT   NOT NULL,
  saved_by   TEXT
);

-- Starting menu (prices from the shop menu). Re-running never overwrites edits made by the owner.
INSERT INTO menu_items (category, name, code, price, available) VALUES
  ('Noodles',  'Jin Ramen Mild',      NULL, 65,  TRUE),
  ('Noodles',  'Jin Ramen Spicy',     NULL, 65,  TRUE),
  ('Noodles',  'Shin Ramyun',         NULL, 85,  TRUE),
  ('Noodles',  'Samyang Buldak',      NULL, 100, TRUE),
  ('Noodles',  'Ottogi Cheese Ramen', NULL, 75,  TRUE),
  ('Noodles',  'Cream Carbo',         NULL, 105, TRUE),
  ('Toppings', 'Tteokbokki',          NULL, 15,  TRUE),
  ('Toppings', 'Fried Egg',           NULL, 15,  TRUE),
  ('Toppings', 'Seaweed',             NULL, 35,  TRUE),
  ('Toppings', 'Cheese',              NULL, 15,  TRUE),
  ('Toppings', 'Sausage',             NULL, 15,  TRUE),
  ('Toppings', 'Fishcake',            NULL, 15,  TRUE),
  ('Toppings', 'Spam',                NULL, 30,  TRUE),
  ('Toppings', 'Kimchi',              NULL, 15,  TRUE),
  ('K-Food',   'Tteokbokki w/ sauce', NULL, 30,  TRUE),
  ('K-Food',   'Sotteok',             NULL, 40,  TRUE),
  ('K-Food',   'Eomuk',               NULL, 35,  TRUE),
  ('K-Food',   'Combo Tteokbokki',    NULL, 55,  TRUE),
  ('K-Food',   'Budae Jjigae',        NULL, 114, TRUE),
  ('Combo',    'Combo A',             'A',  164, TRUE),
  ('Combo',    'Combo B',             'B',  154, TRUE),
  ('Combo',    'Combo C',             'C',  154, TRUE),
  ('Drinks',   'Strawberry Milk',     NULL, 55,  FALSE), -- "N/A" sticker on the menu
  ('Drinks',   'Melon Milk',          NULL, 55,  TRUE),
  ('Drinks',   'Milkis',              NULL, 50,  TRUE)
ON CONFLICT (name) DO NOTHING;
