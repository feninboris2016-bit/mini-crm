import fs from 'node:fs';
import path from 'node:path';
import { db, transaction } from '../db/connection.js';
import { settingsRepository } from '../repositories/settingsRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';

export interface BackupMetadata {
  filename: string;
  createdAt: string;
  sizeBytes: number;
  leadsCount: number;
  commentsCount: number;
}

export interface BackupPayload {
  version: string;
  createdAt: string;
  counts: {
    leads: number;
    comments: number;
    jobs: number;
    audit: number;
  };
  leads: any[];
  comments: any[];
  jobs: any[];
  audit: any[];
  settings: Record<string, string>;
}

export const backupService = {
  getBackupDir(): string {
    const dir = path.resolve(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  },

  async createBackup(initiatedBy = 'system'): Promise<BackupMetadata> {
    const dir = this.getBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filePath = path.join(dir, filename);

    // Fetch data
    const leads = await db.query('SELECT * FROM leads ORDER BY created_at ASC');
    const comments = await db.query('SELECT * FROM lead_comments ORDER BY created_at ASC');
    const jobs = await db.query('SELECT * FROM notification_jobs ORDER BY created_at ASC');
    const audit = await db.query('SELECT * FROM audit_log ORDER BY created_at ASC LIMIT 1000');

    // Safe settings export - redact secrets
    const rawSettings = await db.query<{ key: string; value: string }>('SELECT key, value FROM settings');
    const safeSettings: Record<string, string> = {};
    for (const s of rawSettings) {
      if (['smtp_pass', 'telegram_bot_token', 'site_api_key'].includes(s.key)) {
        continue; // omit raw secrets from plain export
      }
      safeSettings[s.key] = s.value;
    }

    const payload: BackupPayload = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      counts: {
        leads: leads.length,
        comments: comments.length,
        jobs: jobs.length,
        audit: audit.length
      },
      leads,
      comments,
      jobs,
      audit,
      settings: safeSettings
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    fs.writeFileSync(filePath, jsonStr, 'utf-8');

    const stats = fs.statSync(filePath);

    // Update settings with last backup time
    await settingsRepository.set('last_backup_at', payload.createdAt);
    await settingsRepository.set('backup_status', `Успешно (${leads.length} лидов, ${(stats.size / 1024).toFixed(1)} КБ)`);

    // Audit log
    await auditRepository.log('backup_created', {
      userEmail: initiatedBy,
      details: {
        filename,
        leads_count: leads.length,
        size_bytes: stats.size
      }
    });

    return {
      filename,
      createdAt: payload.createdAt,
      sizeBytes: stats.size,
      leadsCount: leads.length,
      commentsCount: comments.length
    };
  },

  listBackups(): BackupMetadata[] {
    const dir = this.getBackupDir();
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

    const list: BackupMetadata[] = [];
    for (const f of files) {
      try {
        const fullPath = path.join(dir, f);
        const stats = fs.statSync(fullPath);
        const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        list.push({
          filename: f,
          createdAt: content.createdAt || stats.mtime.toISOString(),
          sizeBytes: stats.size,
          leadsCount: content.counts?.leads ?? content.leads?.length ?? 0,
          commentsCount: content.counts?.comments ?? content.comments?.length ?? 0
        });
      } catch (err) {
        console.warn(`[Backup] Could not read backup metadata for ${f}:`, err);
      }
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async restoreBackup(filename: string, initiatedBy = 'admin'): Promise<{ restoredLeads: number; restoredComments: number }> {
    const dir = this.getBackupDir();
    const filePath = path.join(dir, path.basename(filename));

    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл резервной копии "${filename}" не найден`);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data: BackupPayload = JSON.parse(raw);

    if (!data.leads || !Array.isArray(data.leads)) {
      throw new Error('Некорректная структура файла резервной копии');
    }

    // Restore inside transaction
    await transaction(async txClient => {
      // Clean existing data or upsert
      for (const lead of data.leads) {
        const existing = await txClient.queryOne('SELECT id FROM leads WHERE id = $1', [lead.id]);
        if (!existing) {
          await txClient.execute(
            `INSERT INTO leads (
              id, name, phone, email, message, source_url, source_name,
              status, created_at, updated_at, notification_state, external_idempotency_key
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              lead.id,
              lead.name,
              lead.phone,
              lead.email,
              lead.message,
              lead.source_url,
              lead.source_name,
              lead.status || 'new',
              lead.created_at,
              lead.updated_at || lead.created_at,
              lead.notification_state || 'pending',
              lead.external_idempotency_key || null
            ]
          );
        }
      }

      if (data.comments && Array.isArray(data.comments)) {
        for (const c of data.comments) {
          const existing = await txClient.queryOne('SELECT id FROM lead_comments WHERE id = $1', [c.id]);
          if (!existing) {
            await txClient.execute(
              'INSERT INTO lead_comments (id, lead_id, author_id, author_name, comment, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
              [c.id, c.lead_id, c.author_id, c.author_name, c.comment, c.created_at]
            );
          }
        }
      }
    });

    await auditRepository.log('backup_restored', {
      userEmail: initiatedBy,
      details: {
        filename,
        leads_restored: data.leads.length,
        comments_restored: data.comments?.length || 0
      }
    });

    return {
      restoredLeads: data.leads.length,
      restoredComments: data.comments?.length || 0
    };
  }
};
