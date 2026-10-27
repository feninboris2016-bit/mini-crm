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
  status: string; // 'new' | 'in_progress' | 'negotiation' | 'won' | 'lost'
  amount: number;
  temperature: 'cold' | 'attention' | 'good' | string;
  manager: string;
  next_call_at: string | null;
  call_status: string;
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
  status?: string;
  amount?: number;
  temperature?: string;
  manager?: string;
  next_call_at?: string | null;
  call_status?: string;
  external_idempotency_key?: string | null;
}

export interface LeadFilterOptions {
  search?: string;
  status?: string;
  temperature?: string;
  manager?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'created_at' | 'updated_at' | 'status' | 'name' | 'amount';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export const leadsRepository = {
  async create(input: CreateLeadInput, client: DbClient = db): Promise<Lead> {
    const id = 'lead_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = new Date().toISOString();
    const status = input.status?.trim() || 'new';
    const notificationState = 'pending';
    const amount = Number(input.amount) || 0;
    const temperature = input.temperature?.trim() || 'cold';
    const manager = input.manager?.trim() || '';
    const nextCallAt = input.next_call_at || null;
    const callStatus = input.call_status?.trim() || 'none';

    await client.execute(
      `INSERT INTO leads (
        id, name, phone, email, message, source_url, source_name,
        status, amount, temperature, manager, next_call_at, call_status,
        created_at, updated_at, notification_state, external_idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        id,
        input.name.trim(),
        input.phone?.trim() || null,
        input.email?.trim().toLowerCase() || null,
        input.message?.trim() || null,
        input.source_url?.trim() || null,
        input.source_name?.trim() || 'Сайт',
        status,
        amount,
        temperature,
        manager,
        nextCallAt,
        callStatus,
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
      amount,
      temperature,
      manager,
      next_call_at: nextCallAt,
      call_status: callStatus,
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

  async updateLead(id: string, patch: Partial<Lead>, client: DbClient = db): Promise<Lead | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = $1'];
    const params: any[] = [now];

    if (patch.name !== undefined) {
      params.push(patch.name.trim());
      fields.push(`name = $${params.length}`);
    }
    if (patch.phone !== undefined) {
      params.push(patch.phone ? patch.phone.trim() : null);
      fields.push(`phone = $${params.length}`);
    }
    if (patch.email !== undefined) {
      params.push(patch.email ? patch.email.trim().toLowerCase() : null);
      fields.push(`email = $${params.length}`);
    }
    if (patch.message !== undefined) {
      params.push(patch.message ? patch.message.trim() : null);
      fields.push(`message = $${params.length}`);
    }
    if (patch.source_name !== undefined) {
      params.push(patch.source_name ? patch.source_name.trim() : null);
      fields.push(`source_name = $${params.length}`);
    }
    if (patch.status !== undefined) {
      params.push(patch.status.trim());
      fields.push(`status = $${params.length}`);
    }
    if (patch.amount !== undefined) {
      params.push(Number(patch.amount) || 0);
      fields.push(`amount = $${params.length}`);
    }
    if (patch.temperature !== undefined) {
      params.push(patch.temperature.trim());
      fields.push(`temperature = $${params.length}`);
    }
    if (patch.manager !== undefined) {
      params.push(patch.manager ? patch.manager.trim() : '');
      fields.push(`manager = $${params.length}`);
    }
    if (patch.next_call_at !== undefined) {
      params.push(patch.next_call_at || null);
      fields.push(`next_call_at = $${params.length}`);
    }
    if (patch.call_status !== undefined) {
      params.push(patch.call_status ? patch.call_status.trim() : 'none');
      fields.push(`call_status = $${params.length}`);
    }

    params.push(id);
    const sql = `UPDATE leads SET ${fields.join(', ')} WHERE id = $${params.length}`;
    await client.execute(sql, params);

    return this.findById(id);
  },

  async delete(id: string, client: DbClient = db): Promise<boolean> {
    const res = await client.execute('DELETE FROM leads WHERE id = $1', [id]);
    return res.rowCount > 0;
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
    negotiation: number;
    won: number;
    lost: number;
    total_amount: number;
    won_amount: number;
    by_column_amounts: Record<string, number>;
    by_temperature: Record<string, number>;
  }> {
    const rows = await db.query<{ status: string; count: number | string; sum_amount: number | string }>(
      'SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as sum_amount FROM leads GROUP BY status'
    );

    const tempRows = await db.query<{ temperature: string; count: number | string }>(
      'SELECT temperature, COUNT(*) as count FROM leads GROUP BY temperature'
    );

    const stats = {
      total: 0,
      new: 0,
      in_progress: 0,
      negotiation: 0,
      won: 0,
      lost: 0,
      total_amount: 0,
      won_amount: 0,
      by_column_amounts: {} as Record<string, number>,
      by_temperature: {
        cold: 0,
        attention: 0,
        good: 0
      } as Record<string, number>
    };

    for (const r of rows) {
      const c = Number(r.count);
      const s = Number(r.sum_amount);
      stats.total += c;
      stats.total_amount += s;
      stats.by_column_amounts[r.status] = s;

      if (r.status === 'new') stats.new = c;
      else if (r.status === 'in_progress') stats.in_progress = c;
      else if (r.status === 'negotiation') stats.negotiation = c;
      else if (r.status === 'won') {
        stats.won = c;
        stats.won_amount += s;
      }
      else if (r.status === 'lost') stats.lost = c;
    }

    for (const tr of tempRows) {
      const t = tr.temperature || 'cold';
      stats.by_temperature[t] = Number(tr.count);
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

    if (options.temperature && options.temperature !== 'all') {
      params.push(options.temperature);
      conditions.push(`temperature = $${params.length}`);
    }

    if (options.manager && options.manager !== 'all') {
      params.push(options.manager);
      conditions.push(`manager = $${params.length}`);
    }

    if (options.source && options.source !== 'all') {
      params.push(`%${options.source.trim().toLowerCase()}%`);
      conditions.push(`LOWER(source_name) LIKE $${params.length}`);
    }

    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim().toLowerCase()}%`;
      params.push(term);
      const idx = params.length;
      conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(phone) LIKE $${idx} OR LOWER(email) LIKE $${idx} OR LOWER(message) LIKE $${idx} OR LOWER(manager) LIKE $${idx})`);
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
