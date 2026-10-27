import { Router, Response, NextFunction } from 'express';
import { settingsRepository } from '../repositories/settingsRepository.js';
import { emailService } from '../services/emailService.js';
import { telegramService } from '../services/telegramService.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';

export const settingsRouter = Router();

// GET /api/v1/admin/settings
settingsRouter.get('/settings', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const settings = await settingsRepository.getMaskedSettings();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/settings
settingsRouter.post('/settings', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body || {};
    const updates: Record<string, string> = {};

    // Only update non-empty fields or specific keys
    if (body.recipient_email !== undefined) updates.recipient_email = body.recipient_email.trim();
    if (body.smtp_host !== undefined) updates.smtp_host = body.smtp_host.trim();
    if (body.smtp_port !== undefined) updates.smtp_port = String(body.smtp_port).trim();
    if (body.smtp_user !== undefined) updates.smtp_user = body.smtp_user.trim();
    // Only update password if a new non-empty value was supplied
    if (body.smtp_pass && body.smtp_pass.trim()) {
      updates.smtp_pass = body.smtp_pass.trim();
    }
    if (body.smtp_from !== undefined) updates.smtp_from = body.smtp_from.trim();
    if (body.smtp_secure !== undefined) updates.smtp_secure = String(body.smtp_secure);

    // Only update Telegram bot token if a new non-empty value was supplied
    if (body.telegram_bot_token && body.telegram_bot_token.trim()) {
      updates.telegram_bot_token = body.telegram_bot_token.trim();
    }
    if (body.telegram_chat_id !== undefined) updates.telegram_chat_id = body.telegram_chat_id.trim();

    // Only update site API key if a new non-empty value was supplied
    if (body.site_api_key && body.site_api_key.trim()) {
      updates.site_api_key = body.site_api_key.trim();
    }

    if (body.rate_limit_max_requests !== undefined) {
      updates.rate_limit_max_requests = String(Number(body.rate_limit_max_requests) || 20);
    }
    if (body.rate_limit_window_minutes !== undefined) {
      updates.rate_limit_window_minutes = String(Number(body.rate_limit_window_minutes) || 15);
    }

    await settingsRepository.setMany(updates);

    await auditRepository.log('settings_updated', {
      userId: req.user?.userId,
      userEmail: req.user?.email,
      details: {
        updated_keys: Object.keys(updates)
      }
    });

    const refreshed = await settingsRepository.getMaskedSettings();
    res.json({
      success: true,
      message: 'Настройки успешно сохранены',
      settings: refreshed
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/settings/test-email
settingsRouter.post('/settings/test-email', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = await emailService.testConnection();
  res.json(result);
});

// POST /api/v1/admin/settings/test-telegram
settingsRouter.post('/settings/test-telegram', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = await telegramService.testConnection();
  res.json(result);
});
