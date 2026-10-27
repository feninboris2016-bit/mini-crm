import { Router, Response, NextFunction } from 'express';
import { backupService } from '../services/backupService.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';

export const backupRouter = Router();

// GET /api/v1/admin/backups
backupRouter.get('/backups', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const backups = backupService.listBackups();
    res.json({ backups });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/backups
backupRouter.post('/backups', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userEmail = req.user?.email || 'admin';
    const metadata = await backupService.createBackup(userEmail);
    res.status(201).json({
      success: true,
      message: 'Резервная копия успешно создана',
      backup: metadata
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/backups/restore
backupRouter.post('/backups/restore', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { filename } = req.body;
    if (!filename) {
      res.status(400).json({ error: 'Укажите имя файла резервной копии' });
      return;
    }

    const userEmail = req.user?.email || 'admin';
    const result = await backupService.restoreBackup(filename, userEmail);

    res.json({
      success: true,
      message: `Восстановление успешно завершено (${result.restoredLeads} лидов, ${result.restoredComments} комментариев)`,
      result
    });
  } catch (err) {
    next(err);
  }
});
