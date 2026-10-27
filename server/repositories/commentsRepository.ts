import { db } from '../db/connection.js';
import crypto from 'node:crypto';

export interface LeadComment {
  id: string;
  lead_id: string;
  author_id: string;
  author_name: string;
  comment: string;
  created_at: string;
}

export const commentsRepository = {
  async findByLeadId(leadId: string): Promise<LeadComment[]> {
    return db.query<LeadComment>(
      'SELECT * FROM lead_comments WHERE lead_id = $1 ORDER BY created_at ASC',
      [leadId]
    );
  },

  async create(leadId: string, authorId: string, authorName: string, commentText: string): Promise<LeadComment> {
    const id = 'cmt_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = new Date().toISOString();

    await db.execute(
      'INSERT INTO lead_comments (id, lead_id, author_id, author_name, comment, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, leadId, authorId, authorName, commentText.trim(), now]
    );

    return {
      id,
      lead_id: leadId,
      author_id: authorId,
      author_name: authorName,
      comment: commentText.trim(),
      created_at: now
    };
  }
};
