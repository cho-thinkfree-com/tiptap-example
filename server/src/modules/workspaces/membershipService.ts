import { z } from 'zod'
import type { WorkspaceMembershipRole, WorkspaceMembershipStatus } from '@prisma/client'
import { MembershipRepository, type MembershipEntity } from './membershipRepository'
import { WorkspaceRepository } from './workspaceRepository'
import { WorkspaceNotFoundError } from './workspaceService'
import { WorkspaceAccessService } from './workspaceAccess'

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
  private readonly access: WorkspaceAccessService
  constructor(private readonly repository: MembershipRepository, private readonly workspaceRepository: WorkspaceRepository) {
    this.access = new WorkspaceAccessService(workspaceRepository, repository)
  }

  async listMembers(requestorId: string, workspaceId: string) {
    await this.access.assertAdminOrOwner(requestorId, workspaceId)
    return this.repository.list(workspaceId)
  }

  async addMember(requestorId: string, workspaceId: string, rawInput: z.input<typeof createMembershipSchema>) {
    await this.access.assertAdminOrOwner(requestorId, workspaceId)
    const input = createMembershipSchema.parse(rawInput)
    const existing = await this.repository.findByWorkspaceAndAccountIncludingRemoved(workspaceId, input.accountId)
    if (existing && existing.status !== 'removed') {
      throw new MembershipExistsError()
    }
    if (existing && existing.status === 'removed') {
      return this.repository.update(existing.id, {
        role: input.role,
        status: input.status,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        timezone: input.timezone,
        preferredLocale: input.preferredLocale,
        notifications: input.notifications,
      })
    }
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
    await this.access.assertAdminOrOwner(requestorId, workspaceId)
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

  async removeMember(requestorId: string, workspaceId: string, accountId: string) {
    await this.access.assertAdminOrOwner(requestorId, workspaceId)
    const membership = await this.repository.findByWorkspaceAndAccount(workspaceId, accountId)
    if (!membership) {
      throw new MembershipNotFoundError()
    }
    if (membership.role === 'owner') {
      throw new OwnerDemotionError()
    }
    await this.repository.markRemoved(membership.id)
  }

  async transferOwnership(requestorId: string, workspaceId: string, newOwnerAccountId: string) {
    const workspace = await this.access.assertOwner(requestorId, workspaceId)
    const target = await this.repository.findByWorkspaceAndAccount(workspaceId, newOwnerAccountId)
    if (!target || target.status !== 'active') {
      throw new MembershipNotFoundError()
    }
    if (target.role === 'owner') {
      return
    }
    const currentOwnerMembership = await this.repository.findByWorkspaceAndAccount(workspaceId, requestorId)
    if (currentOwnerMembership) {
      await this.repository.update(currentOwnerMembership.id, { role: 'admin' })
    }
    await this.repository.update(target.id, { role: 'owner' })
    await this.workspaceRepository.updateOwner(workspaceId, newOwnerAccountId)
  }

  async changeRole(requestorId: string, workspaceId: string, accountId: string, role: WorkspaceMembershipRole) {
    const workspace = await this.access.assertAdminOrOwner(requestorId, workspaceId)
    const membership = await this.repository.findByWorkspaceAndAccount(workspaceId, accountId)
    if (!membership) {
      throw new MembershipNotFoundError()
    }
    if (membership.role === 'owner') {
      throw new OwnerDemotionError()
    }
    if (role === 'owner' && workspace.ownerAccountId !== requestorId) {
      throw new MembershipAccessDeniedError()
    }
    await this.repository.update(membership.id, { role })
  }

  async leaveWorkspace(accountId: string, workspaceId: string) {
    const workspace = await this.workspaceRepository.findByIdIncludingDeleted(workspaceId)
    if (!workspace || workspace.deletedAt) {
      throw new WorkspaceNotFoundError()
    }
    if (workspace.ownerAccountId === accountId) {
      throw new OwnerDemotionError()
    }
    const membership = await this.repository.findByWorkspaceAndAccount(workspaceId, accountId)
    if (!membership) {
      throw new MembershipNotFoundError()
    }
    await this.repository.markRemoved(membership.id)
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

export class MembershipExistsError extends Error {
  constructor() {
    super('Membership already exists')
    this.name = 'MembershipExistsError'
  }
}
