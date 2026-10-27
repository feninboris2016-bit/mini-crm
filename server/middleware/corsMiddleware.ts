import { Request, Response, NextFunction } from 'express';
import { settingsRepository } from '../repositories/settingsRepository.js';

export function createCorsMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const origin = req.headers.origin;
    const allowedOrigin = (await settingsRepository.getValue('allowed_origin', 'ALLOWED_ORIGIN')) || '*';

    if (allowedOrigin === '*' || !origin) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
      const originsList = allowedOrigin.split(',').map(o => o.trim());
      if (originsList.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Site-Key, X-Idempotency-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
