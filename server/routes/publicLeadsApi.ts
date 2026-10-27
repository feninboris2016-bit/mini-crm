import { Router, Request, Response, NextFunction } from 'express';
import { leadsService } from '../services/leadsService.js';
import { createRateLimiter, getClientIp } from '../middleware/rateLimiter.js';
import { settingsRepository } from '../repositories/settingsRepository.js';

export const publicLeadsRouter = Router();

// Rate limiter for public lead submission: 25 requests per 15 minutes per IP
const publicRateLimiter = createRateLimiter({
  windowMinutes: 15,
  maxRequests: 25,
  message: 'Превышен лимит отправки заявок с вашего IP адреса. Пожалуйста, попробуйте позже.'
});

publicLeadsRouter.post(
  '/leads',
  publicRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientIp = getClientIp(req);

      // Verify site API key if configured
      const configuredSiteKey = await settingsRepository.getValue('site_api_key', 'SITE_API_KEY');
      if (configuredSiteKey) {
        const providedKey = req.headers['x-site-key'] || req.query.api_key || req.body.site_api_key;
        if (!providedKey || providedKey !== configuredSiteKey) {
          res.status(403).json({
            error: 'Неверный или отсутствующий ключ доступа сайта (X-Site-Key)',
            code: 'FORBIDDEN_SITE_KEY'
          });
          return;
        }
      }

      // Extract idempotency key from header or body
      const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body.external_idempotency_key;

      const payload = {
        name: req.body.name,
        phone: req.body.phone,
        email: req.body.email,
        message: req.body.message,
        source_url: req.body.source_url,
        source_name: req.body.source_name,
        external_idempotency_key: idempotencyKey,
        _hp_bio: req.body._hp_bio,
        website: req.body.website
      };

      const result = await leadsService.processLead(payload, clientIp);

      res.status(result.isDuplicate ? 200 : 201).json({
        success: true,
        leadId: result.lead.id,
        isDuplicate: result.isDuplicate,
        message: result.isDuplicate ? 'Заявка уже была принята ранее' : 'Заявка успешно принята в обработку',
        createdAt: result.lead.created_at
      });
    } catch (err) {
      next(err);
    }
  }
);
