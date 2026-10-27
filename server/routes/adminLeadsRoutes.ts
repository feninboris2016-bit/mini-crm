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
      temperature: (req.query.temperature as string) || undefined,
      manager: (req.query.manager as string) || undefined,
      source: (req.query.source as string) || undefined,
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

// POST /api/v1/admin/leads (Manual creation by manager/admin)
adminLeadsRouter.post('/leads', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, phone, email, message, source_name, status, amount, temperature, manager, next_call_at, call_status } = req.body;

    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: 'Укажите имя клиента (минимум 2 символа)' });
      return;
    }

    if (!phone && !email) {
      res.status(400).json({ error: 'Укажите контактные данные: телефон или email' });
      return;
    }

    const created = await leadsRepository.create({
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim().toLowerCase() || null,
      message: message?.trim() || null,
      source_name: source_name?.trim() || 'Ручное добавление',
      status: status?.trim() || 'new',
      amount: Number(amount) || 0,
      temperature: temperature?.trim() || 'cold',
      manager: manager?.trim() || '',
      next_call_at: next_call_at || null,
      call_status: call_status?.trim() || 'none'
    });

    await auditRepository.log('lead_created_manually', {
      userId: req.user?.userId,
      userEmail: req.user?.email,
      details: {
        lead_id: created.id,
        name: created.name,
        amount: created.amount,
        manager: created.manager,
        status: created.status
      }
    });

    res.status(201).json({
      success: true,
      lead: created
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/leads/:id (Update lead fields)
adminLeadsRouter.patch('/leads/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const leadId = req.params.id as string;
    const current = await leadsRepository.findById(leadId);
    if (!current) {
      res.status(404).json({ error: 'Лид не найден' });
      return;
    }

    const updated = await leadsRepository.updateLead(leadId, req.body);

    await auditRepository.log('lead_updated', {
      userId: req.user?.userId,
      userEmail: req.user?.email,
      details: {
        lead_id: leadId,
        updated_fields: Object.keys(req.body)
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

// DELETE /api/v1/admin/leads/:id
adminLeadsRouter.delete('/leads/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const leadId = req.params.id as string;
    const current = await leadsRepository.findById(leadId);
    if (!current) {
      res.status(404).json({ error: 'Лид не найден' });
      return;
    }

    await leadsRepository.delete(leadId);

    await auditRepository.log('lead_deleted', {
      userId: req.user?.userId,
      userEmail: req.user?.email,
      details: {
        lead_id: leadId,
        name: current.name,
        phone: current.phone
      }
    });

    res.json({
      success: true,
      message: 'Лид успешно удален'
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
    const allowed = ['new', 'in_progress', 'negotiation', 'won', 'lost'];

    if (!status || typeof status !== 'string' || status.trim().length === 0) {
      res.status(400).json({ error: 'Укажите корректный статус заявки' });
      return;
    }

    const normalizedStatus = status.trim();
    if (!allowed.includes(normalizedStatus) && normalizedStatus.length > 64) {
      res.status(400).json({ error: 'Недопустимый статус' });
      return;
    }

    const current = await leadsRepository.findById(leadId);
    if (!current) {
      res.status(404).json({ error: 'Лид не найден' });
      return;
    }

    const updated = await leadsRepository.updateStatus(leadId, normalizedStatus);

    await auditRepository.log('status_change', {
      userId: req.user?.userId,
      userEmail: req.user?.email,
      details: {
        lead_id: leadId,
        old_status: current.status,
        new_status: normalizedStatus
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
