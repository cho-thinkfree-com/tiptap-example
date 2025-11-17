import { JoinRequestRepository } from './joinRequestRepository'
import { MembershipRepository } from './membershipRepository'
import { WorkspaceRepository } from './workspaceRepository'
import type { AccountRepository } from '../accounts/accountRepository'
import { WorkspaceAccessService } from './workspaceAccess'
import { MembershipExistsError } from './membershipService'
import { WorkspaceNotFoundError } from './workspaceService'

export class WorkspaceJoinRequestService {
  private readonly access: WorkspaceAccessService
  constructor(
    private readonly joinRequestRepository: JoinRequestRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly accountRepository: AccountRepository,
  ) {
    this.access = new WorkspaceAccessService(workspaceRepository, membershipRepository)
  }

  async requestJoin(accountId: string, workspaceId: string, message?: string) {
    const workspace = await this.workspaceRepository.findByIdIncludingDeleted(workspaceId)
    if (!workspace || workspace.deletedAt) {
      throw new WorkspaceNotFoundError()
    }
    if (workspace.visibility === 'private') {
      throw new JoinRequestNotAllowedError()
    }
    const account = await this.accountRepository.findById(accountId)
    if (!account) {
      throw new JoinRequestNotAllowedError()
    }
    const existingMembership = await this.membershipRepository.findByWorkspaceAndAccount(workspaceId, accountId)
    if (existingMembership) {
      throw new MembershipExistsError()
    }

    const domain = account.email.split('@')[1]?.toLowerCase() ?? ''
    if (domain && workspace.allowedDomains.includes(domain)) {
      await this.membershipRepository.create({
        workspaceId,
        accountId,
        role: 'member',
        status: 'active',
      })
      return { autoApproved: true }
    }

    const pending = await this.joinRequestRepository.findPending(workspaceId, accountId)
    if (pending) {
      throw new JoinRequestExistsError()
    }
    await this.joinRequestRepository.create({
      workspaceId,
      accountId,
      message,
    })
    return { autoApproved: false }
  }

  async approve(requestorId: string, workspaceId: string, joinRequestId: string) {
    await this.access.assertAdminOrOwner(requestorId, workspaceId)
    const request = await this.joinRequestRepository.findById(joinRequestId)
    if (!request || request.workspaceId !== workspaceId || request.status !== 'pending') {
      throw new JoinRequestNotFoundError()
    }
    const membership = await this.membershipRepository.findByWorkspaceAndAccount(workspaceId, request.accountId)
    if (membership) {
      throw new MembershipExistsError()
    }
    await this.membershipRepository.create({
      workspaceId,
      accountId: request.accountId,
      role: 'member',
      status: 'active',
    })
    await this.joinRequestRepository.updateStatus(joinRequestId, 'approved')
  }

  async deny(requestorId: string, workspaceId: string, joinRequestId: string) {
    await this.access.assertAdminOrOwner(requestorId, workspaceId)
    const request = await this.joinRequestRepository.findById(joinRequestId)
    if (!request || request.workspaceId !== workspaceId || request.status !== 'pending') {
      throw new JoinRequestNotFoundError()
    }
    await this.joinRequestRepository.updateStatus(joinRequestId, 'denied')
  }
}

export class JoinRequestNotAllowedError extends Error {
  constructor() {
    super('Workspace does not accept join requests')
    this.name = 'JoinRequestNotAllowedError'
  }
}

export class JoinRequestExistsError extends Error {
  constructor() {
    super('Join request already pending')
    this.name = 'JoinRequestExistsError'
  }
}

export class JoinRequestNotFoundError extends Error {
  constructor() {
    super('Join request not found')
    this.name = 'JoinRequestNotFoundError'
  }
}
