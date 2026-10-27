import { transaction } from '../db/connection.js';
import { leadsRepository, Lead } from '../repositories/leadsRepository.js';
import { jobsRepository } from '../repositories/jobsRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { queueService } from './queueService.js';

export interface LeadSubmissionPayload {
  name: string;
  phone?: string;
  email?: string;
  message?: string;
  source_url?: string;
  source_name?: string;
  external_idempotency_key?: string;
  _hp_bio?: string; // Honeypot field 1
  website?: string; // Honeypot field 2
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  sanitized?: {
    name: string;
    phone: string | null;
    email: string | null;
    message: string | null;
    source_url: string | null;
    source_name: string | null;
    external_idempotency_key: string | null;
  };
}

function sanitizeText(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/[<>]/g, '') // strip HTML tag brackets
    .trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const leadsService = {
  validatePayload(payload: any): ValidationResult {
    const errors: Record<string, string> = {};

    // 1. Honeypot check: bot detection
    if (payload._hp_bio || payload.website) {
      errors.bot = 'Спам-фильтр заблокировал отправку';
      return { valid: false, errors };
    }

    // 2. Name validation
    const name = sanitizeText(payload.name);
    if (!name || name.length < 2) {
      errors.name = 'Пожалуйста, укажите ваше имя (минимум 2 символа)';
    } else if (name.length > 120) {
      errors.name = 'Имя слишком длинное (максимум 120 символов)';
    }

    // 3. Contact validation (phone / email)
    const phone = payload.phone ? sanitizeText(payload.phone) : null;
    const email = payload.email ? sanitizeText(payload.email).toLowerCase() : null;

    if (!phone && !email) {
      errors.contact = 'Укажите контактные данные: телефон или email для связи';
    }

    if (phone) {
      const digitsOnly = phone.replace(/\D/g, '');
      if (digitsOnly.length < 5 || digitsOnly.length > 20) {
        errors.phone = 'Укажите корректный номер телефона (от 5 до 20 цифр)';
      }
    }

    if (email) {
      if (!isValidEmail(email)) {
        errors.email = 'Укажите корректный email адрес';
      } else if (email.length > 120) {
        errors.email = 'Email слишком длинный (максимум 120 символов)';
      }
    }

    // 4. Message validation
    const message = payload.message ? sanitizeText(payload.message) : null;
    if (message && message.length > 3000) {
      errors.message = 'Сообщение слишком длинное (максимум 3000 символов)';
    }

    const sourceUrl = payload.source_url ? sanitizeText(payload.source_url).slice(0, 1000) : null;
    const sourceName = payload.source_name ? sanitizeText(payload.source_name).slice(0, 120) : 'Форма сайта';
    const idempotencyKey = payload.external_idempotency_key
      ? sanitizeText(payload.external_idempotency_key).slice(0, 255)
      : null;

    if (Object.keys(errors).length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      errors: {},
      sanitized: {
        name,
        phone,
        email,
        message,
        source_url: sourceUrl,
        source_name: sourceName,
        external_idempotency_key: idempotencyKey
      }
    };
  },

  async processLead(
    payload: LeadSubmissionPayload,
    ipAddress?: string
  ): Promise<{ lead: Lead; isDuplicate: boolean }> {
    const val = this.validatePayload(payload);
    if (!val.valid || !val.sanitized) {
      const errMessage = val.errors.bot || 'Ошибка валидации данных заявки';
      const err: any = new Error(errMessage);
      err.validationErrors = val.errors;
      err.status = 400;
      throw err;
    }

    const { sanitized } = val;

    // Check Idempotency Key
    if (sanitized.external_idempotency_key) {
      const existing = await leadsRepository.findByIdempotencyKey(sanitized.external_idempotency_key);
      if (existing) {
        return { lead: existing, isDuplicate: true };
      }
    }

    // Create lead and notification jobs atomically inside a transaction
    const newLead = await transaction(async txClient => {
      // 1. Insert Lead
      const created = await leadsRepository.create(sanitized, txClient);

      // 2. Queue Email notification job
      await jobsRepository.create(created.id, 'email', 5, txClient);

      // 3. Queue Telegram notification job
      await jobsRepository.create(created.id, 'telegram', 5, txClient);

      return created;
    });

    // Log to audit log
    await auditRepository.log('lead_received', {
      details: {
        lead_id: newLead.id,
        name: newLead.name,
        source: newLead.source_name
      },
      ipAddress
    });

    // Kick queue worker asynchronously (do not block client response)
    setImmediate(() => {
      queueService.tick().catch(err => {
        console.error('[Queue] Error in background trigger:', err);
      });
    });

    return { lead: newLead, isDuplicate: false };
  }
};
