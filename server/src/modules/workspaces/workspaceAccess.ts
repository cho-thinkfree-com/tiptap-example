import type { WorkspaceEntity } from './workspaceRepository'
import { WorkspaceRepository } from './workspaceRepository'
import { MembershipRepository } from './membershipRepository'
import { WorkspaceNotFoundError } from './workspaceService'
import { MembershipAccessDeniedError } from './membershipService'

export class WorkspaceAccessService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly membershipRepository: MembershipRepository,
  ) {}

  async assertOwner(accountId: string, workspaceId: string): Promise<WorkspaceEntity> {
    const workspace = await this.workspaceRepository.findByIdIncludingDeleted(workspaceId)
    if (!workspace || workspace.deletedAt) {
      throw new WorkspaceNotFoundError()
    }
    if (workspace.ownerAccountId !== accountId) {
      throw new MembershipAccessDeniedError()
    }
    return workspace
  }

  async assertAdminOrOwner(accountId: string, workspaceId: string): Promise<WorkspaceEntity> {
    const workspace = await this.workspaceRepository.findByIdIncludingDeleted(workspaceId)
    if (!workspace || workspace.deletedAt) {
      throw new WorkspaceNotFoundError()
    }
    if (workspace.ownerAccountId === accountId) {
      return workspace
    }
    const membership = await this.membershipRepository.findByWorkspaceAndAccount(workspaceId, accountId)
    if (!membership || membership.role === 'member') {
      throw new MembershipAccessDeniedError()
    }
    return workspace
  }

  async assertMember(accountId: string, workspaceId: string): Promise<WorkspaceEntity> {
    const workspace = await this.workspaceRepository.findByIdIncludingDeleted(workspaceId)
    if (!workspace || workspace.deletedAt) {
      throw new WorkspaceNotFoundError()
    }
    if (workspace.ownerAccountId === accountId) {
      return workspace
    }
    const membership = await this.membershipRepository.findByWorkspaceAndAccount(workspaceId, accountId)
    if (!membership) {
      throw new MembershipAccessDeniedError()
    }
    return workspace
  }
}
