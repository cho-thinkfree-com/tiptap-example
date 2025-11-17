import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { createPrismaClient } from '../../../server/src/lib/prismaClient'
import { PrismaAccountRepository } from '../../../server/src/modules/accounts/accountRepository'
import { AccountService } from '../../../server/src/modules/accounts/accountService'
import { WorkspaceRepository } from '../../../server/src/modules/workspaces/workspaceRepository'
import { WorkspaceService } from '../../../server/src/modules/workspaces/workspaceService'
import { MembershipRepository } from '../../../server/src/modules/workspaces/membershipRepository'
import { JoinRequestRepository } from '../../../server/src/modules/workspaces/joinRequestRepository'
import { JoinRequestNotAllowedError, WorkspaceJoinRequestService } from '../../../server/src/modules/workspaces/joinRequestService'
import { MembershipExistsError } from '../../../server/src/modules/workspaces/membershipService'
import { createTestDatabase } from '../support/testDatabase'

describe('WorkspaceJoinRequestService', () => {
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let accountService: AccountService
  let workspaceService: WorkspaceService
  let membershipRepository: MembershipRepository
  let joinRequestService: WorkspaceJoinRequestService
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
    const joinRequestRepository = new JoinRequestRepository(prisma)
    joinRequestService = new WorkspaceJoinRequestService(
      joinRequestRepository,
      membershipRepository,
      workspaceRepository,
      accountRepository,
    )

    const owner = await accountService.registerAccount({ email: 'owner@example.com', password: 'Sup3rSecure!' })
    ownerId = owner.id
    const workspace = await workspaceService.create(ownerId, { name: 'Joinable Space' })
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

  it('blocks join requests for private workspaces', async () => {
    const member = await accountService.registerAccount({ email: 'member@example.com', password: 'Sup3rSecure!' })
    await workspaceService.update(ownerId, workspaceId, { visibility: 'private' })
    await expect(joinRequestService.requestJoin(member.id, workspaceId)).rejects.toBeInstanceOf(
      JoinRequestNotAllowedError,
    )
  })

  it('creates join request and allows owner to approve', async () => {
    const member = await accountService.registerAccount({ email: 'pending@example.com', password: 'Sup3rSecure!' })
    await workspaceService.update(ownerId, workspaceId, { visibility: 'listed' })
    const result = await joinRequestService.requestJoin(member.id, workspaceId, 'Please invite me')
    expect(result.autoApproved).toBe(false)

    const pending = await new JoinRequestRepository(prisma).findPending(workspaceId, member.id)
    expect(pending).not.toBeNull()
    await joinRequestService.approve(ownerId, workspaceId, pending!.id)

    const members = await membershipRepository.list(workspaceId)
    expect(members.some((m) => m.accountId === member.id)).toBe(true)
  })

  it('auto-approves when domain is allowed and prevents duplicate requests', async () => {
    const member = await accountService.registerAccount({ email: 'user@company.com', password: 'Sup3rSecure!' })
    await workspaceService.update(ownerId, workspaceId, { visibility: 'listed' })
    await new WorkspaceRepository(prisma).updateAllowedDomains(workspaceId, ['company.com'])

    const auto = await joinRequestService.requestJoin(member.id, workspaceId)
    expect(auto.autoApproved).toBe(true)

    await expect(joinRequestService.requestJoin(member.id, workspaceId)).rejects.toBeInstanceOf(MembershipExistsError)
  })
})
