// Small reusable helpers: errors, validation, passwords, dates.
import crypto from 'node:crypto';

/** Create an error that the central error handler turns into a JSON response: { error: message }. */
export const httpError = (status, message) => Object.assign(new Error(message), { status });

export const isInt = (v) => Number.isInteger(v);
export const isPrice = (v) => Number.isInteger(v) && v > 0; // whole pesos, above zero
export const isText = (v) => typeof v === 'string' && v.trim().length > 0;

/** Read and validate :id from the URL (must be a whole number of 1 or more). */
export function parseId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw httpError(400, 'Invalid id');
  return id;
}

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-13-40). */
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Today's date in the Philippines (YYYY-MM-DD). The stall's "day" follows Manila time. */
export const todayPH = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

/** Read ?date= from the URL; defaults to today and rejects bad dates. */
export function dateFromQuery(req) {
  const d = req.query.date ?? todayPH();
  if (!isDate(d)) throw httpError(400, 'Invalid date');
  return d;
}

/** Slow one-way password hash (scrypt) with a per-user salt. */
export const hashPw = (password, salt) => crypto.scryptSync(password, salt, 32).toString('hex');

/** Compare two hex hashes in constant time so timing cannot reveal how much matched. */
export function safeEqual(a, b) {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Samyang Buldak is the only item that needs a flavour. */
export const isBuldak = (item) => item.category === 'Noodles' && /buldak/i.test(item.name);
