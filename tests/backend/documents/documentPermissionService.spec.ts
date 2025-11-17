import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { createPrismaClient } from '../../../server/src/lib/prismaClient'
import { createTestDatabase } from '../support/testDatabase'
import { PrismaAccountRepository } from '../../../server/src/modules/accounts/accountRepository'
import { AccountService } from '../../../server/src/modules/accounts/accountService'
import { WorkspaceRepository } from '../../../server/src/modules/workspaces/workspaceRepository'
import { WorkspaceService } from '../../../server/src/modules/workspaces/workspaceService'
import { MembershipRepository } from '../../../server/src/modules/workspaces/membershipRepository'
import { WorkspaceAccessService } from '../../../server/src/modules/workspaces/workspaceAccess'
import { FolderRepository } from '../../../server/src/modules/documents/folderRepository'
import { DocumentRepository } from '../../../server/src/modules/documents/documentRepository'
import { DocumentRevisionRepository } from '../../../server/src/modules/documents/documentRevisionRepository'
import { DocumentService } from '../../../server/src/modules/documents/documentService'
import { DocumentPermissionRepository } from '../../../server/src/modules/documents/documentPermissionRepository'
import { DocumentPermissionService } from '../../../server/src/modules/documents/documentPermissionService'
import { DocumentAccessService, DocumentAccessDeniedError } from '../../../server/src/modules/documents/documentAccessService'
import { MembershipAccessDeniedError } from '../../../server/src/modules/workspaces/membershipService'

describe('DocumentPermissionService', () => {
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let accountService: AccountService
  let workspaceService: WorkspaceService
  let membershipRepository: MembershipRepository
  let documentService: DocumentService
  let documentPermissionService: DocumentPermissionService
  let documentAccessService: DocumentAccessService
  let ownerAccountId: string
  let memberAccountId: string
  let adminAccountId: string
  let workspaceId: string
  let memberMembershipId: string
  let adminMembershipId: string
  let documentId: string

  beforeEach(async () => {
    dbHandle = createTestDatabase()
    prisma = createPrismaClient({ datasourceUrl: dbHandle.url })
    const accountRepository = new PrismaAccountRepository(prisma)
    accountService = new AccountService(accountRepository)
    const workspaceRepository = new WorkspaceRepository(prisma)
    workspaceService = new WorkspaceService(workspaceRepository)
    membershipRepository = new MembershipRepository(prisma)
    const workspaceAccess = new WorkspaceAccessService(workspaceRepository, membershipRepository)
    const folderRepository = new FolderRepository(prisma)
    const documentRepository = new DocumentRepository(prisma)
    const revisionRepository = new DocumentRevisionRepository(prisma)
    const permissionRepository = new DocumentPermissionRepository(prisma)
    documentAccessService = new DocumentAccessService(documentRepository, permissionRepository, membershipRepository)
    documentPermissionService = new DocumentPermissionService(
      documentRepository,
      permissionRepository,
      membershipRepository,
      documentAccessService,
    )
    documentService = new DocumentService(documentRepository, revisionRepository, folderRepository, membershipRepository, workspaceAccess)

    const owner = await accountService.registerAccount({ email: 'owner@example.com', password: 'Sup3rSecure!' })
    ownerAccountId = owner.id
    const workspace = await workspaceService.create(ownerAccountId, { name: 'Docs' })
    workspaceId = workspace.id
    const ownerMembership = await membershipRepository.create({
      workspaceId,
      accountId: ownerAccountId,
      role: 'owner',
      status: 'active',
    })

    const admin = await accountService.registerAccount({ email: 'admin@example.com', password: 'Sup3rSecure!' })
    adminAccountId = admin.id
    const adminMembership = await membershipRepository.create({
      workspaceId,
      accountId: adminAccountId,
      role: 'admin',
      status: 'active',
    })
    adminMembershipId = adminMembership.id

    const member = await accountService.registerAccount({ email: 'member@example.com', password: 'Sup3rSecure!' })
    memberAccountId = member.id
    const memberMembership = await membershipRepository.create({
      workspaceId,
      accountId: memberAccountId,
      role: 'member',
      status: 'active',
    })
    memberMembershipId = memberMembership.id

    const document = await documentService.createDocument(ownerAccountId, workspaceId, { title: 'Spec Doc' })
    documentId = document.id
  })

  afterEach(async () => {
    await prisma.$disconnect()
    dbHandle?.cleanup()
    dbHandle = null
  })

  it('updates workspace default access and lists permissions', async () => {
    const initial = await documentPermissionService.listPermissions(ownerAccountId, workspaceId, documentId)
    expect(initial.workspaceDefaultAccess).toBe('none')
    expect(initial.permissions).toHaveLength(0)

    const updated = await documentPermissionService.updateWorkspaceAccess(ownerAccountId, workspaceId, documentId, {
      defaultAccess: 'viewer',
    })
    expect(updated.workspaceDefaultAccess).toBe('viewer')

    const listed = await documentPermissionService.listPermissions(ownerAccountId, workspaceId, documentId)
    expect(listed.workspaceDefaultAccess).toBe('viewer')
  })

  it('grants and revokes membership permissions', async () => {
    const permission = await documentPermissionService.grantPermission(ownerAccountId, workspaceId, documentId, {
      principalType: 'membership',
      principalId: memberMembershipId,
      role: 'editor',
    })
    expect(permission.role).toBe('editor')

    let listed = await documentPermissionService.listPermissions(ownerAccountId, workspaceId, documentId)
    expect(listed.permissions).toHaveLength(1)

    await documentPermissionService.revokePermission(ownerAccountId, workspaceId, documentId, permission.id)
    listed = await documentPermissionService.listPermissions(ownerAccountId, workspaceId, documentId)
    expect(listed.permissions).toHaveLength(0)
  })

  it('prevents non-managers from updating permissions', async () => {
    await expect(() =>
      documentPermissionService.updateWorkspaceAccess(memberAccountId, workspaceId, documentId, {
        defaultAccess: 'viewer',
      }),
    ).rejects.toBeInstanceOf(MembershipAccessDeniedError)

    await expect(() =>
      documentPermissionService.grantPermission(memberAccountId, workspaceId, documentId, {
        principalType: 'membership',
        principalId: memberMembershipId,
        role: 'viewer',
      }),
    ).rejects.toBeInstanceOf(MembershipAccessDeniedError)
  })

  it('allows members with view rights to read summary', async () => {
    await documentService.updateDocument(ownerAccountId, workspaceId, documentId, { visibility: 'workspace' })
    await documentPermissionService.updateWorkspaceAccess(ownerAccountId, workspaceId, documentId, { defaultAccess: 'viewer' })
    const summary = await documentPermissionService.getSummary(memberAccountId, workspaceId, documentId)
    expect(summary.permissions).toHaveLength(0)

    await documentPermissionService.updateWorkspaceAccess(ownerAccountId, workspaceId, documentId, { defaultAccess: 'none' })
    await expect(() => documentPermissionService.getSummary(memberAccountId, workspaceId, documentId)).rejects.toBeInstanceOf(
      DocumentAccessDeniedError,
    )
  })
})
