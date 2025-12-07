import { randomBytes } from 'node:crypto'
import { InvitationRepository, type InvitationEntity } from './invitationRepository.js'
import { MembershipRepository } from './membershipRepository.js'
import { WorkspaceRepository } from './workspaceRepository.js'
import { WorkspaceAccessService } from './workspaceAccess.js'
import { hashToken } from '../../lib/tokenGenerator.js'
import { MembershipExistsError } from './membershipService.js'
import type { AccountRepository } from '../accounts/accountRepository.js'
import { WorkspaceNotFoundError } from './workspaceService.js'
import { AuditLogService } from '../audit/auditLogService.js'

export class WorkspaceInvitationService {
  private readonly access: WorkspaceAccessService
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly accountRepository: AccountRepository,
    private readonly auditLogService: AuditLogService,
  ) {
    this.access = new WorkspaceAccessService(workspaceRepository, membershipRepository)
  }

  async sendInvitation(requestorId: string, workspaceId: string, email: string): Promise<{ token: string }> {
    await this.access.assertAdminOrOwner(requestorId, workspaceId)
    const normalizedEmail = email.trim().toLowerCase()
    const existingInvitation = await this.invitationRepository.findPendingByEmail(workspaceId, normalizedEmail)
    if (existingInvitation) {
      throw new InvitationExistsError()
    }
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await this.invitationRepository.create({
      workspaceId,
      email: normalizedEmail,
      tokenHash: hashToken(token),
      invitedBy: requestorId,
      expiresAt,
    })
    return { token }
  }

  async cancelInvitation(requestorId: string, workspaceId: string, invitationId: string) {
    await this.access.assertAdminOrOwner(requestorId, workspaceId)
    const invitation = await this.invitationRepository.findById(invitationId)
    if (!invitation || invitation.workspaceId !== workspaceId || invitation.status !== 'pending') {
      throw new InvitationNotFoundError()
    }
    await this.invitationRepository.markCancelled(invitationId)
  }

  async resendInvitation(requestorId: string, workspaceId: string, invitationId: string): Promise<InvitationEntity> {
    await this.access.assertAdminOrOwner(requestorId, workspaceId)
    const invitation = await this.invitationRepository.findById(invitationId)
    if (!invitation || invitation.workspaceId !== workspaceId || invitation.status !== 'pending') {
      throw new InvitationNotFoundError()
    }
    return this.invitationRepository.incrementResend(invitationId)
  }

  async acceptInvitation(token: string, accountId: string) {
    const invitation = await this.invitationRepository.findByTokenHash(hashToken(token))
    if (!invitation || invitation.status !== 'pending') {
      throw new InvitationNotFoundError()
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new InvitationExpiredError()
    }
    const account = await this.accountRepository.findById(accountId)
    if (!account) {
      throw new InvitationAcceptanceError('Account not found')
    }
    if (account.email.toLowerCase() !== invitation.email) {
      throw new InvitationAcceptanceError('Email mismatch')
    }
    const workspace = await this.workspaceRepository.findByIdIncludingDeleted(invitation.workspaceId)
    if (!workspace) {
      throw new WorkspaceNotFoundError()
    }
    const existingMembership = await this.membershipRepository.findByWorkspaceAndAccount(
      invitation.workspaceId,
      accountId,
    )
    if (existingMembership) {
      throw new MembershipExistsError()
    }
    const membership = await this.membershipRepository.create({
      workspaceId: invitation.workspaceId,
      accountId,
      role: 'member',
      status: 'active',
    })
    await this.auditLogService.record({
      workspaceId: invitation.workspaceId,
      actor: { type: 'membership', membershipId: membership.id },
      action: 'membership.added',
      entityType: 'membership',
      entityId: membership.id,
      metadata: {
        accountId,
        role: membership.role,
        status: membership.status,
        source: 'invitation_acceptance',
        invitationId: invitation.id,
      },
    })
    await this.invitationRepository.markAccepted(invitation.id)
  }
}

export class InvitationExistsError extends Error {
  constructor() {
    super('Invitation already exists for this email')
    this.name = 'InvitationExistsError'
  }
}

export class InvitationNotFoundError extends Error {
  constructor() {
    super('Invitation not found')
    this.name = 'InvitationNotFoundError'
  }
}

export class InvitationExpiredError extends Error {
  constructor() {
    super('Invitation expired')
    this.name = 'InvitationExpiredError'
  }
}

export class InvitationAcceptanceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvitationAcceptanceError'
  }
}
