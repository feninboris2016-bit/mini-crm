import { Router, Response, NextFunction } from 'express';
import { commentsRepository } from '../repositories/commentsRepository.js';
import { leadsRepository } from '../repositories/leadsRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';

export const commentsRouter = Router();

commentsRouter.get('/leads/:id/comments', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const leadId = req.params.id as string;
    const comments = await commentsRepository.findByLeadId(leadId);
    res.json({ comments });
  } catch (err) {
    next(err);
  }
});

commentsRouter.post('/leads/:id/comments', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const leadId = req.params.id as string;
    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      res.status(400).json({ error: 'Текст комментария не может быть пустым' });
      return;
    }

    const lead = await leadsRepository.findById(leadId);
    if (!lead) {
      res.status(404).json({ error: 'Лид не найден' });
      return;
    }

    const authorId = req.user?.userId || 'usr_unknown';
    const authorName = req.user?.email || 'Администратор';

    const created = await commentsRepository.create(leadId, authorId, authorName, comment);

    await auditRepository.log('comment_added', {
      userId: req.user?.userId,
      userEmail: req.user?.email,
      details: {
        lead_id: leadId,
        comment_id: created.id
      }
    });

    res.status(201).json({
      success: true,
      comment: created
    });
  } catch (err) {
    next(err);
  }
});
