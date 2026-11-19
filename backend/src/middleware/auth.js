// Sign-in sessions and the guard that protects routes.
// Sessions live in memory: a server restart signs everyone out (acceptable for one stall).
import crypto from 'node:crypto';
import { IDLE_MS } from '../config/constants.js';
import { httpError } from '../utils/helpers.js';

export const sessions = new Map(); // token -> { user, role, last }

/** Start a session after login or sign-up. Returns what the frontend stores. */
export function createSession(username, role) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { user: username, role, last: Date.now() });
  return { token, role, username };
}

// Remove sessions that have been idle too long so the map does not grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of sessions) if (now - s.last > IDLE_MS) sessions.delete(token);
}, 60_000).unref(); // unref: this timer never keeps Node (or the tests) running

/**
 * Route guard. IMPORTANT: always CALL it:  requireAuth()  or  requireAuth('owner').
 *  - requireAuth()         any signed-in user (owner or staff)
 *  - requireAuth('owner')  owner only
 */
export const requireAuth = (...roles) => (req, _res, next) => {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  const session = sessions.get(token);

  if (!session || Date.now() - session.last > IDLE_MS) {
    sessions.delete(token);
    throw httpError(401, 'Please sign in');
  }
  if (roles.length && !roles.includes(session.role)) throw httpError(403, 'Owner access only');

  session.last = Date.now(); // activity keeps the session alive
  req.user = { username: session.user, role: session.role };
  next();
};
