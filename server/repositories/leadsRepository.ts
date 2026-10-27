import { db, DbClient } from '../db/connection.js';
import crypto from 'node:crypto';

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  source_url: string | null;
  source_name: string | null;
  status: string; // 'new' | 'in_progress' | 'won' | 'lost'
  created_at: string;
  updated_at: string;
  notification_state: string; // 'pending' | 'sent' | 'partial' | 'failed'
  external_idempotency_key: string | null;
}

export interface CreateLeadInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  source_url?: string | null;
  source_name?: string | null;
  external_idempotency_key?: string | null;
}

export interface LeadFilterOptions {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'created_at' | 'updated_at' | 'status' | 'name';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export const leadsRepository = {
  async create(input: CreateLeadInput, client: DbClient = db): Promise<Lead> {
    const id = 'lead_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = new Date().toISOString();
    const status = 'new';
    const notificationState = 'pending';

    await client.execute(
      `INSERT INTO leads (
        id, name, phone, email, message, source_url, source_name,
        status, created_at, updated_at, notification_state, external_idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        input.name.trim(),
        input.phone?.trim() || null,
        input.email?.trim().toLowerCase() || null,
        input.message?.trim() || null,
        input.source_url?.trim() || null,
        input.source_name?.trim() || 'Сайт',
        status,
        now,
        now,
        notificationState,
        input.external_idempotency_key?.trim() || null
      ]
    );

    return {
      id,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      message: input.message?.trim() || null,
      source_url: input.source_url?.trim() || null,
      source_name: input.source_name?.trim() || 'Сайт',
      status,
      created_at: now,
      updated_at: now,
      notification_state: notificationState,
      external_idempotency_key: input.external_idempotency_key?.trim() || null
    };
  },

  async findById(id: string): Promise<Lead | null> {
    return db.queryOne<Lead>('SELECT * FROM leads WHERE id = $1', [id]);
  },

  async findByIdempotencyKey(key: string): Promise<Lead | null> {
    if (!key) return null;
    return db.queryOne<Lead>('SELECT * FROM leads WHERE external_idempotency_key = $1', [key]);
  },

  async updateStatus(id: string, status: string, client: DbClient = db): Promise<Lead | null> {
    const now = new Date().toISOString();
    await client.execute(
      'UPDATE leads SET status = $1, updated_at = $2 WHERE id = $3',
      [status, now, id]
    );
    return this.findById(id);
  },

  async updateNotificationState(id: string, state: string, client: DbClient = db): Promise<void> {
    const now = new Date().toISOString();
    await client.execute(
      'UPDATE leads SET notification_state = $1, updated_at = $2 WHERE id = $3',
      [state, now, id]
    );
  },

  async findMany(options: LeadFilterOptions = {}): Promise<Lead[]> {
    const { whereClause, params } = this.buildWhereClause(options);
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const limit = options.limit && options.limit > 0 ? options.limit : 50;
    const offset = options.offset && options.offset >= 0 ? options.offset : 0;

    const sql = `
      SELECT * FROM leads 
      ${whereClause} 
      ORDER BY ${sortBy} ${sortOrder} 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    return db.query<Lead>(sql, [...params, limit, offset]);
  },

  async count(options: LeadFilterOptions = {}): Promise<number> {
    const { whereClause, params } = this.buildWhereClause(options);
    const sql = `SELECT COUNT(*) as count FROM leads ${whereClause}`;
    const res = await db.queryOne<{ count: number | string }>(sql, params);
    return Number(res?.count || 0);
  },

  async getStats(): Promise<{
    total: number;
    new: number;
    in_progress: number;
    won: number;
    lost: number;
  }> {
    const rows = await db.query<{ status: string; count: number | string }>(
      'SELECT status, COUNT(*) as count FROM leads GROUP BY status'
    );

    const stats = {
      total: 0,
      new: 0,
      in_progress: 0,
      won: 0,
      lost: 0
    };

    for (const r of rows) {
      const c = Number(r.count);
      stats.total += c;
      if (r.status === 'new') stats.new = c;
      else if (r.status === 'in_progress') stats.in_progress = c;
      else if (r.status === 'won') stats.won = c;
      else if (r.status === 'lost') stats.lost = c;
    }

    return stats;
  },

  async findRecent(limit = 5): Promise<Lead[]> {
    return db.query<Lead>('SELECT * FROM leads ORDER BY created_at DESC LIMIT $1', [limit]);
  },

  buildWhereClause(options: LeadFilterOptions): { whereClause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.status && options.status !== 'all') {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }

    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim().toLowerCase()}%`;
      params.push(term);
      const idx = params.length;
      conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(phone) LIKE $${idx} OR LOWER(email) LIKE $${idx} OR LOWER(message) LIKE $${idx})`);
    }

    if (options.dateFrom) {
      params.push(options.dateFrom);
      conditions.push(`created_at >= $${params.length}`);
    }

    if (options.dateTo) {
      params.push(options.dateTo);
      conditions.push(`created_at <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    return { whereClause, params };
  }
};
