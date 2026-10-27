import { Router, Request, Response, NextFunction } from 'express';
import { usersRepository } from '../repositories/usersRepository.js';
import { authService } from '../services/authService.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { getClientIp, createRateLimiter } from '../middleware/rateLimiter.js';

export const authRouter = Router();

const loginRateLimiter = createRateLimiter({
  windowMinutes: 15,
  maxRequests: 10,
  message: 'Слишком много попыток входа. Пожалуйста, подождите 15 минут.'
});

authRouter.post('/login', loginRateLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    const clientIp = getClientIp(req);

    if (!email || !password) {
      res.status(400).json({ error: 'Укажите email и пароль' });
      return;
    }

    // Check brute force blocker
    const bruteCheck = authService.checkBruteForce(clientIp);
    if (bruteCheck.blocked) {
      res.status(429).json({
        error: `Слишком много неудачных попыток входа. Доступ заблокирован на ${bruteCheck.waitSeconds} сек.`,
        code: 'BRUTE_FORCE_BLOCKED'
      });
      return;
    }

    const user = await usersRepository.findByEmail(email);
    if (!user) {
      authService.recordFailedLogin(clientIp);
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const valid = await authService.verifyPassword(password, user.password_hash);
    if (!valid) {
      authService.recordFailedLogin(clientIp);
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    // Successful login: reset failed attempts
    authService.recordSuccessfulLogin(clientIp);

    const token = authService.generateToken(user);

    // Set secure httpOnly cookie
    res.cookie('crm_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    await auditRepository.log('login', {
      userId: user.id,
      userEmail: user.email,
      ipAddress: clientIp
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (req: Request, res: Response): void => {
  res.clearCookie('crm_token');
  res.json({ success: true, message: 'Вы успешно вышли из системы' });
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({
    user: req.user
  });
});
