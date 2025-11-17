import type {
  WorkspaceMembership,
  WorkspaceMembershipRole,
  WorkspaceMembershipStatus,
} from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient'

export interface MembershipEntity {
  id: string
  workspaceId: string
  accountId: string
  role: WorkspaceMembershipRole
  status: WorkspaceMembershipStatus
  displayName?: string | null
  avatarUrl?: string | null
  timezone?: string | null
  preferredLocale?: string | null
  notifications?: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export interface MembershipCreateInput {
  workspaceId: string
  accountId: string
  role: WorkspaceMembershipRole
  status?: WorkspaceMembershipStatus
  displayName?: string | null
  avatarUrl?: string | null
  timezone?: string | null
  preferredLocale?: string | null
  notifications?: Record<string, unknown> | null
}

export interface MembershipUpdateInput {
  role?: WorkspaceMembershipRole
  status?: WorkspaceMembershipStatus
  displayName?: string | null
  avatarUrl?: string | null
  timezone?: string | null
  preferredLocale?: string | null
  notifications?: Record<string, unknown> | null
}

export class MembershipRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async list(workspaceId: string): Promise<MembershipEntity[]> {
    const members = await this.prisma.workspaceMembership.findMany({
      where: { workspaceId, status: { not: 'removed' } },
      orderBy: [
        { role: 'asc' }, // owner -> admin -> member (alphabetical matches enum order)
        { createdAt: 'asc' },
      ],
    })
    return members.map(toEntity)
  }

  async create(input: MembershipCreateInput): Promise<MembershipEntity> {
    const membership = await this.prisma.workspaceMembership.create({
      data: {
        workspaceId: input.workspaceId,
        accountId: input.accountId,
        role: input.role,
        status: input.status,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        timezone: input.timezone,
        preferredLocale: input.preferredLocale,
        notifications: input.notifications as any,
      },
    })
    return toEntity(membership)
  }

  async findByWorkspaceAndAccount(workspaceId: string, accountId: string): Promise<MembershipEntity | null> {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: { workspaceId, accountId, status: { not: 'removed' } },
    })
    return membership ? toEntity(membership) : null
  }

  async update(id: string, input: MembershipUpdateInput): Promise<MembershipEntity> {
    const membership = await this.prisma.workspaceMembership.update({
      where: { id },
      data: {
        role: input.role,
        status: input.status,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        timezone: input.timezone,
        preferredLocale: input.preferredLocale,
        notifications: input.notifications as any,
      },
    })
    return toEntity(membership)
  }
}

const toEntity = (membership: WorkspaceMembership): MembershipEntity => ({
  id: membership.id,
  workspaceId: membership.workspaceId,
  accountId: membership.accountId,
  role: membership.role,
  status: membership.status,
  displayName: membership.displayName,
  avatarUrl: membership.avatarUrl,
  timezone: membership.timezone,
  preferredLocale: membership.preferredLocale,
  notifications: membership.notifications as Record<string, unknown> | null,
  createdAt: membership.createdAt,
  updatedAt: membership.updatedAt,
})
