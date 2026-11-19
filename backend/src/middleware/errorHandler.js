// Last stop for every error: turns it into a clean JSON response and never leaks internals.

/** Unknown URL. */
export const notFound = (_req, res) => res.status(404).json({ error: 'Not found' });

/** Any error thrown in a route (Express 5 forwards async errors here automatically). */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err.status) return res.status(err.status).json({ error: err.message }); // httpError(...)
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });

  // PostgreSQL error codes
  if (err.code === '23505') return res.status(409).json({ error: 'Already exists' });
  if (['23514', '22P02', '22007', '22008'].includes(err.code)) return res.status(400).json({ error: 'Invalid value' });
  if (err.code === '23503') return res.status(409).json({ error: 'Item is used by existing orders' });

  console.error(err);
  res.status(500).json({ error: 'Server error' });
}
