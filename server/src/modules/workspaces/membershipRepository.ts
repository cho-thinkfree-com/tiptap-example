import type {
  WorkspaceMembership,
  WorkspaceMembershipRole,
  WorkspaceMembershipStatus,
} from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient.js'

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
  blogTheme?: string | null
  blogHandle?: string | null
  blogDescription?: string | null
  notifications?: Record<string, any> | null
  createdAt: Date
  updatedAt: Date
}

export interface MembershipCreateInput {
  workspaceId: string
  accountId: string
  role: WorkspaceMembershipRole
  status?: WorkspaceMembershipStatus
  displayName?: string
  avatarUrl?: string
  timezone?: string
  preferredLocale?: string
  blogTheme?: string
  blogHandle?: string
  blogDescription?: string
  notifications?: Record<string, any>
}

export interface MembershipUpdateInput {
  role?: WorkspaceMembershipRole
  status?: WorkspaceMembershipStatus
  displayName?: string
  avatarUrl?: string
  timezone?: string
  preferredLocale?: string
  blogTheme?: string
  blogHandle?: string
  blogDescription?: string
  notifications?: Record<string, any>
}

export class MembershipRepository {
  constructor(private readonly prisma: DatabaseClient) { }

  async list(workspaceId: string): Promise<MembershipEntity[]> {
    const members = await this.prisma.workspaceMembership.findMany({
      where: { workspaceId, status: { not: 'removed' } },
      orderBy: [{ createdAt: 'asc' }],
    })
    const entities = members.map(toEntity)
    return entities.sort((a: MembershipEntity, b: MembershipEntity) => {
      const diff = roleWeight(a.role) - roleWeight(b.role)
      if (diff !== 0) return diff
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  }

  async create(input: MembershipCreateInput): Promise<MembershipEntity> {
    const membership = await this.prisma.workspaceMembership.create({
      data: {
        workspaceId: input.workspaceId,
        accountId: input.accountId,
        role: input.role,
        status: input.status,
        displayName: input.displayName,
        timezone: input.timezone,
        locale: input.preferredLocale,
        blogTheme: input.blogTheme,
        blogHandle: input.blogHandle,
        blogDescription: input.blogDescription,
      },
    })
    return toEntity(membership)
  }

  async findByAccount(accountId: string): Promise<MembershipEntity[]> {
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { accountId, status: { not: 'removed' } },
    });
    return memberships.map(toEntity);
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
        timezone: input.timezone,
        locale: input.preferredLocale,
        blogTheme: input.blogTheme,
        blogHandle: input.blogHandle,
        blogDescription: input.blogDescription,
      },
    })
    return toEntity(membership)
  }

  async findById(id: string): Promise<MembershipEntity | null> {
    const membership = await this.prisma.workspaceMembership.findUnique({
      where: { id },
    })
    return membership ? toEntity(membership) : null
  }

  async markRemoved(id: string): Promise<void> {
    await this.prisma.workspaceMembership.update({
      where: { id },
      data: { status: 'removed' },
    })
  }

  async findByWorkspaceAndAccountIncludingRemoved(
    workspaceId: string,
    accountId: string,
  ): Promise<MembershipEntity | null> {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: { workspaceId, accountId },
    })
    return membership ? toEntity(membership) : null
  }
}

const toEntity = (membership: any): MembershipEntity => ({
  id: membership.id,
  workspaceId: membership.workspaceId,
  accountId: membership.accountId,
  role: membership.role,
  status: membership.status,
  displayName: membership.displayName,
  avatarUrl: null,
  timezone: membership.timezone,
  preferredLocale: membership.locale,
  blogTheme: membership.blogTheme,
  blogHandle: membership.blogHandle,
  blogDescription: membership.blogDescription,
  notifications: null,
  createdAt: membership.createdAt,
  updatedAt: membership.updatedAt,
})

const roleWeight = (role: WorkspaceMembershipRole) => {
  switch (role) {
    case 'owner':
      return 0
    case 'admin':
      return 1
    default:
      return 2
  }
}
