-- Users Table
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    salt TEXT NOT NULL,
    hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'staff'))
);

-- Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    price INT NOT NULL CHECK (price > 0),
    available BOOLEAN NOT NULL DEFAULT TRUE
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_date DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'Asia/Manila')::date),
    order_type TEXT NOT NULL CHECK (order_type IN ('dine_in', 'take_out')),
    boxes INT NOT NULL DEFAULT 0 CHECK (boxes BETWEEN 0 AND 20),
    plastics INT NOT NULL DEFAULT 0 CHECK (plastics BETWEEN 0 AND 20),
    payment TEXT NOT NULL CHECK (payment IN ('Cash', 'InstaPay')),
    total INT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order Items Table 
-- (Price snapshot: later price changes never alter confirmed orders - AC-15)
CREATE TABLE IF NOT EXISTS order_items (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INT REFERENCES menu_items(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    flavour TEXT,
    qty INT NOT NULL CHECK (qty > 0),
    unit_price INT NOT NULL
);

-- Foreign Key Performance Indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

-- Order Changes Audit Table
CREATE TABLE IF NOT EXISTS order_changes (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_total INT NOT NULL,
    new_total INT NOT NULL,
    reason TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_changes_order_id ON order_changes(order_id);

-- Cash Counts Table
CREATE TABLE IF NOT EXISTS cash_counts (
    count_date DATE PRIMARY KEY,
    counts JSONB NOT NULL,
    total INT NOT NULL,
    saved_by TEXT
);

INSERT INTO menu_items (category, name, code, price) VALUES
-- Noodles
('Noodles', 'Jin Ramen Mild', NULL, 65),
('Noodles', 'Jin Ramen Spicy', NULL, 65),
('Noodles', 'Shin Ramyun', NULL, 85),
('Noodles', 'Samyang Buldak', NULL, 100),
('Noodles', 'Ottogi Cheese Ramen', NULL, 75),
('Noodles', 'Cream Carbo', NULL, 105),
-- Toppings
('Toppings', 'Tteokbokki', NULL, 15),
('Toppings', 'Fried Egg', NULL, 15),
('Toppings', 'Seaweed', NULL, 35),
('Toppings', 'Cheese', NULL, 15),
('Toppings', 'Sausage', NULL, 15),
('Toppings', 'Fishcake', NULL, 15),
('Toppings', 'Spam', NULL, 30),
('Toppings', 'Kimchi', NULL, 15),
-- K-Food
('K-Food', 'Tteokbokki w/ sauce', NULL, 30),
('K-Food', 'Sotteok', NULL, 40),
('K-Food', 'Eomuk', NULL, 35),
('K-Food', 'Combo Tteokbokki', NULL, 55),
('K-Food', 'Budae Jjigae', NULL, 114),
-- Combos
('Combo', 'Combo A', 'A', 164),
('Combo', 'Combo B', 'B', 154),
('Combo', 'Combo C', 'C', 154),
-- Drinks
('Drinks', 'Strawberry Milk', NULL, 55),
('Drinks', 'Melon Milk', NULL, 55),
('Drinks', 'Milkis', NULL, 50)
ON CONFLICT (name) DO NOTHING;

UPDATE menu_items 
SET available = FALSE 
WHERE name = 'Strawberry Milk' 
  AND NOT EXISTS (SELECT 1 FROM orders);