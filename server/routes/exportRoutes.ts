import { Router, Response, NextFunction } from 'express';
import { exportService } from '../services/exportService.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';

export const exportRouter = Router();

exportRouter.get('/export/csv', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filterOptions = {
      search: (req.query.search as string) || undefined,
      status: (req.query.status as string) || undefined,
      dateFrom: (req.query.dateFrom as string) || undefined,
      dateTo: (req.query.dateTo as string) || undefined
    };

    const csvContent = await exportService.generateLeadsCsv(filterOptions);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `leads_export_${dateStr}.csv`;

    await auditRepository.log('export_csv', {
      userId: req.user?.userId,
      userEmail: req.user?.email,
      details: {
        filter: filterOptions
      }
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});
