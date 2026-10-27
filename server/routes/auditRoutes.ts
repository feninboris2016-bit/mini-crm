import { Router, Response, NextFunction } from 'express';
import { auditRepository } from '../repositories/auditRepository.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';

export const auditRouter = Router();

auditRouter.get('/audit', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 50));
    const entries = await auditRepository.findRecent(limit);
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});
