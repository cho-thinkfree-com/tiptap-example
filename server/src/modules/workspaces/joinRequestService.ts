import { JoinRequestRepository } from './joinRequestRepository.js'
import { MembershipRepository } from './membershipRepository.js'
import { WorkspaceRepository } from './workspaceRepository.js'
import type { AccountRepository } from '../accounts/accountRepository.js'
import { WorkspaceAccessService } from './workspaceAccess.js'
import { MembershipAccessDeniedError, MembershipExistsError } from './membershipService.js'
import { WorkspaceNotFoundError } from './workspaceService.js'
import { AuditLogService } from '../audit/auditLogService.js'

export class WorkspaceJoinRequestService {
  private readonly access: WorkspaceAccessService
  constructor(
    private readonly joinRequestRepository: JoinRequestRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly accountRepository: AccountRepository,
    private readonly auditLogService: AuditLogService,
  ) {
    this.access = new WorkspaceAccessService(workspaceRepository, membershipRepository)
  }

  async requestJoin(accountId: string, workspaceId: string, message?: string) {
    const workspace = await this.workspaceRepository.findByIdIncludingDeleted(workspaceId)
    if (!workspace) {
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

    // const domain = account.email.split('@')[1]?.toLowerCase() ?? ''
    // if (domain && workspace.allowedDomains.includes(domain)) {
    //   const membership = await this.membershipRepository.create({
    //     workspaceId,
    //     accountId,
    //     role: 'member',
    //     status: 'active',
    //   })
    //   await this.auditLogService.record({
    //     workspaceId,
    //     actor: { type: 'membership', membershipId: membership.id },
    //     action: 'membership.added',
    //     entityType: 'membership',
    //     entityId: membership.id,
    //     metadata: {
    //       accountId: membership.accountId,
    //       role: membership.role,
    //       status: membership.status,
    //       source: 'join_request_auto',
    //     },
    //   })
    //   return { autoApproved: true }
    // }

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
    const requesterMembership = await this.membershipRepository.findByWorkspaceAndAccount(workspaceId, requestorId)
    if (!requesterMembership) {
      throw new MembershipAccessDeniedError()
    }
    const newMembership = await this.membershipRepository.create({
      workspaceId,
      accountId: request.accountId,
      role: 'member',
      status: 'active',
    })
    await this.auditLogService.record({
      workspaceId,
      actor: { type: 'membership', membershipId: requesterMembership.id },
      action: 'membership.added',
      entityType: 'membership',
      entityId: newMembership.id,
      metadata: {
        accountId: newMembership.accountId,
        role: newMembership.role,
        status: newMembership.status,
        source: 'join_request_approval',
        joinRequestId,
      },
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
