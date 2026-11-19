// Business rules in one place so controllers stay short and nothing is hard-coded twice.

export const CATEGORIES = ['Noodles', 'Toppings', 'K-Food', 'Combo', 'Drinks', 'K-Bowls'];

// Only Samyang Buldak asks for a flavour. Every other item is added without one.
export const FLAVOURS = ['Spicy', 'Carbo', 'Creamy', 'Cheese', 'Quattro', 'Rose'];

export const ORDER_TYPES = ['dine_in', 'take_out'];
export const PAYMENTS = ['Cash', 'InstaPay'];
export const COMBO_CODES = ['A', 'B', 'C'];

// Bills and coins counted at the end of the day, largest first (as written in the logbook).
export const DENOMS = [1000, 100, 50, 20, 10, 5, 1];

export const IDLE_MS = 15 * 60 * 1000; // sign-in ends after 15 minutes without activity (NFR-08)
export const LOCK_MS = 15 * 60 * 1000; // account lock duration after too many wrong passwords (NFR-07)
export const MAX_FAILS = 5;            // wrong passwords in a row before the lock
export const MAX_STAFF = 3;            // SRS 2.5: one owner, up to three staff accounts
