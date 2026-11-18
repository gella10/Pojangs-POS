export function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  const token = authHeader.split(' ')[1]; // Expecting "Bearer <token>"
  
  // In your current simple token system, we check against active sessions or mock tokens
  // If you use your token variable mechanism, validate here:
  if (!token) {
    return res.status(403).json({ error: 'Invalid token format' });
  }

  req.user = { token };
  next();
}