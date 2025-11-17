import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { createPrismaClient } from '../../../server/src/lib/prismaClient'
import { PrismaAccountRepository } from '../../../server/src/modules/accounts/accountRepository'
import { AccountService } from '../../../server/src/modules/accounts/accountService'
import { WorkspaceRepository } from '../../../server/src/modules/workspaces/workspaceRepository'
import { WorkspaceService } from '../../../server/src/modules/workspaces/workspaceService'
import { MembershipRepository } from '../../../server/src/modules/workspaces/membershipRepository'
import { WorkspaceInvitationService, InvitationExistsError, InvitationAcceptanceError } from '../../../server/src/modules/workspaces/invitationService'
import { InvitationRepository } from '../../../server/src/modules/workspaces/invitationRepository'
import { createTestDatabase } from '../support/testDatabase'
import { hashToken } from '../../../server/src/lib/tokenGenerator'

describe('WorkspaceInvitationService', () => {
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let accountService: AccountService
  let workspaceService: WorkspaceService
  let invitationService: WorkspaceInvitationService
  let membershipRepository: MembershipRepository
  let ownerId: string
  let workspaceId: string

  beforeEach(async () => {
    dbHandle = createTestDatabase()
    prisma = createPrismaClient({ datasourceUrl: dbHandle.url })
    const accountRepository = new PrismaAccountRepository(prisma)
    accountService = new AccountService(accountRepository)
    const workspaceRepository = new WorkspaceRepository(prisma)
    workspaceService = new WorkspaceService(workspaceRepository)
    membershipRepository = new MembershipRepository(prisma)
    const invitationRepository = new InvitationRepository(prisma)
    invitationService = new WorkspaceInvitationService(
      invitationRepository,
      membershipRepository,
      workspaceRepository,
      accountRepository,
    )

    const owner = await accountService.registerAccount({ email: 'owner@example.com', password: 'Sup3rSecure!' })
    ownerId = owner.id
    const workspace = await workspaceService.create(ownerId, { name: 'Invite Space' })
    workspaceId = workspace.id
    await membershipRepository.create({
      workspaceId,
      accountId: ownerId,
      role: 'owner',
      status: 'active',
    })
  })

  afterEach(async () => {
    await prisma.$disconnect()
    dbHandle?.cleanup()
    dbHandle = null
  })

  it('sends and accepts invitations', async () => {
    const invitee = await accountService.registerAccount({ email: 'invitee@example.com', password: 'Sup3rSecure!' })
    const { token } = await invitationService.sendInvitation(ownerId, workspaceId, 'invitee@example.com')
    await invitationService.acceptInvitation(token, invitee.id)

    const members = await membershipRepository.list(workspaceId)
    expect(members.some((m) => m.accountId === invitee.id)).toBe(true)
  })

  it('prevents duplicate invitations and mismatched acceptance', async () => {
    await invitationService.sendInvitation(ownerId, workspaceId, 'dup@example.com')
    await expect(invitationService.sendInvitation(ownerId, workspaceId, 'dup@example.com')).rejects.toBeInstanceOf(
      InvitationExistsError,
    )

    const other = await accountService.registerAccount({ email: 'other@example.com', password: 'Sup3rSecure!' })
    const { token } = await invitationService.sendInvitation(ownerId, workspaceId, 'accept@example.com')
    await expect(invitationService.acceptInvitation(token, other.id)).rejects.toBeInstanceOf(InvitationAcceptanceError)
  })

  it('resends and cancels invitations', async () => {
    const invite = await invitationService.sendInvitation(ownerId, workspaceId, 'resend@example.com')
    const repo = new InvitationRepository(prisma)
    const stored = await repo.findByTokenHash(hashToken(invite.token))
    if (stored) {
      await invitationService.resendInvitation(ownerId, workspaceId, stored.id)
      await invitationService.cancelInvitation(ownerId, workspaceId, stored.id)
    }

    const cancelled = stored ? await repo.findById(stored.id) : null
    expect(cancelled?.status).toBe('cancelled')
  })
})
