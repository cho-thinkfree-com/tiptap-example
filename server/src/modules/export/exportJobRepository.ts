import type { DatabaseClient } from '../../lib/prismaClient.js'
import type { ExportJobStatus } from '@prisma/client'

export interface ExportJobEntity {
  id: string
  workspaceId: string
  fileId?: string | null
  format: string
  status: ExportJobStatus
  resultUrl?: string | null
  errorMessage?: string | null
  retryCount: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateExportJobInput {
  workspaceId: string
  fileId?: string | null
  format: string
  status: ExportJobStatus
}

export class ExportJobRepository {
  constructor(private readonly prisma: DatabaseClient) { }

  async create(input: CreateExportJobInput): Promise<ExportJobEntity> {
    const job = await this.prisma.exportJob.create({
      data: {
        workspaceId: input.workspaceId,
        fileId: input.fileId ?? null,
        format: input.format,
        status: input.status,
      },
    })
    return toEntity(job)
  }

  async findById(id: string): Promise<ExportJobEntity | null> {
    const job = await this.prisma.exportJob.findUnique({ where: { id } })
    return job ? toEntity(job) : null
  }

  async updateStatus(
    id: string,
    status: ExportJobStatus,
    options?: { resultUrl?: string | null; errorMessage?: string | null; retryCount?: number },
  ) {
    await this.prisma.exportJob.update({
      where: { id },
      data: {
        status,
        resultUrl: options?.resultUrl ?? null,
        errorMessage: options?.errorMessage ?? null,
        retryCount: options?.retryCount ?? undefined,
      },
    })
  }
}

const toEntity = (job: {
  id: string
  workspaceId: string
  fileId: string | null
  format: string
  status: ExportJobStatus
  resultUrl: string | null
  errorMessage: string | null
  retryCount: number
  createdAt: Date
  updatedAt: Date
}): ExportJobEntity => ({
  id: job.id,
  workspaceId: job.workspaceId,
  fileId: job.fileId ?? undefined,
  format: job.format,
  status: job.status,
  resultUrl: job.resultUrl ?? undefined,
  errorMessage: job.errorMessage ?? undefined,
  retryCount: job.retryCount,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
})
