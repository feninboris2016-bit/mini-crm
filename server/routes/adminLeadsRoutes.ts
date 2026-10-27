import { Router, Response, NextFunction } from 'express';
import { leadsRepository, LeadFilterOptions } from '../repositories/leadsRepository.js';
import { jobsRepository } from '../repositories/jobsRepository.js';
import { commentsRepository } from '../repositories/commentsRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';

export const adminLeadsRouter = Router();

// GET /api/v1/admin/leads/stats
adminLeadsRouter.get('/leads/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await leadsRepository.getStats();
    const queue = await jobsRepository.getStats();
    const recent = await leadsRepository.findRecent(5);

    res.json({
      stats,
      queue,
      recent
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/leads
adminLeadsRouter.get('/leads', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const filterOptions: LeadFilterOptions = {
      search: (req.query.search as string) || undefined,
      status: (req.query.status as string) || undefined,
      dateFrom: (req.query.dateFrom as string) || undefined,
      dateTo: (req.query.dateTo as string) || undefined,
      sortBy: (req.query.sortBy as any) || 'created_at',
      sortOrder: req.query.sortOrder === 'ASC' ? 'ASC' : 'DESC',
      limit,
      offset
    };

    const [leads, total] = await Promise.all([
      leadsRepository.findMany(filterOptions),
      leadsRepository.count(filterOptions)
    ]);

    res.json({
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/leads/:id
adminLeadsRouter.get('/leads/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const leadId = req.params.id as string;
    const lead = await leadsRepository.findById(leadId);
    if (!lead) {
      res.status(404).json({ error: 'Лид не найден' });
      return;
    }

    const [jobs, comments] = await Promise.all([
      jobsRepository.findByLeadId(lead.id),
      commentsRepository.findByLeadId(lead.id)
    ]);

    res.json({
      lead,
      jobs,
      comments
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/leads/:id/status
adminLeadsRouter.patch('/leads/:id/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const leadId = req.params.id as string;
    const { status } = req.body;
    const allowed = ['new', 'in_progress', 'won', 'lost'];

    if (!status || !allowed.includes(status)) {
      res.status(400).json({ error: 'Недопустимый статус. Разрешены: new, in_progress, won, lost' });
      return;
    }

    const current = await leadsRepository.findById(leadId);
    if (!current) {
      res.status(404).json({ error: 'Лид не найден' });
      return;
    }

    const updated = await leadsRepository.updateStatus(leadId, status);

    await auditRepository.log('status_change', {
      userId: req.user?.userId,
      userEmail: req.user?.email,
      details: {
        lead_id: leadId,
        old_status: current.status,
        new_status: status
      }
    });

    res.json({
      success: true,
      lead: updated
    });
  } catch (err) {
    next(err);
  }
});
