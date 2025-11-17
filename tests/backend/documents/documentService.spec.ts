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
import { DocumentService, DocumentSlugConflictError } from '../../../server/src/modules/documents/documentService'

describe('DocumentService', () => {
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let accountService: AccountService
  let workspaceService: WorkspaceService
  let documentService: DocumentService
  let membershipRepository: MembershipRepository
  let ownerAccountId: string
  let workspaceId: string

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
    documentService = new DocumentService(
      documentRepository,
      revisionRepository,
      folderRepository,
      membershipRepository,
      workspaceAccess,
    )

    const owner = await accountService.registerAccount({ email: 'owner@example.com', password: 'Sup3rSecure!' })
    ownerAccountId = owner.id
    const workspace = await workspaceService.create(ownerAccountId, { name: 'Docs' })
    workspaceId = workspace.id
    await membershipRepository.create({
      workspaceId,
      accountId: ownerAccountId,
      role: 'owner',
      status: 'active',
    })
  })

  afterEach(async () => {
    await prisma.$disconnect()
    dbHandle?.cleanup()
    dbHandle = null
  })

  it('creates documents with generated slugs and initial revisions', async () => {
    const document = await documentService.createDocument(ownerAccountId, workspaceId, {
      title: 'Project Plan',
      initialRevision: { content: { type: 'doc', content: [] } },
    })
    expect(document.slug).toMatch(/^project-plan/)

    const latest = await documentService.getLatestRevision(ownerAccountId, document.id)
    expect(latest.revision.version).toBe(1)
    expect(latest.document.title).toBe('Project Plan')
  })

  it('updates document metadata and folder assignments', async () => {
    const doc = await documentService.createDocument(ownerAccountId, workspaceId, {
      title: 'Temporary',
    })
    const destinationFolder = await prisma.folder.create({
      data: {
        workspaceId,
        name: 'Reports',
        pathCache: 'Reports',
      },
    })

    const updated = await documentService.updateDocument(ownerAccountId, workspaceId, doc.id, {
      title: 'Updated Title',
      folderId: destinationFolder.id,
      visibility: 'workspace',
      summary: 'Short description',
    })
    expect(updated.title).toBe('Updated Title')
    expect(updated.folderId).toBe(destinationFolder.id)
    expect(updated.visibility).toBe('workspace')
  })

  it('appends revisions sequentially and enforces slug uniqueness', async () => {
    const doc = await documentService.createDocument(ownerAccountId, workspaceId, {
      title: 'Spec Sheet',
    })
    await documentService.appendRevision(ownerAccountId, doc.id, { content: { type: 'doc', content: [] } })
    await documentService.appendRevision(ownerAccountId, doc.id, { content: [] })

    const latest = await documentService.getLatestRevision(ownerAccountId, doc.id)
    expect(latest.revision.version).toBe(2)

    await expect(
      documentService.createDocument(ownerAccountId, workspaceId, {
        title: 'Custom Slug',
        slug: 'spec-sheet',
      }),
    ).rejects.toBeInstanceOf(DocumentSlugConflictError)
  })

  it('lists documents with folder filters', async () => {
    const rootDoc = await documentService.createDocument(ownerAccountId, workspaceId, { title: 'Root Doc' })
    const folder = await prisma.folder.create({
      data: {
        workspaceId,
        name: 'Tasks',
        pathCache: 'Tasks',
      },
    })
    await documentService.createDocument(ownerAccountId, workspaceId, { title: 'Folder Doc', folderId: folder.id })

    const filtered = await documentService.listWorkspaceDocuments(ownerAccountId, workspaceId, { folderId: folder.id })
    expect(filtered.documents).toHaveLength(1)
    expect(filtered.documents[0].title).toBe('Folder Doc')

    const rootOnly = await documentService.listWorkspaceDocuments(ownerAccountId, workspaceId, { folderId: null })
    expect(rootOnly.documents.some((doc) => doc.id === rootDoc.id)).toBe(true)
  })
})
