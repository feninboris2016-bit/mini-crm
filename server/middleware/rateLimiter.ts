import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const ipMap = new Map<string, RateLimitEntry>();

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const list = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return list.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export function createRateLimiter(options: {
  windowMinutes: number;
  maxRequests: number;
  message?: string;
}) {
  const windowMs = options.windowMinutes * 60 * 1000;
  const message = options.message || 'Слишком много запросов. Пожалуйста, подождите.';

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const now = Date.now();
    const entry = ipMap.get(ip);

    if (!entry || entry.resetAt <= now) {
      ipMap.set(ip, {
        count: 1,
        resetAt: now + windowMs
      });
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      return next();
    }

    entry.count += 1;
    const remaining = Math.max(0, options.maxRequests - entry.count);
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > options.maxRequests) {
      const waitSec = Math.ceil((entry.resetAt - now) / 1000);
      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: waitSec
      });
      return;
    }

    next();
  };
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipMap.entries()) {
    if (entry.resetAt <= now) {
      ipMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);
