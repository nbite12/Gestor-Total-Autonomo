const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // Get token from header
  const authHeader = req.header('Authorization');

  // Check if no token
  if (!authHeader) {
    return res.status(401).json({ message: 'No hay token, autorización denegada.' });
  }

  // Check if token is in the correct format "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ message: 'El formato del token es inválido.' });
  }
  
  const token = parts[1];

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach payload (e.g., { userId: '...' }) to request
    next();
  } catch (err) {
    res.status(401).json({ message: 'El token no es válido.' });
  }
};
