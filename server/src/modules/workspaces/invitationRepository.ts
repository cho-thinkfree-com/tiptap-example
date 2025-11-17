import type { WorkspaceInvitation } from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient'

export interface InvitationEntity {
  id: string
  workspaceId: string
  email: string
  tokenHash: string
  status: string
  invitedBy: string
  expiresAt: Date
  resentCount: number
  createdAt: Date
  updatedAt: Date
}

export class InvitationRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async create(data: {
    workspaceId: string
    email: string
    tokenHash: string
    invitedBy: string
    expiresAt: Date
  }): Promise<InvitationEntity> {
    const record = await this.prisma.workspaceInvitation.create({
      data,
    })
    return toEntity(record)
  }

  async findByTokenHash(hash: string): Promise<InvitationEntity | null> {
    const record = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash: hash },
    })
    return record ? toEntity(record) : null
  }

  async findById(id: string): Promise<InvitationEntity | null> {
    const record = await this.prisma.workspaceInvitation.findUnique({ where: { id } })
    return record ? toEntity(record) : null
  }

  async listPending(workspaceId: string): Promise<InvitationEntity[]> {
    const records = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    })
    return records.map(toEntity)
  }

  async findPendingByEmail(workspaceId: string, email: string): Promise<InvitationEntity | null> {
    const record = await this.prisma.workspaceInvitation.findFirst({
      where: { workspaceId, email, status: 'pending' },
    })
    return record ? toEntity(record) : null
  }

  async markAccepted(id: string): Promise<void> {
    await this.prisma.workspaceInvitation.update({
      where: { id },
      data: { status: 'accepted' },
    })
  }

  async markCancelled(id: string): Promise<void> {
    await this.prisma.workspaceInvitation.update({
      where: { id },
      data: { status: 'cancelled' },
    })
  }

  async incrementResend(id: string): Promise<InvitationEntity> {
    const record = await this.prisma.workspaceInvitation.update({
      where: { id },
      data: {
        resentCount: { increment: 1 },
      },
    })
    return toEntity(record)
  }
}

const toEntity = (record: WorkspaceInvitation): InvitationEntity => ({
  id: record.id,
  workspaceId: record.workspaceId,
  email: record.email,
  tokenHash: record.tokenHash,
  status: record.status,
  invitedBy: record.invitedBy,
  expiresAt: record.expiresAt,
  resentCount: record.resentCount,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
})
