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
import { DocumentService } from '../../../server/src/modules/documents/documentService'
import { DocumentAccessService } from '../../../server/src/modules/documents/documentAccessService'
import {
  ShareLinkService,
  ShareLinkPasswordRequiredError,
  ShareLinkEditNotAllowedError,
} from '../../../server/src/modules/documents/shareLinkService'
import { DocumentShareLinkRepository } from '../../../server/src/modules/documents/documentShareLinkRepository'
import { DocumentShareLinkSessionRepository } from '../../../server/src/modules/documents/documentShareLinkSessionRepository'
import { ExternalCollaboratorRepository } from '../../../server/src/modules/documents/externalCollaboratorRepository'
import { MembershipAccessDeniedError } from '../../../server/src/modules/workspaces/membershipService'

const today = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()

describe('ShareLinkService', () => {
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let accountService: AccountService
  let workspaceService: WorkspaceService
  let membershipRepository: MembershipRepository
  let documentService: DocumentService
  let shareLinkService: ShareLinkService
  let documentId: string
  let workspaceId: string
  let ownerAccountId: string
  let adminAccountId: string
  let memberAccountId: string
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
    const shareLinkRepository = new DocumentShareLinkRepository(prisma)
    const sessionRepository = new DocumentShareLinkSessionRepository(prisma)
    const collaboratorRepository = new ExternalCollaboratorRepository(prisma)
    const documentAccessService = new DocumentAccessService(documentRepository, permissionRepository, membershipRepository)
    documentService = new DocumentService(documentRepository, revisionRepository, folderRepository, membershipRepository, workspaceAccess)
    shareLinkService = new ShareLinkService(
      documentRepository,
      shareLinkRepository,
      sessionRepository,
      collaboratorRepository,
      membershipRepository,
      documentAccessService,
    )

    const owner = await accountService.registerAccount({ email: 'owner+share@example.com', password: 'Sup3rSecure!' })
    ownerAccountId = owner.id
    const workspace = await workspaceService.create(ownerAccountId, { name: 'Share Workspace' })
    workspaceId = workspace.id
    await membershipRepository.create({ workspaceId, accountId: owner.id, role: 'owner', status: 'active' })

    const admin = await accountService.registerAccount({ email: 'admin+share@example.com', password: 'Sup3rSecure!' })
    adminAccountId = admin.id
    await membershipRepository.create({ workspaceId, accountId: admin.id, role: 'admin', status: 'active' })

    const member = await accountService.registerAccount({ email: 'member+share@example.com', password: 'Sup3rSecure!' })
    memberAccountId = member.id
    const memberMembership = await membershipRepository.create({ workspaceId, accountId: member.id, role: 'member', status: 'active' })
    memberMembershipId = memberMembership.id

    const document = await documentService.createDocument(ownerAccountId, workspaceId, { title: 'Shared Doc' })
    documentId = document.id
  })

  afterEach(async () => {
    await prisma.$disconnect()
    dbHandle?.cleanup()
    dbHandle = null
  })

  it('creates, lists, and revokes share links', async () => {
    const { shareLink, token } = await shareLinkService.create(ownerAccountId, workspaceId, documentId, {
      accessLevel: 'viewer',
      expiresAt: today(),
    })
    expect(token.length).toBeGreaterThanOrEqual(24)
    const list = await shareLinkService.list(ownerAccountId, workspaceId, documentId)
    expect(list).toHaveLength(1)
    expect(list[0].allowExternalEdit).toBe(false)

    await shareLinkService.revoke(ownerAccountId, workspaceId, shareLink.id)
    const after = await shareLinkService.list(ownerAccountId, workspaceId, documentId)
    expect(after[0].revokedAt).not.toBeNull()
  })

  it('requires admin/owner to manage share links', async () => {
    await expect(() =>
      shareLinkService.create(memberAccountId, workspaceId, documentId, { accessLevel: 'viewer' }),
    ).rejects.toBeInstanceOf(MembershipAccessDeniedError)
  })

  it('validates token with password', async () => {
    const { token } = await shareLinkService.create(ownerAccountId, workspaceId, documentId, {
      accessLevel: 'commenter',
      password: 'Secret123',
    })

    await expect(() => shareLinkService.resolveToken(token, {})).rejects.toBeInstanceOf(ShareLinkPasswordRequiredError)
    const access = await shareLinkService.resolveToken(token, { password: 'Secret123' })
    expect(access.accessLevel).toBe('commenter')
  })

  it('rejects expired or revoked tokens', async () => {
    const { shareLink, token } = await shareLinkService.create(ownerAccountId, workspaceId, documentId, {
      accessLevel: 'viewer',
      expiresAt: today(),
    })
    // simulate expiration
    await prisma.documentShareLink.update({ where: { id: shareLink.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    await expect(() => shareLinkService.resolveToken(token, {})).rejects.toBeInstanceOf(Error)
    const { shareLink: shareLink2, token: token2 } = await shareLinkService.create(ownerAccountId, workspaceId, documentId, { accessLevel: 'viewer' })
    await shareLinkService.revoke(ownerAccountId, workspaceId, shareLink2.id)
    await expect(() => shareLinkService.resolveToken(token2, {})).rejects.toBeInstanceOf(Error)
  })

  it('updates allowExternalEdit flag and accepts guests when enabled', async () => {
    const { shareLink } = await shareLinkService.create(ownerAccountId, workspaceId, documentId, {
      accessLevel: 'viewer',
    })
    const updated = await shareLinkService.updateOptions(ownerAccountId, workspaceId, shareLink.id, { allowExternalEdit: true })
    expect(updated.allowExternalEdit).toBe(true)

    const acceptance = await shareLinkService.acceptGuest(shareLink.token, {
      email: 'guest@example.com',
      displayName: 'Guest One',
    })
    expect(acceptance.sessionToken).toBeDefined()
    await shareLinkService.revokeGuestSessions(ownerAccountId, workspaceId, shareLink.id)
  })

  it('rejects guest acceptance when external edit disabled', async () => {
    const { shareLink } = await shareLinkService.create(ownerAccountId, workspaceId, documentId, {
      accessLevel: 'viewer',
    })
    await expect(() =>
      shareLinkService.acceptGuest(shareLink.token, { email: 'guest2@example.com', displayName: 'Guest Two' }),
    ).rejects.toBeInstanceOf(ShareLinkEditNotAllowedError)
  })
})
