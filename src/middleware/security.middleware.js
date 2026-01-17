import { slidingWindow } from '@arcjet/node';
import aj from '#config/arcjet.js';
import logger from '#config/logger.js';

const securityMiddleware = async (req, res, next) => {
  try {
    const role = req.user?.role || 'guest';

    let limit;
    let message;

    switch (role) {
      case 'admin':
        limit = 20;
        message =
          'Admin request limit exceeded (20 requests per minute). Slow down!';
        break;
      case 'user':
        limit = 10;
        message =
          'User request limit exceeded (10 requests per minute). Please wait a moment';
        break;
      case 'guest':
        limit = 5;
        // eslint-disable-next-line no-unused-vars
        message =
          'Guest request limit exceeded (5 requests per minute). Consider signing up for more access';
        break;
    }

    const client = aj.withRule(
      slidingWindow({
        mode: 'LIVE',
        interval: '1m',
        max: limit,
      })
    );

    const decision = await client.protect(req);

    if (decision.isDenied() && decision.reason.isBot()) {
      logger.warn('Bot request blocked', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Bot activity detected. Access denied',
      });
    }

    if (decision.isDenied() && decision.reason.isShield()) {
      logger.warn('Shield blocked request', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Request blocked by security shield',
      });
    }

    if (decision.isDenied() && decision.reason.isRateLimit()) {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Rate limit exceeded. Please wait a moment',
      });
    }
    next();
  } catch (error) {
    console.error('Arcjet Middleware Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Something went wrong with security middleware',
    });
  }
};

export default securityMiddleware;
