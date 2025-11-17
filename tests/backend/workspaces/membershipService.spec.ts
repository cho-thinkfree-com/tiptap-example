import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { createPrismaClient } from '../../../server/src/lib/prismaClient'
import { PrismaAccountRepository } from '../../../server/src/modules/accounts/accountRepository'
import { AccountService } from '../../../server/src/modules/accounts/accountService'
import { WorkspaceRepository } from '../../../server/src/modules/workspaces/workspaceRepository'
import { WorkspaceService } from '../../../server/src/modules/workspaces/workspaceService'
import { MembershipRepository } from '../../../server/src/modules/workspaces/membershipRepository'
import {
  MembershipAccessDeniedError,
  MembershipExistsError,
  MembershipNotFoundError,
  MembershipService,
  OwnerDemotionError,
} from '../../../server/src/modules/workspaces/membershipService'
import { createTestDatabase } from '../support/testDatabase'

describe('MembershipService', () => {
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let accountService: AccountService
  let workspaceService: WorkspaceService
  let membershipRepository: MembershipRepository
  let membershipService: MembershipService
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
    membershipService = new MembershipService(membershipRepository, workspaceRepository)

    const owner = await accountService.registerAccount({ email: 'owner@example.com', password: 'Sup3rSecure!' })
    ownerId = owner.id
    const workspace = await workspaceService.create(ownerId, { name: 'Team Space' })
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

  it('lists members with owner first', async () => {
    const newMember = await accountService.registerAccount({ email: 'member@example.com', password: 'Sup3rSecure!' })
    await membershipService.addMember(ownerId, workspaceId, {
      accountId: newMember.id,
      status: 'active',
      displayName: 'Member One',
    })

    const list = await membershipService.listMembers(ownerId, workspaceId)
    expect(list).toHaveLength(2)
    expect(list[0].role).toBe('owner')
    expect(list[1].displayName).toBe('Member One')
  })

  it('prevents duplicate memberships', async () => {
    const newMember = await accountService.registerAccount({ email: 'dup@example.com', password: 'Sup3rSecure!' })
    await membershipService.addMember(ownerId, workspaceId, { accountId: newMember.id })
    await expect(membershipService.addMember(ownerId, workspaceId, { accountId: newMember.id })).rejects.toBeInstanceOf(
      MembershipExistsError,
    )
  })

  it('allows reactivating removed members', async () => {
    const newMember = await accountService.registerAccount({ email: 'reactivate@example.com', password: 'Sup3rSecure!' })
    await membershipService.addMember(ownerId, workspaceId, { accountId: newMember.id, status: 'active' })
    await membershipService.removeMember(ownerId, workspaceId, newMember.id)
    const back = await membershipService.addMember(ownerId, workspaceId, {
      accountId: newMember.id,
      status: 'active',
      preferredLocale: 'ko-KR',
    })
    expect(back.status).toBe('active')
    expect(back.preferredLocale).toBe('ko-KR')
  })

  it('enforces admin-only operations', async () => {
    const newMember = await accountService.registerAccount({ email: 'member2@example.com', password: 'Sup3rSecure!' })
    await membershipService.addMember(ownerId, workspaceId, { accountId: newMember.id, status: 'active' })

    await expect(membershipService.addMember(newMember.id, workspaceId, { accountId: ownerId })).rejects.toBeInstanceOf(
      MembershipAccessDeniedError,
    )
    await expect(
      membershipService.updateMember(newMember.id, workspaceId, newMember.id, { displayName: 'Hack' }),
    ).rejects.toBeInstanceOf(MembershipAccessDeniedError)
  })

  it('allows owner to update member role but prevents owner demotion', async () => {
    const newMember = await accountService.registerAccount({ email: 'admin@example.com', password: 'Sup3rSecure!' })
    await membershipService.addMember(ownerId, workspaceId, { accountId: newMember.id, status: 'active' })
    const updated = await membershipService.updateMember(ownerId, workspaceId, newMember.id, { role: 'admin' })
    expect(updated.role).toBe('admin')

    await expect(
      membershipService.updateMember(ownerId, workspaceId, ownerId, { role: 'admin' }),
    ).rejects.toBeInstanceOf(OwnerDemotionError)
  })

  it('removes members and blocks removing owner', async () => {
    const newMember = await accountService.registerAccount({ email: 'remove@example.com', password: 'Sup3rSecure!' })
    await membershipService.addMember(ownerId, workspaceId, { accountId: newMember.id, status: 'active' })
    await membershipService.removeMember(ownerId, workspaceId, newMember.id)
    await expect(membershipService.listMembers(ownerId, workspaceId)).resolves.toHaveLength(1)

    await expect(membershipService.removeMember(ownerId, workspaceId, ownerId)).rejects.toBeInstanceOf(
      OwnerDemotionError,
    )
  })

  it('throws when membership missing', async () => {
    const someAccount = await accountService.registerAccount({ email: 'none@example.com', password: 'Sup3rSecure!' })
    await expect(membershipService.updateMember(ownerId, workspaceId, someAccount.id, {})).rejects.toBeInstanceOf(
      MembershipNotFoundError,
    )
  })

  it('transfers ownership to another active member', async () => {
    const admin = await accountService.registerAccount({ email: 'admin2@example.com', password: 'Sup3rSecure!' })
    await membershipService.addMember(ownerId, workspaceId, { accountId: admin.id, status: 'active', role: 'admin' })

    await membershipService.transferOwnership(ownerId, workspaceId, admin.id)

    const members = await membershipService.listMembers(admin.id, workspaceId)
    expect(members.find((m) => m.accountId === admin.id)?.role).toBe('owner')
    const workspace = await workspaceService.getById(workspaceId)
    expect(workspace?.ownerAccountId).toBe(admin.id)
  })

  it('allows admin to change member role and members to leave', async () => {
    const member = await accountService.registerAccount({ email: 'member3@example.com', password: 'Sup3rSecure!' })
    await membershipService.addMember(ownerId, workspaceId, { accountId: member.id, status: 'active' })

    await membershipService.changeRole(ownerId, workspaceId, member.id, 'admin')
    let list = await membershipService.listMembers(ownerId, workspaceId)
    expect(list.find((m) => m.accountId === member.id)?.role).toBe('admin')

    await membershipService.leaveWorkspace(member.id, workspaceId)
    list = await membershipService.listMembers(ownerId, workspaceId)
    expect(list.some((m) => m.accountId === member.id)).toBe(false)
  })
})
