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
import { DocumentAccessService, DocumentAccessDeniedError } from '../../../server/src/modules/documents/documentAccessService'
import { DocumentPermissionService } from '../../../server/src/modules/documents/documentPermissionService'

describe('DocumentAccessService', () => {
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let accountService: AccountService
  let workspaceService: WorkspaceService
  let membershipRepository: MembershipRepository
  let documentService: DocumentService
  let documentAccessService: DocumentAccessService
  let documentPermissionService: DocumentPermissionService
  let ownerAccountId: string
  let adminAccountId: string
  let memberAccountId: string
  let workspaceId: string
  let ownerMembershipId: string
  let adminMembershipId: string
  let memberMembershipId: string
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

    const owner = await accountService.registerAccount({ email: 'owner2@example.com', password: 'Sup3rSecure!' })
    ownerAccountId = owner.id
    const workspace = await workspaceService.create(ownerAccountId, { name: 'Workspace' })
    workspaceId = workspace.id
    const ownerMembership = await membershipRepository.create({
      workspaceId,
      accountId: ownerAccountId,
      role: 'owner',
      status: 'active',
    })
    ownerMembershipId = ownerMembership.id

    const admin = await accountService.registerAccount({ email: 'admin2@example.com', password: 'Sup3rSecure!' })
    adminAccountId = admin.id
    const adminMembership = await membershipRepository.create({
      workspaceId,
      accountId: adminAccountId,
      role: 'admin',
      status: 'active',
    })
    adminMembershipId = adminMembership.id

    const member = await accountService.registerAccount({ email: 'member2@example.com', password: 'Sup3rSecure!' })
    memberAccountId = member.id
    const memberMembership = await membershipRepository.create({
      workspaceId,
      accountId: memberAccountId,
      role: 'member',
      status: 'active',
    })
    memberMembershipId = memberMembership.id

    const document = await documentService.createDocument(ownerAccountId, workspaceId, { title: 'Access Doc' })
    documentId = document.id
  })

  afterEach(async () => {
    await prisma.$disconnect()
    dbHandle?.cleanup()
    dbHandle = null
  })

  it('enforces private document access until explicit grant', async () => {
    const ownerAccess = await documentAccessService.assertCanView(ownerAccountId, workspaceId, documentId)
    expect(ownerAccess.level).toBe('owner')

    await expect(() => documentAccessService.assertCanView(memberAccountId, workspaceId, documentId)).rejects.toBeInstanceOf(
      DocumentAccessDeniedError,
    )

    await documentPermissionService.grantPermission(ownerAccountId, workspaceId, documentId, {
      principalType: 'membership',
      principalId: memberMembershipId,
      role: 'viewer',
    })
    const memberAccess = await documentAccessService.assertCanView(memberAccountId, workspaceId, documentId)
    expect(memberAccess.level).toBe('viewer')
  })

  it('applies workspace default viewer permissions', async () => {
    await documentService.updateDocument(ownerAccountId, workspaceId, documentId, { visibility: 'workspace' })
    await documentPermissionService.updateWorkspaceAccess(ownerAccountId, workspaceId, documentId, { defaultAccess: 'viewer' })
    const memberAccess = await documentAccessService.assertCanView(memberAccountId, workspaceId, documentId)
    expect(memberAccess.level).toBe('viewer')
  })

  it('restricts default editors to admins when configured', async () => {
    await documentService.updateDocument(ownerAccountId, workspaceId, documentId, { visibility: 'workspace' })
    await documentPermissionService.updateWorkspaceAccess(ownerAccountId, workspaceId, documentId, {
      defaultAccess: 'editor',
      editorsAdminOnly: true,
    })

    const adminAccess = await documentAccessService.assertCanEdit(adminAccountId, workspaceId, documentId)
    expect(adminAccess.level).toBe('editor')
    const memberAccess = await documentAccessService.assertCanView(memberAccountId, workspaceId, documentId)
    expect(memberAccess.level).toBe('viewer')
    await expect(() => documentAccessService.assertCanEdit(memberAccountId, workspaceId, documentId)).rejects.toBeInstanceOf(
      DocumentAccessDeniedError,
    )
  })

  it('upgrades access when ACL grants higher role', async () => {
    await documentPermissionService.grantPermission(ownerAccountId, workspaceId, documentId, {
      principalType: 'membership',
      principalId: memberMembershipId,
      role: 'commenter',
    })
    let access = await documentAccessService.assertCanView(memberAccountId, workspaceId, documentId)
    expect(access.level).toBe('commenter')

    await documentPermissionService.grantPermission(ownerAccountId, workspaceId, documentId, {
      principalType: 'membership',
      principalId: memberMembershipId,
      role: 'editor',
    })
    access = await documentAccessService.assertCanEdit(memberAccountId, workspaceId, documentId)
    expect(access.level).toBe('editor')
  })
})
