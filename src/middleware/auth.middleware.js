import logger from '#config/logger.js';
import { jwttoken } from '#utils/jwt.js';
import { cookies } from '#utils/cookies.js';

export const authenticateToken = (req, res, next) => {
  try {
    const token = cookies.get(req, 'token');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwttoken.verify(token);
    req.user = decoded;

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        `Access denied for user ${req.user.id} with role ${req.user.role}`
      );
      return res
        .status(403)
        .json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};
