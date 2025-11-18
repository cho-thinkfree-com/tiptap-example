import type { DatabaseClient } from '../../lib/prismaClient'
import type { ExportJobStatus } from '@prisma/client'

export interface ExportJobEntity {
  id: string
  workspaceId: string
  documentId?: string | null
  format: string
  status: ExportJobStatus
  resultUrl?: string | null
  errorMessage?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateExportJobInput {
  workspaceId: string
  documentId?: string | null
  format: string
  status: ExportJobStatus
}

export class ExportJobRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async create(input: CreateExportJobInput): Promise<ExportJobEntity> {
    const job = await this.prisma.exportJob.create({
      data: {
        workspaceId: input.workspaceId,
        documentId: input.documentId ?? null,
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

  async updateStatus(id: string, status: ExportJobStatus, resultUrl?: string | null, errorMessage?: string | null) {
    await this.prisma.exportJob.update({
      where: { id },
      data: {
        status,
        resultUrl: resultUrl ?? null,
        errorMessage: errorMessage ?? null,
      },
    })
  }
}

const toEntity = (job: {
  id: string
  workspaceId: string
  documentId: string | null
  format: string
  status: ExportJobStatus
  resultUrl: string | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
}): ExportJobEntity => ({
  id: job.id,
  workspaceId: job.workspaceId,
  documentId: job.documentId ?? undefined,
  format: job.format,
  status: job.status,
  resultUrl: job.resultUrl ?? undefined,
  errorMessage: job.errorMessage ?? undefined,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
})
