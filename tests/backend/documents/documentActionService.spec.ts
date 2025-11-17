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
import { DocumentPermissionRepository } from '../../../server/src/modules/documents/documentPermissionRepository'
import { DocumentService, DocumentNotFoundError } from '../../../server/src/modules/documents/documentService'
import { DocumentPermissionService } from '../../../server/src/modules/documents/documentPermissionService'
import { DocumentAccessService, DocumentAccessDeniedError } from '../../../server/src/modules/documents/documentAccessService'
import { DocumentActionService, DocumentUpdateConflictError } from '../../../server/src/modules/documents/documentActionService'
import type { DocumentPlanLimitService } from '../../../server/src/modules/documents/planLimitService'
import { MembershipAccessDeniedError } from '../../../server/src/modules/workspaces/membershipService'

class PlanLimitStub implements DocumentPlanLimitService {
  createCalls = 0
  editCalls = 0
  async assertDocumentCreateAllowed(): Promise<void> {
    this.createCalls++
  }
  async assertDocumentEditAllowed(): Promise<void> {
    this.editCalls++
  }
}

describe('DocumentActionService', () => {
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let accountService: AccountService
  let workspaceService: WorkspaceService
  let membershipRepository: MembershipRepository
  let documentService: DocumentService
  let documentActionService: DocumentActionService
  let documentPermissionService: DocumentPermissionService
  let documentAccessService: DocumentAccessService
  let planStub: PlanLimitStub

  let ownerAccountId: string
  let adminAccountId: string
  let memberAccountId: string
  let workspaceId: string
  let documentId: string
  let adminMembershipId: string
  let memberMembershipId: string

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
    planStub = new PlanLimitStub()
    documentService = new DocumentService(
      documentRepository,
      revisionRepository,
      folderRepository,
      membershipRepository,
      workspaceAccess,
      planStub,
    )
    documentPermissionService = new DocumentPermissionService(
      documentRepository,
      permissionRepository,
      membershipRepository,
      documentAccessService,
    )
    documentActionService = new DocumentActionService(
      documentRepository,
      revisionRepository,
      folderRepository,
      documentAccessService,
      planStub,
    )

    const owner = await accountService.registerAccount({ email: 'owner+action@example.com', password: 'Sup3rSecure!' })
    ownerAccountId = owner.id
    const workspace = await workspaceService.create(ownerAccountId, { name: 'Docs D3' })
    workspaceId = workspace.id
    const ownerMembership = await membershipRepository.create({
      workspaceId,
      accountId: ownerAccountId,
      role: 'owner',
      status: 'active',
    })

    const admin = await accountService.registerAccount({ email: 'admin+action@example.com', password: 'Sup3rSecure!' })
    adminAccountId = admin.id
    const adminMembership = await membershipRepository.create({
      workspaceId,
      accountId: adminAccountId,
      role: 'admin',
      status: 'active',
    })
    adminMembershipId = adminMembership.id

    const member = await accountService.registerAccount({ email: 'member+action@example.com', password: 'Sup3rSecure!' })
    memberAccountId = member.id
    const memberMembership = await membershipRepository.create({
      workspaceId,
      accountId: memberAccountId,
      role: 'member',
      status: 'active',
    })
    memberMembershipId = memberMembership.id

    const document = await documentService.createDocument(ownerAccountId, workspaceId, {
      title: 'Specs',
      initialRevision: { content: { type: 'doc', content: [] } },
    })
    documentId = document.id
  })

  afterEach(async () => {
    await prisma.$disconnect()
    dbHandle?.cleanup()
    dbHandle = null
  })

  it('returns document with latest revision for viewer', async () => {
    await documentService.updateDocument(ownerAccountId, workspaceId, documentId, { visibility: 'workspace' })
    await documentPermissionService.updateWorkspaceAccess(ownerAccountId, workspaceId, documentId, { defaultAccess: 'viewer' })
    const result = await documentActionService.getDocument(memberAccountId, workspaceId, documentId)
    expect(result.document.id).toBe(documentId)
    expect(result.revision.version).toBe(1)
  })

  it('updates document using optimistic locking and triggers plan hook', async () => {
    const before = await documentActionService.getDocument(ownerAccountId, workspaceId, documentId)
    const updated = await documentActionService.updateDocument(ownerAccountId, workspaceId, documentId, {
      title: 'Updated Title',
      expectedUpdatedAt: before.document.updatedAt.toISOString(),
    })
    expect(updated.title).toBe('Updated Title')
    expect(planStub.editCalls).toBeGreaterThan(0)
  })

  it('rejects stale updates with conflict error', async () => {
    const before = await documentActionService.getDocument(ownerAccountId, workspaceId, documentId)
    await documentActionService.updateDocument(ownerAccountId, workspaceId, documentId, {
      title: 'First Update',
      expectedUpdatedAt: before.document.updatedAt.toISOString(),
    })
    await expect(() =>
      documentActionService.updateDocument(ownerAccountId, workspaceId, documentId, {
        title: 'Second Update',
        expectedUpdatedAt: before.document.updatedAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(DocumentUpdateConflictError)
  })

  it('prevents member delete but allows admin', async () => {
    await expect(() =>
      documentActionService.deleteDocument(memberAccountId, workspaceId, documentId, {}),
    ).rejects.toBeInstanceOf(MembershipAccessDeniedError)

    await documentActionService.deleteDocument(adminAccountId, workspaceId, documentId, {})
    await expect(() => documentActionService.getDocument(memberAccountId, workspaceId, documentId)).rejects.toBeInstanceOf(
      DocumentNotFoundError,
    )
  })

  it('lists revisions for viewers', async () => {
    await documentService.appendRevision(ownerAccountId, documentId, { content: { type: 'doc', content: [] } })
    await documentService.updateDocument(ownerAccountId, workspaceId, documentId, { visibility: 'workspace' })
    await documentPermissionService.updateWorkspaceAccess(ownerAccountId, workspaceId, documentId, { defaultAccess: 'viewer' })
    const revisions = await documentActionService.listRevisions(memberAccountId, workspaceId, documentId, 10)
    expect(revisions).toHaveLength(2)
    expect(revisions[0].version).toBe(2)
  })
})
