export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  source_url: string | null;
  source_name: string | null;
  status: 'new' | 'in_progress' | 'won' | 'lost';
  created_at: string;
  updated_at: string;
  notification_state: 'pending' | 'sent' | 'partial' | 'failed';
  external_idempotency_key: string | null;
}

export interface LeadComment {
  id: string;
  lead_id: string;
  author_id: string;
  author_name: string;
  comment: string;
  created_at: string;
}

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

export interface LeadDetailsResponse {
  lead: Lead;
  jobs: NotificationJob[];
  comments: LeadComment[];
}

export interface DashboardStats {
  stats: {
    total: number;
    new: number;
    in_progress: number;
    won: number;
    lost: number;
  };
  queue: {
    pending: number;
    processing: number;
    sent: number;
    retry: number;
    failed: number;
    total: number;
  };
  recent: Lead[];
}

export interface MaskedSettings {
  recipient_email: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass_set: boolean;
  smtp_from: string;
  smtp_secure: boolean;
  telegram_bot_token_set: boolean;
  telegram_bot_token_preview: string;
  telegram_chat_id: string;
  site_api_key_set: boolean;
  site_api_key_preview: string;
  rate_limit_max_requests: number;
  rate_limit_window_minutes: number;
  backup_status: string;
  last_backup_at: string | null;
}

export interface BackupMetadata {
  filename: string;
  createdAt: string;
  sizeBytes: number;
  leadsCount: number;
  commentsCount: number;
}

export interface AuditEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
}
