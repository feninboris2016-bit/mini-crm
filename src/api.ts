import { Lead, LeadDetailsResponse, DashboardStats, MaskedSettings, BackupMetadata, AuditEntry, User } from './types';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function getToken(): string | null {
  return localStorage.getItem('crm_token');
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem('crm_token', token);
  } else {
    localStorage.removeItem('crm_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (res.status === 401) {
    setToken(null);
    if (!window.location.hash.includes('/login')) {
      window.location.hash = '#/login';
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg = data?.error || `Ошибка сервера (HTTP ${res.status})`;
    throw new ApiError(msg, res.status, data);
  }

  // Handle blob responses (e.g. CSV download)
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return (await res.blob()) as unknown as T;
  }

  return res.json();
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await request<{ success: boolean; token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      setToken(null);
    }
  },

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    return request<DashboardStats>('/admin/leads/stats');
  },

  // Leads
  async getLeads(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    temperature?: string;
    manager?: string;
    source?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}): Promise<{
    leads: Lead[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.search) searchParams.set('search', params.search);
    if (params.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params.temperature && params.temperature !== 'all') searchParams.set('temperature', params.temperature);
    if (params.manager && params.manager !== 'all') searchParams.set('manager', params.manager);
    if (params.source && params.source !== 'all') searchParams.set('source', params.source);
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) searchParams.set('dateTo', params.dateTo);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request(`/admin/leads${query}`);
  },

  async createLead(leadData: Partial<Lead>): Promise<{ success: boolean; lead: Lead }> {
    return request('/admin/leads', {
      method: 'POST',
      body: JSON.stringify(leadData)
    });
  },

  async updateLead(id: string, patchData: Partial<Lead>): Promise<{ success: boolean; lead: Lead }> {
    return request(`/admin/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patchData)
    });
  },

  async deleteLead(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/admin/leads/${id}`, {
      method: 'DELETE'
    });
  },

  async getLeadDetails(id: string): Promise<LeadDetailsResponse> {
    return request<LeadDetailsResponse>(`/admin/leads/${id}`);
  },

  async updateLeadStatus(id: string, status: string): Promise<{ success: boolean; lead: Lead }> {
    return request(`/admin/leads/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  // Comments
  async addComment(leadId: string, comment: string): Promise<{ success: boolean; comment: any }> {
    return request(`/admin/leads/${leadId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    });
  },

  // Notification Retry
  async retryJob(jobId: string): Promise<{ success: boolean; message: string }> {
    return request(`/admin/jobs/${jobId}/retry`, {
      method: 'POST'
    });
  },

  // Settings
  async getSettings(): Promise<{ settings: MaskedSettings }> {
    return request<{ settings: MaskedSettings }>('/admin/settings');
  },

  async updateSettings(settings: Partial<MaskedSettings> & Record<string, any>): Promise<{ success: boolean; settings: MaskedSettings }> {
    return request('/admin/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  },

  async testEmail(): Promise<{ success: boolean; message: string }> {
    return request('/admin/settings/test-email', { method: 'POST' });
  },

  async testTelegram(): Promise<{ success: boolean; message: string; botUsername?: string }> {
    return request('/admin/settings/test-telegram', { method: 'POST' });
  },

  // Export
  async exportCsv(filters: { search?: string; status?: string; dateFrom?: string; dateTo?: string } = {}): Promise<Blob> {
    const searchParams = new URLSearchParams();
    if (filters.search) searchParams.set('search', filters.search);
    if (filters.status && filters.status !== 'all') searchParams.set('status', filters.status);
    if (filters.dateFrom) searchParams.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) searchParams.set('dateTo', filters.dateTo);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<Blob>(`/admin/export/csv${query}`);
  },

  // Backups
  async getBackups(): Promise<{ backups: BackupMetadata[] }> {
    return request<{ backups: BackupMetadata[] }>('/admin/backups');
  },

  async createBackup(): Promise<{ success: boolean; backup: BackupMetadata }> {
    return request('/admin/backups', { method: 'POST' });
  },

  async restoreBackup(filename: string): Promise<{ success: boolean; message: string }> {
    return request('/admin/backups/restore', {
      method: 'POST',
      body: JSON.stringify({ filename })
    });
  },

  // Audit
  async getAuditLogs(limit = 50): Promise<{ entries: AuditEntry[] }> {
    return request<{ entries: AuditEntry[] }>(`/admin/audit?limit=${limit}`);
  }
};
