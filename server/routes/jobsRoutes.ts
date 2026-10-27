import { Router, Request, Response, NextFunction } from 'express';
import { jobsRepository } from '../repositories/jobsRepository.js';
import { queueService } from '../services/queueService.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';

export const jobsRouter = Router();

// Manual retry from CRM UI
jobsRouter.post('/admin/jobs/:id/retry', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const jobId = req.params.id as string;
    const job = await jobsRepository.findById(jobId);
    if (!job) {
      res.status(404).json({ error: 'Задача уведомления не найдена' });
      return;
    }

    const success = await jobsRepository.manualRetry(job.id);
    if (success) {
      // Trigger execution immediately
      setImmediate(() => {
        queueService.tick().catch(err => console.error('[Queue] Manual retry trigger error:', err));
      });
    }

    res.json({
      success: true,
      message: 'Задача поставлена в очередь на немедленную отправку'
    });
  } catch (err) {
    next(err);
  }
});

// Serverless / External Cron Trigger endpoint
// Can be called by cron-job.org / GitHub Actions / Vercel Cron
jobsRouter.post('/jobs/process-queue', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const secret = process.env.CRON_SECRET || 'crm_cron_secret_worker_2026';
    const providedSecret = req.headers['x-cron-key'] || req.query.key || req.body.key;

    if (!providedSecret || providedSecret !== secret) {
      res.status(403).json({ error: 'Неверный секретный ключ Cron (X-Cron-Key)' });
      return;
    }

    const result = await queueService.tick(20);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});
