import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server/app.js';
import { initDatabase } from '../server/db/connection.js';
import { usersRepository } from '../server/repositories/usersRepository.js';
import { authService } from '../server/services/authService.js';
import http from 'node:http';

describe('HTTP API End-to-End Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;

  afterAll(async () => {
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  beforeAll(async () => {
    await initDatabase();

    // Ensure an admin user exists
    let admin = await usersRepository.findByEmail('test_integration_admin@crm.local');
    if (!admin) {
      const hash = await authService.hashPassword('Pass12345!');
      admin = await usersRepository.create('test_integration_admin@crm.local', hash, 'admin');
    }
    adminToken = authService.generateToken(admin);

    const app = createApp();
    await new Promise<void>(resolve => {
      server = app.listen(0, () => {
        const addr: any = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  it('1. GET /api/health возвращает 200 OK', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('mini-crm');
  });

  it('2. POST /api/v1/leads отклоняет запрос без X-Site-Key с 403 Forbidden', async () => {
    const payload = {
      name: 'Без Ключа',
      phone: '+79991234567'
    };

    const res = await fetch(`${baseUrl}/api/v1/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('FORBIDDEN_SITE_KEY');
  });

  it('3. POST /api/v1/leads принимает валидную заявку от сайта с X-Site-Key и возвращает 201 Created', async () => {
    const siteKey = process.env.SITE_API_KEY || 'tristar_site_api_key_2026';
    const payload = {
      name: 'Мария Иванова',
      phone: '+7 (916) 123-45-67',
      email: 'maria@example.com',
      message: 'Нужна консультация по сборке ПК',
      source_name: 'Форма контактов',
      source_url: 'https://site.local/contact'
    };

    const res = await fetch(`${baseUrl}/api/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Site-Key': siteKey
      },
      body: JSON.stringify(payload)
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.leadId).toMatch(/^lead_/);
    expect(data.isDuplicate).toBe(false);
  });

  it('4. POST /api/v1/leads отклоняет запрос без контактных данных с 400 Bad Request', async () => {
    const siteKey = process.env.SITE_API_KEY || 'tristar_site_api_key_2026';
    const payload = {
      name: 'Без Телефона и Email',
      message: 'Привет'
    };

    const res = await fetch(`${baseUrl}/api/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Site-Key': siteKey
      },
      body: JSON.stringify(payload)
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.validationErrors?.contact).toBeDefined();
  });

  it('4. Защита маршрутов: GET /api/v1/admin/leads возвращает 401 без токена', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/leads`);
    expect(res.status).toBe(401);
  });

  it('5. Авторизованный доступ: GET /api/v1/admin/leads возвращает 200 со списком лидов', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/leads`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.leads)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  it('6. Смена статуса: PATCH /api/v1/admin/leads/:id/status обновляет статус лида', async () => {
    // Fetch a lead first
    const listRes = await fetch(`${baseUrl}/api/v1/admin/leads`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const listData = await listRes.json();
    const lead = listData.leads[0];

    const patchRes = await fetch(`${baseUrl}/api/v1/admin/leads/${lead.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'in_progress' })
    });

    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.lead.status).toBe('in_progress');
  });

  it('7. Добавление комментария: POST /api/v1/admin/leads/:id/comments добавляет внутреннюю заметку', async () => {
    const listRes = await fetch(`${baseUrl}/api/v1/admin/leads`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const listData = await listRes.json();
    const lead = listData.leads[0];

    const commentRes = await fetch(`${baseUrl}/api/v1/admin/leads/${lead.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ comment: 'Проведен звонок, клиент доволен' })
    });

    expect(commentRes.status).toBe(201);
    const commentData = await commentRes.json();
    expect(commentData.comment.comment).toBe('Проведен звонок, клиент доволен');
  });

  it('9. Экспорт: GET /api/v1/admin/export/csv отдает CSV с UTF-8 BOM', async () => {
    const exportRes = await fetch(`${baseUrl}/api/v1/admin/export/csv`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-type')).toContain('text/csv');

    const arrayBuffer = await exportRes.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Verify UTF-8 BOM byte sequence (0xEF, 0xBB, 0xBF)
    expect(bytes[0]).toBe(0xEF);
    expect(bytes[1]).toBe(0xBB);
    expect(bytes[2]).toBe(0xBF);

    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(bytes);
    expect(text).toContain('ID заявки;Дата и время;Статус');
  });

  it('10. Создание бэкапа: POST /api/v1/admin/backups создает снимок базы данных', async () => {
    const backupRes = await fetch(`${baseUrl}/api/v1/admin/backups`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(backupRes.status).toBe(201);
    const backupData = await backupRes.json();
    expect(backupData.success).toBe(true);
    expect(backupData.backup.filename).toMatch(/^backup-.*\.json$/);
  });

  it('11. Chatium CRM API: ручное создание лида, обновление температуры, суммы сделки и удаление', async () => {
    // 1. Create lead manually
    const createRes = await fetch(`${baseUrl}/api/v1/admin/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Ручной клиент Chatium API',
        phone: '+79991112233',
        amount: 250000,
        temperature: 'good',
        manager: 'Алексей',
        status: 'negotiation'
      })
    });

    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.lead.name).toBe('Ручной клиент Chatium API');
    expect(createData.lead.amount).toBe(250000);
    expect(createData.lead.temperature).toBe('good');
    expect(createData.lead.status).toBe('negotiation');

    const leadId = createData.lead.id;

    // 2. Patch lead fields
    const patchRes = await fetch(`${baseUrl}/api/v1/admin/leads/${leadId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        temperature: 'attention',
        amount: 300000,
        call_status: 'callback'
      })
    });

    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.lead.temperature).toBe('attention');
    expect(patchData.lead.amount).toBe(300000);
    expect(patchData.lead.call_status).toBe('callback');

    // 3. Stats check
    const statsRes = await fetch(`${baseUrl}/api/v1/admin/leads/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const statsData = await statsRes.json();
    expect(statsData.stats.total_amount).toBeGreaterThanOrEqual(300000);

    // 4. Delete lead
    const deleteRes = await fetch(`${baseUrl}/api/v1/admin/leads/${leadId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(deleteRes.status).toBe(200);
    const deleteData = await deleteRes.json();
    expect(deleteData.success).toBe(true);
  });
});
