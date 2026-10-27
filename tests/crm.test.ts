import { describe, it, expect, beforeAll } from 'vitest';
import { initDatabase, db } from '../server/db/connection.js';
import { leadsService } from '../server/services/leadsService.js';
import { leadsRepository } from '../server/repositories/leadsRepository.js';
import { jobsRepository } from '../server/repositories/jobsRepository.js';
import { commentsRepository } from '../server/repositories/commentsRepository.js';
import { usersRepository } from '../server/repositories/usersRepository.js';
import { authService } from '../server/services/authService.js';
import { exportService } from '../server/services/exportService.js';
import { backupService } from '../server/services/backupService.js';
import { queueService } from '../server/services/queueService.js';

describe('Мини-CRM Комплексный набор тестов', () => {
  beforeAll(async () => {
    // Ensure database schema is initialized
    await initDatabase();
  });

  describe('1. Валидация и приём заявок (Leads API & Service)', () => {
    it('должен успешно валидировать и принимать корректную заявку', async () => {
      const payload = {
        name: 'Алексей Смирнов',
        phone: '+7 (999) 111-22-33',
        email: 'alex@example.com',
        message: 'Хочу заказать игровой ПК TRISTAR',
        source_url: 'https://site.local/catalog',
        source_name: 'Кнопка Купить'
      };

      const result = await leadsService.processLead(payload, '127.0.0.1');
      expect(result.lead).toBeDefined();
      expect(result.lead.id).toMatch(/^lead_/);
      expect(result.lead.name).toBe('Алексей Смирнов');
      expect(result.lead.status).toBe('new');
      expect(result.isDuplicate).toBe(false);

      // Verify lead saved in database
      const fromDb = await leadsRepository.findById(result.lead.id);
      expect(fromDb).not.toBeNull();
      expect(fromDb?.name).toBe('Алексей Смирнов');
    });

    it('должен отклонять некорректные данные (отсутствие контактов)', async () => {
      const invalidPayload = {
        name: 'Без Контактов',
        message: 'Свяжитесь со мной телепатически'
      };

      await expect(leadsService.processLead(invalidPayload as any)).rejects.toThrow();
    });

    it('должен отклонять слишком короткое имя', async () => {
      const invalidPayload = {
        name: 'A',
        phone: '+79990001122'
      };

      await expect(leadsService.processLead(invalidPayload as any)).rejects.toThrow();
    });

    it('должен срабатывать honeypot против спам-ботов', async () => {
      const botPayload = {
        name: 'Spam Bot',
        phone: '+79998887766',
        _hp_bio: 'I am a bot filling hidden fields'
      };

      await expect(leadsService.processLead(botPayload as any)).rejects.toThrow('Спам-фильтр');
    });

    it('должен поддерживать идемпотентность и предотвращать дубликаты', async () => {
      const key = 'idem_key_' + Date.now();
      const payload = {
        name: 'Идемпотентный Клиент',
        phone: '+79993334455',
        external_idempotency_key: key
      };

      const res1 = await leadsService.processLead(payload);
      expect(res1.isDuplicate).toBe(false);

      // Second identical submission with same key
      const res2 = await leadsService.processLead(payload);
      expect(res2.isDuplicate).toBe(true);
      expect(res2.lead.id).toBe(res1.lead.id);
    });
  });

  describe('2. Очередь уведомлений и независимость каналов', () => {
    it('должен создавать отдельные задачи для Email и Telegram для каждого лида', async () => {
      const lead = await leadsRepository.create({
        name: 'Тест Очереди',
        phone: '+79990000000'
      });

      await jobsRepository.create(lead.id, 'email');
      await jobsRepository.create(lead.id, 'telegram');

      const jobs = await jobsRepository.findByLeadId(lead.id);
      expect(jobs.length).toBe(2);

      const emailJob = jobs.find(j => j.channel === 'email');
      const tgJob = jobs.find(j => j.channel === 'telegram');
      expect(emailJob).toBeDefined();
      expect(tgJob).toBeDefined();
      expect(emailJob?.status).toBe('pending');
      expect(tgJob?.status).toBe('pending');
    });

    it('ошибка одного канала не должна влиять на другой канал', async () => {
      const lead = await leadsRepository.create({
        name: 'Тест Независимости',
        phone: '+79991234567'
      });

      const emailJob = await jobsRepository.create(lead.id, 'email');
      const tgJob = await jobsRepository.create(lead.id, 'telegram');

      // Simulate email successful, telegram failed
      await jobsRepository.markSent(emailJob.id);
      await jobsRepository.markRetry(tgJob.id, 'Connection timeout', new Date(Date.now() + 60000));

      const updatedJobs = await jobsRepository.findByLeadId(lead.id);
      const e = updatedJobs.find(j => j.id === emailJob.id);
      const t = updatedJobs.find(j => j.id === tgJob.id);

      expect(e?.status).toBe('sent');
      expect(t?.status).toBe('retry');
      expect(t?.attempts).toBe(1);
    });

    it('должен безопасно маскировать секреты в тексте ошибок очереди', () => {
      const sensitiveError = 'Error connecting to bot123456789:ABCdefGHIjklMNOpqrSTUvwxYZ123456789 with password=secret123';
      const sanitized = jobsRepository.sanitizeErrorMessage(sensitiveError);
      expect(sanitized).not.toContain('ABCdefGHIjklMNOpqrSTUvwxYZ123456789');
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).toContain('TOKEN_REDACTED');
    });
  });

  describe('3. Авторизация, пароли и защита сессий', () => {
    it('должен безопасно хешировать и верифицировать пароли с помощью bcrypt', async () => {
      const password = 'SuperSecretPassword_2026!';
      const hash = await authService.hashPassword(password);

      expect(hash).not.toBe(password);
      expect(await authService.verifyPassword(password, hash)).toBe(true);
      expect(await authService.verifyPassword('WrongPassword', hash)).toBe(false);
    });

    it('должен генерировать и валидировать JWT токены', () => {
      const mockUser = {
        id: 'usr_test123',
        email: 'test@admin.local',
        password_hash: 'hash',
        role: 'admin',
        created_at: new Date().toISOString()
      };

      const token = authService.generateToken(mockUser);
      expect(typeof token).toBe('string');

      const payload = authService.verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe('usr_test123');
      expect(payload?.email).toBe('test@admin.local');
    });

    it('должен блокировать перебор паролей (brute force)', () => {
      const testIp = '192.168.1.100';
      for (let i = 0; i < 5; i++) {
        authService.recordFailedLogin(testIp);
      }

      const check = authService.checkBruteForce(testIp);
      expect(check.blocked).toBe(true);
      expect(check.waitSeconds).toBeGreaterThan(0);

      // Clean up
      authService.recordSuccessfulLogin(testIp);
      expect(authService.checkBruteForce(testIp).blocked).toBe(false);
    });
  });

  describe('4. Статусы лидов и внутренние комментарии', () => {
    it('должен изменять статус лида', async () => {
      const lead = await leadsRepository.create({
        name: 'Клиент для смены статуса',
        phone: '+79995556677'
      });
      expect(lead.status).toBe('new');

      const updated = await leadsRepository.updateStatus(lead.id, 'in_progress');
      expect(updated?.status).toBe('in_progress');

      const won = await leadsRepository.updateStatus(lead.id, 'won');
      expect(won?.status).toBe('won');
    });

    it('должен добавлять и сохранять комментарии к лиду', async () => {
      const lead = await leadsRepository.create({
        name: 'Клиент для заметок',
        phone: '+79997778899'
      });

      const c1 = await commentsRepository.create(lead.id, 'usr_1', 'Менеджер Анна', 'Клиент просил перезвонить после 18:00');
      const c2 = await commentsRepository.create(lead.id, 'usr_2', 'Менеджер Олег', 'Конфигурация согласована');

      const list = await commentsRepository.findByLeadId(lead.id);
      expect(list.length).toBe(2);
      expect(list[0].comment).toContain('после 18:00');
      expect(list[1].author_name).toBe('Менеджер Олег');
    });
  });

  describe('5. Экспорт в CSV и защита от инъекций формул', () => {
    it('должен экранировать спецсимволы и формульные инъекции (=, +, -, @)', () => {
      const formulaInjection1 = '=cmd|"/C calc"!A0';
      const formulaInjection2 = '+SUM(1+2)';
      const formulaInjection3 = '@sensitive_var';

      const safe1 = exportService.sanitizeForCsv(formulaInjection1);
      const safe2 = exportService.sanitizeForCsv(formulaInjection2);
      const safe3 = exportService.sanitizeForCsv(formulaInjection3);

      expect(safe1.replace(/^"/, '').startsWith("'=")).toBe(true);
      expect(safe2.replace(/^"/, '').startsWith("'+")).toBe(true);
      expect(safe3.replace(/^"/, '').startsWith("'@")).toBe(true);
    });

    it('должен формировать корректный CSV с UTF-8 BOM', async () => {
      const csv = await exportService.generateLeadsCsv();
      // UTF-8 BOM check
      expect(csv.charCodeAt(0)).toBe(0xFEFF);
      expect(csv).toContain('ID заявки;Дата и время;Статус;Имя клиента');
    });
  });

  describe('6. Резервное копирование и восстановление', () => {
    it('должен создавать корректный снимок базы данных и восстанавливать данные', async () => {
      const backup = await backupService.createBackup('test_runner');
      expect(backup.filename).toMatch(/^backup-.*\.json$/);
      expect(backup.sizeBytes).toBeGreaterThan(0);

      const restoreResult = await backupService.restoreBackup(backup.filename, 'test_runner');
      expect(restoreResult.restoredLeads).toBeGreaterThanOrEqual(0);
    });
  });
});
