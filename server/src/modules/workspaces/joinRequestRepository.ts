import type { WorkspaceJoinRequest } from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient'

export interface JoinRequestEntity {
  id: string
  workspaceId: string
  accountId: string
  status: string
  message?: string | null
  createdAt: Date
  updatedAt: Date
}

export class JoinRequestRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async create(data: { workspaceId: string; accountId: string; message?: string | null }): Promise<JoinRequestEntity> {
    const record = await this.prisma.workspaceJoinRequest.create({
      data,
    })
    return toEntity(record)
  }

  async findPending(workspaceId: string, accountId: string): Promise<JoinRequestEntity | null> {
    const record = await this.prisma.workspaceJoinRequest.findFirst({
      where: { workspaceId, accountId, status: 'pending' },
    })
    return record ? toEntity(record) : null
  }

  async findById(id: string): Promise<JoinRequestEntity | null> {
    const record = await this.prisma.workspaceJoinRequest.findUnique({ where: { id } })
    return record ? toEntity(record) : null
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.prisma.workspaceJoinRequest.update({
      where: { id },
      data: { status },
    })
  }

  async listPending(workspaceId: string): Promise<JoinRequestEntity[]> {
    const records = await this.prisma.workspaceJoinRequest.findMany({
      where: { workspaceId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    })
    return records.map(toEntity)
  }
}

const toEntity = (record: WorkspaceJoinRequest): JoinRequestEntity => ({
  id: record.id,
  workspaceId: record.workspaceId,
  accountId: record.accountId,
  status: record.status,
  message: record.message,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
})
