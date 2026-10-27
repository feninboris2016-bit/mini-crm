import { db, DbClient } from '../db/connection.js';
import crypto from 'node:crypto';

export interface NotificationJob {
  id: string;
  lead_id: string;
  channel: 'email' | 'telegram';
  status: 'pending' | 'processing' | 'sent' | 'retry' | 'failed';
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

export const jobsRepository = {
  async create(
    leadId: string,
    channel: 'email' | 'telegram',
    maxAttempts = 5,
    client: DbClient = db
  ): Promise<NotificationJob> {
    const id = 'job_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = new Date().toISOString();

    await client.execute(
      `INSERT INTO notification_jobs (
        id, lead_id, channel, status, attempts, max_attempts, next_attempt_at, last_error, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, leadId, channel, 'pending', 0, maxAttempts, now, null, now, now]
    );

    return {
      id,
      lead_id: leadId,
      channel,
      status: 'pending',
      attempts: 0,
      max_attempts: maxAttempts,
      next_attempt_at: now,
      last_error: null,
      created_at: now,
      updated_at: now,
      sent_at: null
    };
  },

  async findByLeadId(leadId: string): Promise<NotificationJob[]> {
    return db.query<NotificationJob>(
      'SELECT * FROM notification_jobs WHERE lead_id = $1 ORDER BY channel ASC',
      [leadId]
    );
  },

  async findById(jobId: string): Promise<NotificationJob | null> {
    return db.queryOne<NotificationJob>('SELECT * FROM notification_jobs WHERE id = $1', [jobId]);
  },

  async findDueJobs(limit = 10): Promise<NotificationJob[]> {
    const now = new Date().toISOString();
    return db.query<NotificationJob>(
      `SELECT * FROM notification_jobs 
       WHERE status IN ('pending', 'retry') 
         AND next_attempt_at <= $1 
       ORDER BY next_attempt_at ASC 
       LIMIT $2`,
      [now, limit]
    );
  },

  /**
   * Atomically claims a job to prevent race conditions across multiple workers
   */
  async claimJob(jobId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const res = await db.execute(
      `UPDATE notification_jobs 
       SET status = 'processing', updated_at = $1 
       WHERE id = $2 AND status IN ('pending', 'retry')`,
      [now, jobId]
    );
    return res.rowCount > 0;
  },

  async markSent(jobId: string): Promise<void> {
    const now = new Date().toISOString();
    await db.execute(
      `UPDATE notification_jobs 
       SET status = 'sent', sent_at = $1, updated_at = $1, last_error = NULL 
       WHERE id = $2`,
      [now, jobId]
    );
  },

  async markRetry(jobId: string, errorMsg: string, nextAttemptAt: Date): Promise<void> {
    const now = new Date().toISOString();
    const cleanError = this.sanitizeErrorMessage(errorMsg);
    await db.execute(
      `UPDATE notification_jobs 
       SET status = 'retry', 
           attempts = attempts + 1, 
           next_attempt_at = $1, 
           last_error = $2, 
           updated_at = $3 
       WHERE id = $4`,
      [nextAttemptAt.toISOString(), cleanError, now, jobId]
    );
  },

  async markFailed(jobId: string, errorMsg: string): Promise<void> {
    const now = new Date().toISOString();
    const cleanError = this.sanitizeErrorMessage(errorMsg);
    await db.execute(
      `UPDATE notification_jobs 
       SET status = 'failed', 
           attempts = attempts + 1, 
           last_error = $1, 
           updated_at = $2 
       WHERE id = $3`,
      [cleanError, now, jobId]
    );
  },

  async manualRetry(jobId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const res = await db.execute(
      `UPDATE notification_jobs 
       SET status = 'pending', 
           next_attempt_at = $1, 
           updated_at = $1 
       WHERE id = $2`,
      [now, jobId]
    );
    return res.rowCount > 0;
  },

  async getStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    retry: number;
    failed: number;
    total: number;
  }> {
    const rows = await db.query<{ status: string; count: number | string }>(
      'SELECT status, COUNT(*) as count FROM notification_jobs GROUP BY status'
    );

    const stats = {
      pending: 0,
      processing: 0,
      sent: 0,
      retry: 0,
      failed: 0,
      total: 0
    };

    for (const r of rows) {
      const c = Number(r.count);
      stats.total += c;
      if (r.status in stats) {
        (stats as any)[r.status] = c;
      }
    }

    return stats;
  },

  sanitizeErrorMessage(msg: string): string {
    if (!msg) return 'Unknown error';
    // Strip sensitive tokens, passwords, API keys from error message
    let sanitized = msg
      .replace(/bot[0-9]{7,10}:[a-zA-Z0-9_-]{35}/gi, 'bot[TOKEN_REDACTED]')
      .replace(/password[:=]\s*[^\s,;]+/gi, 'password=REDACTED')
      .replace(/pass[:=]\s*[^\s,;]+/gi, 'pass=REDACTED')
      .replace(/authorization:\s*bearer\s+[^\s,;]+/gi, 'Authorization: Bearer REDACTED');
    return sanitized.slice(0, 1000);
  }
};
