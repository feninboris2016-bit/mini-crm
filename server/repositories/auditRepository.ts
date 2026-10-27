import { db } from '../db/connection.js';
import crypto from 'node:crypto';

export interface AuditEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export const auditRepository = {
  async log(
    action: string,
    options: {
      userId?: string | null;
      userEmail?: string | null;
      details?: Record<string, any> | string | null;
      ipAddress?: string | null;
    } = {}
  ): Promise<void> {
    const id = 'aud_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = new Date().toISOString();

    let detailsStr: string | null = null;
    if (options.details) {
      if (typeof options.details === 'string') {
        detailsStr = options.details;
      } else {
        // Safe sanitize - remove any accidental password/token fields
        const safeDetails = { ...options.details };
        delete (safeDetails as any).password;
        delete (safeDetails as any).token;
        delete (safeDetails as any).secret;
        detailsStr = JSON.stringify(safeDetails);
      }
    }

    await db.execute(
      'INSERT INTO audit_log (id, user_id, user_email, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        id,
        options.userId || null,
        options.userEmail || null,
        action,
        detailsStr,
        options.ipAddress || null,
        now
      ]
    );
  },

  async findRecent(limit = 50): Promise<AuditEntry[]> {
    return db.query<AuditEntry>(
      'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
  }
};
