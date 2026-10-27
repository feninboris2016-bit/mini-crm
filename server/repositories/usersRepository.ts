import { db } from '../db/connection.js';
import crypto from 'node:crypto';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
}

export const usersRepository = {
  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    return db.queryOne<User>(
      'SELECT id, email, password_hash, role, created_at FROM users WHERE LOWER(email) = LOWER($1)',
      [normalized]
    );
  },

  async findById(id: string): Promise<User | null> {
    return db.queryOne<User>(
      'SELECT id, email, password_hash, role, created_at FROM users WHERE id = $1',
      [id]
    );
  },

  async create(email: string, passwordHash: string, role = 'admin'): Promise<User> {
    const id = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const normalized = email.trim().toLowerCase();
    const createdAt = new Date().toISOString();

    await db.execute(
      'INSERT INTO users (id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, normalized, passwordHash, role, createdAt]
    );

    return {
      id,
      email: normalized,
      password_hash: passwordHash,
      role,
      created_at: createdAt
    };
  },

  async count(): Promise<number> {
    const res = await db.queryOne<{ count: number | string }>('SELECT COUNT(*) as count FROM users');
    return Number(res?.count || 0);
  }
};
