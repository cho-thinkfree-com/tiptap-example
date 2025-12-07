import type { ExportJobEntity } from './exportJobRepository.js'
import { ExportJobRepository } from './exportJobRepository.js'
import type { WorkspaceAccessService } from '../workspaces/workspaceAccess.js'
import type { MembershipRepository } from '../workspaces/membershipRepository.js'
import type { AuditLogService } from '../audit/auditLogService.js'
import { ExportJobStatus } from '@prisma/client'

export class ExportJobNotReadyError extends Error { }
export class ExportJobRetryLimitExceededError extends Error { }
export class ExportJobRetryNotAllowedError extends Error { }

export interface ExportJobPayload {
  workspaceId: string
  fileId?: string
  format: 'pdf' | 'md' | 'html'
}

export class ExportJobService {
  private readonly timers = new Map<string, NodeJS.Timeout>()

  constructor(
    private readonly repository: ExportJobRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly workspaceAccess: WorkspaceAccessService,
    private readonly auditLogService: AuditLogService,
  ) { }

  async createJob(accountId: string, payload: ExportJobPayload): Promise<ExportJobEntity> {
    await this.workspaceAccess.assertMember(accountId, payload.workspaceId)
    const membership = await this.membershipRepository.findByWorkspaceAndAccount(payload.workspaceId, accountId)
    if (!membership) {
      throw new Error('membership required')
    }
    const job = await this.repository.create({
      workspaceId: payload.workspaceId,
      fileId: payload.fileId,
      format: payload.format,
      status: 'pending',
    })
    this.scheduleProcessing(job, membership.id)
    return job
  }

  async getJob(jobId: string): Promise<ExportJobEntity | null> {
    return this.repository.findById(jobId)
  }

  async cancelJob(accountId: string, jobId: string): Promise<void> {
    const job = await this.repository.findById(jobId)
    if (!job) throw new Error('Export job not found')
    await this.workspaceAccess.assertMember(accountId, job.workspaceId)
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return
    await this.repository.updateStatus(jobId, 'cancelled')
    const timer = this.timers.get(jobId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(jobId)
    }
  }

  async getJobResult(accountId: string, jobId: string): Promise<string> {
    const job = await this.repository.findById(jobId)
    if (!job) throw new Error('Export job not found')
    await this.workspaceAccess.assertMember(accountId, job.workspaceId)
    if (job.status !== ExportJobStatus.completed || !job.resultUrl) {
      throw new ExportJobNotReadyError('Export job is not ready yet')
    }
    return job.resultUrl
  }

  async retryJob(accountId: string, jobId: string): Promise<void> {
    const job = await this.repository.findById(jobId)
    if (!job) throw new Error('Export job not found')
    await this.workspaceAccess.assertMember(accountId, job.workspaceId)
    if (job.status === ExportJobStatus.pending || job.status === ExportJobStatus.processing) {
      throw new ExportJobRetryNotAllowedError('Job is already running')
    }
    if (job.retryCount >= 3) {
      throw new ExportJobRetryLimitExceededError('Retry limit reached')
    }
    const membership = await this.membershipRepository.findByWorkspaceAndAccount(job.workspaceId, accountId)
    if (!membership) {
      throw new Error('membership required')
    }
    if (job.status !== ExportJobStatus.failed && job.status !== ExportJobStatus.cancelled) {
      throw new ExportJobRetryNotAllowedError('Only failed or cancelled jobs can be retried')
    }
    await this.repository.updateStatus(jobId, 'pending', { retryCount: job.retryCount + 1, resultUrl: null, errorMessage: null })
    await this.auditLogService.record({
      workspaceId: job.workspaceId,
      actor: { type: 'membership', membershipId: membership.id },
      action: 'export.retry',
      entityType: 'export_job',
      entityId: job.id,
      metadata: { format: job.format, retryCount: job.retryCount + 1 },
    })
    this.scheduleProcessing({ ...job, status: 'pending', retryCount: job.retryCount + 1 }, membership.id)
  }

  private scheduleProcessing(job: ExportJobEntity, actorMembershipId: string) {
    this.repository.updateStatus(job.id, 'processing')
    const timer = setTimeout(async () => {
      await this.repository.updateStatus(job.id, 'completed', {
        resultUrl: `https://cdn.example.com/exports/${job.id}.${job.format}`,
      })
      this.timers.delete(job.id)
      await this.auditLogService.record({
        workspaceId: job.workspaceId,
        actor: { type: 'membership', membershipId: actorMembershipId },
        action: 'export.completed',
        entityType: 'export_job',
        entityId: job.id,
        metadata: { format: job.format },
      })
    }, 1000)
    this.timers.set(job.id, timer)
  }

  shutdown() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }
}
