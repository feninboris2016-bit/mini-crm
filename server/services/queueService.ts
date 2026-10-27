import { jobsRepository, NotificationJob } from '../repositories/jobsRepository.js';
import { leadsRepository } from '../repositories/leadsRepository.js';
import { emailService } from './emailService.js';
import { telegramService } from './telegramService.js';

let isProcessing = false;
let intervalId: NodeJS.Timeout | null = null;

export const queueService = {
  startWorker(intervalMs = 20000): void {
    if (intervalId) return;
    console.log(`[Queue] Starting notification queue worker (interval: ${intervalMs}ms)`);
    intervalId = setInterval(() => {
      this.tick().catch(err => console.error('[Queue] Unhandled tick error:', err));
    }, intervalMs);
    // Initial run
    this.tick().catch(() => {});
  },

  stopWorker(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      console.log('[Queue] Worker stopped');
    }
  },

  async tick(limit = 10): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (isProcessing) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    isProcessing = true;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      const dueJobs = await jobsRepository.findDueJobs(limit);

      for (const job of dueJobs) {
        // Attempt to claim job atomically
        const claimed = await jobsRepository.claimJob(job.id);
        if (!claimed) continue;

        processed++;
        const result = await this.processJob(job);
        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
      }
    } finally {
      isProcessing = false;
    }

    return { processed, succeeded, failed };
  },

  async processJob(job: NotificationJob): Promise<{ success: boolean; error?: string }> {
    const lead = await leadsRepository.findById(job.lead_id);
    if (!lead) {
      await jobsRepository.markFailed(job.id, 'Лид не найден в базе данных');
      return { success: false, error: 'Lead not found' };
    }

    try {
      if (job.channel === 'email') {
        await emailService.sendLeadNotification(lead);
      } else if (job.channel === 'telegram') {
        await telegramService.sendLeadNotification(lead);
      } else {
        throw new Error(`Неизвестный канал уведомления: ${job.channel}`);
      }

      // Mark successful
      await jobsRepository.markSent(job.id);
      await this.updateLeadNotificationState(job.lead_id);
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.message || 'Ошибка отправки';
      const nextAttempt = job.attempts + 1;

      if (nextAttempt >= job.max_attempts) {
        // Exceeded maximum attempts -> mark as failed permanently
        await jobsRepository.markFailed(job.id, errorMsg);
      } else {
        // Calculate exponential backoff
        // attempt 1: 1 min, attempt 2: 5 min, attempt 3: 15 min, attempt 4: 60 min
        const delaysMinutes = [1, 5, 15, 60];
        const delayMin = delaysMinutes[job.attempts] || 60;
        const nextAttemptAt = new Date(Date.now() + delayMin * 60 * 1000);

        await jobsRepository.markRetry(job.id, errorMsg, nextAttemptAt);
      }

      await this.updateLeadNotificationState(job.lead_id);
      return { success: false, error: errorMsg };
    }
  },

  async updateLeadNotificationState(leadId: string): Promise<void> {
    const jobs = await jobsRepository.findByLeadId(leadId);
    if (jobs.length === 0) return;

    const allSent = jobs.every(j => j.status === 'sent');
    const anyFailed = jobs.some(j => j.status === 'failed');
    const anySent = jobs.some(j => j.status === 'sent');

    let state = 'pending';
    if (allSent) {
      state = 'sent';
    } else if (anyFailed && !anySent) {
      state = 'failed';
    } else if (anySent) {
      state = 'partial';
    }

    await leadsRepository.updateNotificationState(leadId, state);
  }
};
