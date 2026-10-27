import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Check Authorization header or cookie
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.cookies && req.cookies.crm_token) {
    token = req.cookies.crm_token;
  }

  if (!token) {
    res.status(401).json({
      error: 'Необходима авторизация в CRM',
      code: 'UNAUTHORIZED'
    });
    return;
  }

  const payload = authService.verifyToken(token);
  if (!payload) {
    res.status(401).json({
      error: 'Сессия истекла или токен недействителен. Пожалуйста, выполните вход снова.',
      code: 'TOKEN_INVALID'
    });
    return;
  }

  req.user = payload;
  next();
}
