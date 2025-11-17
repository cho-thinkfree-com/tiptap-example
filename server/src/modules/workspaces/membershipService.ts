import { z } from 'zod'
import type { WorkspaceMembershipRole, WorkspaceMembershipStatus } from '@prisma/client'
import { MembershipRepository, type MembershipEntity } from './membershipRepository'
import { WorkspaceRepository } from './workspaceRepository'
import { WorkspaceNotFoundError } from './workspaceService'

const roleEnum: [WorkspaceMembershipRole, ...WorkspaceMembershipRole[]] = ['owner', 'admin', 'member']
const statusEnum: [WorkspaceMembershipStatus, ...WorkspaceMembershipStatus[]] = ['active', 'invited', 'pending', 'removed']

const createMembershipSchema = z.object({
  accountId: z.string().uuid(),
  role: z.enum(roleEnum).default('member'),
  status: z.enum(statusEnum).default('invited'),
  displayName: z.string().max(80).optional(),
  avatarUrl: z.string().url().optional(),
  timezone: z.string().max(50).optional(),
  preferredLocale: z.string().trim().min(2).max(10).optional(),
  notifications: z.record(z.string(), z.any()).optional(),
})

const updateMembershipSchema = z.object({
  role: z.enum(roleEnum).optional(),
  status: z.enum(statusEnum).optional(),
  displayName: z.string().max(80).optional(),
  avatarUrl: z.string().url().optional(),
  timezone: z.string().max(50).optional(),
  preferredLocale: z.string().trim().min(2).max(10).optional(),
  notifications: z.record(z.string(), z.any()).optional(),
})

export class MembershipService {
  constructor(private readonly repository: MembershipRepository, private readonly workspaceRepository: WorkspaceRepository) {}

  async listMembers(requestorId: string, workspaceId: string) {
    await this.ensureAccess(requestorId, workspaceId, false)
    return this.repository.list(workspaceId)
  }

  async addMember(requestorId: string, workspaceId: string, rawInput: z.input<typeof createMembershipSchema>) {
    await this.ensureAccess(requestorId, workspaceId, true)
    const input = createMembershipSchema.parse(rawInput)
    return this.repository.create({
      workspaceId,
      accountId: input.accountId,
      role: input.role,
      status: input.status,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      timezone: input.timezone,
      preferredLocale: input.preferredLocale,
      notifications: input.notifications,
    })
  }

  async updateMember(
    requestorId: string,
    workspaceId: string,
    accountId: string,
    rawInput: z.input<typeof updateMembershipSchema>,
  ): Promise<MembershipEntity> {
    await this.ensureAccess(requestorId, workspaceId, true)
    const membership = await this.repository.findByWorkspaceAndAccount(workspaceId, accountId)
    if (!membership) {
      throw new MembershipNotFoundError()
    }
    const input = updateMembershipSchema.parse(rawInput)
    if (membership.role === 'owner' && input.role && input.role !== 'owner') {
      throw new OwnerDemotionError()
    }
    return this.repository.update(membership.id, input)
  }

  private async ensureAccess(requestorAccountId: string, workspaceId: string, adminOnly: boolean) {
    const workspace = await this.workspaceRepository.findByIdIncludingDeleted(workspaceId)
    if (!workspace || workspace.deletedAt) {
      throw new WorkspaceNotFoundError()
    }
    if (workspace.ownerAccountId === requestorAccountId) {
      return
    }
    if (adminOnly) {
      throw new MembershipAccessDeniedError()
    }
    const membership = await this.repository.findByWorkspaceAndAccount(workspaceId, requestorAccountId)
    if (!membership) {
      throw new MembershipAccessDeniedError()
    }
  }
}

export class MembershipNotFoundError extends Error {
  constructor() {
    super('Workspace membership not found')
    this.name = 'MembershipNotFoundError'
  }
}

export class OwnerDemotionError extends Error {
  constructor() {
    super('Cannot demote workspace owner')
    this.name = 'OwnerDemotionError'
  }
}

export class MembershipAccessDeniedError extends Error {
  constructor() {
    super('Insufficient permissions for membership operation')
    this.name = 'MembershipAccessDeniedError'
  }
}
