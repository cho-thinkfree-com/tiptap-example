import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { createPrismaClient } from '../../../server/src/lib/prismaClient'
import { createTestDatabase } from '../support/testDatabase'
import { WorkspaceRepository } from '../../../server/src/modules/workspaces/workspaceRepository'
import { WorkspaceService } from '../../../server/src/modules/workspaces/workspaceService'
import { FolderRepository } from '../../../server/src/modules/documents/folderRepository'
import {
  FolderService,
  FolderHierarchyError,
  FolderHasChildrenError,
} from '../../../server/src/modules/documents/folderService'
import { DocumentRepository } from '../../../server/src/modules/documents/documentRepository'
import { MembershipRepository } from '../../../server/src/modules/workspaces/membershipRepository'
import { WorkspaceAccessService } from '../../../server/src/modules/workspaces/workspaceAccess'
import { PrismaAccountRepository } from '../../../server/src/modules/accounts/accountRepository'
import { AccountService } from '../../../server/src/modules/accounts/accountService'
import type { DocumentStatus, DocumentVisibility } from '@prisma/client'

const draftStatus: DocumentStatus = 'draft'
const privateVisibility: DocumentVisibility = 'private'

describe('FolderService', () => {
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let accountService: AccountService
  let workspaceService: WorkspaceService
  let folderService: FolderService
  let documentRepository: DocumentRepository
  let membershipRepository: MembershipRepository
  let ownerAccountId: string
  let workspaceId: string
  let ownerMembershipId: string

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
    documentRepository = new DocumentRepository(prisma)
    folderService = new FolderService(folderRepository, workspaceAccess, documentRepository)

    const owner = await accountService.registerAccount({ email: 'owner@example.com', password: 'Sup3rSecure!' })
    ownerAccountId = owner.id
    const workspace = await workspaceService.create(ownerAccountId, { name: 'Docs' })
    workspaceId = workspace.id
    const membership = await membershipRepository.create({
      workspaceId,
      accountId: ownerAccountId,
      role: 'owner',
      status: 'active',
    })
    ownerMembershipId = membership.id
  })

  afterEach(async () => {
    await prisma.$disconnect()
    dbHandle?.cleanup()
    dbHandle = null
  })

  it('creates nested folders and lists them with paths', async () => {
    const root = await folderService.createFolder(ownerAccountId, workspaceId, { name: 'Projects' })
    const child = await folderService.createFolder(ownerAccountId, workspaceId, { name: 'Q1', parentId: root.id })

    const folders = await folderService.listFolders(ownerAccountId, workspaceId)
    expect(folders.map((folder) => folder.pathCache)).toEqual(['Projects', 'Projects/Q1'])
    expect(child.parentId).toBe(root.id)
  })

  it('moves folders, updates descendants, and prevents cycles', async () => {
    const root = await folderService.createFolder(ownerAccountId, workspaceId, { name: 'Product' })
    const target = await folderService.createFolder(ownerAccountId, workspaceId, { name: 'Archive' })
    const child = await folderService.createFolder(ownerAccountId, workspaceId, { name: 'Specs', parentId: root.id })
    const grandchild = await folderService.createFolder(ownerAccountId, workspaceId, { name: 'Old', parentId: child.id })

    await folderService.moveFolder(ownerAccountId, workspaceId, child.id, { parentId: target.id })
    const folders = await folderService.listFolders(ownerAccountId, workspaceId)
    const moved = folders.find((f) => f.id === child.id)
    const movedGrandchild = folders.find((f) => f.id === grandchild.id)
    expect(moved?.pathCache).toBe('Archive/Specs')
    expect(movedGrandchild?.pathCache).toBe('Archive/Specs/Old')

    await expect(
      folderService.moveFolder(ownerAccountId, workspaceId, target.id, { parentId: grandchild.id }),
    ).rejects.toBeInstanceOf(FolderHierarchyError)
  })

  it('reassigns documents when deleting folders and blocks deletion with children', async () => {
    const parent = await folderService.createFolder(ownerAccountId, workspaceId, { name: 'Team' })
    await folderService.createFolder(ownerAccountId, workspaceId, { name: 'HasChildren', parentId: parent.id })

    await expect(folderService.deleteFolder(ownerAccountId, workspaceId, parent.id)).rejects.toBeInstanceOf(
      FolderHasChildrenError,
    )

    const single = await folderService.createFolder(ownerAccountId, workspaceId, { name: 'Lone' })
    const doc = await documentRepository.create({
      workspaceId,
      folderId: single.id,
      ownerMembershipId,
      title: 'Doc One',
      slug: 'doc-one',
      status: draftStatus,
      visibility: privateVisibility,
    })

    await folderService.deleteFolder(ownerAccountId, workspaceId, single.id)
    const updated = await documentRepository.findById(doc.id)
    expect(updated?.folderId).toBeNull()
  })
})
