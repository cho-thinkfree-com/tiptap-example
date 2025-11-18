import type { DocumentEntity } from '../documents/documentRepository'
import type { ExportJobEntity } from './exportJobRepository'
import { ExportJobRepository, type CreateExportJobInput } from './exportJobRepository'
import type { WorkspaceAccessService } from '../workspaces/workspaceAccess'
import type { MembershipRepository } from '../workspaces/membershipRepository'
import type { AuditLogService } from '../audit/auditLogService'
import { ExportJobStatus } from '@prisma/client'

export interface ExportJobPayload {
  workspaceId: string
  documentId?: string
  format: 'pdf' | 'md' | 'html'
}

export class ExportJobService {
  private readonly timers = new Map<string, NodeJS.Timeout>()

  constructor(
    private readonly repository: ExportJobRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly workspaceAccess: WorkspaceAccessService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createJob(accountId: string, payload: ExportJobPayload): Promise<ExportJobEntity> {
    await this.workspaceAccess.assertMember(accountId, payload.workspaceId)
    const membership = await this.membershipRepository.findByWorkspaceAndAccount(payload.workspaceId, accountId)
    if (!membership) {
      throw new Error('membership required')
    }
    const job = await this.repository.create({
      workspaceId: payload.workspaceId,
      documentId: payload.documentId,
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

  private scheduleProcessing(job: ExportJobEntity, actorMembershipId: string) {
    this.repository.updateStatus(job.id, 'processing')
    const timer = setTimeout(async () => {
      await this.repository.updateStatus(job.id, 'completed', `https://cdn.example.com/exports/${job.id}.${job.format}`)
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
