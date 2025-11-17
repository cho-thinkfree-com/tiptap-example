import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { DocumentShareLinkAccess } from '@prisma/client'
import { Argon2PasswordHasher } from '../../lib/passwordHasher'
import { hashToken } from '../../lib/tokenGenerator'
import { DocumentRepository, type DocumentEntity } from './documentRepository'
import { DocumentShareLinkRepository, type ShareLinkEntity } from './documentShareLinkRepository'
import { DocumentShareLinkSessionRepository } from './documentShareLinkSessionRepository'
import { ExternalCollaboratorRepository } from './externalCollaboratorRepository'
import { MembershipRepository, type MembershipEntity } from '../workspaces/membershipRepository'
import { DocumentAccessService } from './documentAccessService'
import { MembershipAccessDeniedError } from '../workspaces/membershipService'
import { DocumentNotFoundError } from './documentService'

const createSchema = z.object({
  accessLevel: z.enum(['viewer', 'commenter']),
  expiresAt: z.string().datetime().optional(),
  password: z.string().min(6).max(128).optional(),
})

const resolveSchema = z.object({
  password: z.string().optional(),
})

const updateOptionsSchema = z.object({
  allowExternalEdit: z.boolean(),
})

const acceptSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().max(80).optional(),
  password: z.string().optional(),
})

export class ShareLinkPasswordRequiredError extends Error {
  constructor() {
    super('Share link password required or incorrect')
    this.name = 'ShareLinkPasswordRequiredError'
  }
}

export class ShareLinkEditNotAllowedError extends Error {
  constructor() {
    super('Share link does not allow external editing')
    this.name = 'ShareLinkEditNotAllowedError'
  }
}

const GUEST_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export class ShareLinkService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly shareLinkRepository: DocumentShareLinkRepository,
    private readonly sessionRepository: DocumentShareLinkSessionRepository,
    private readonly collaboratorRepository: ExternalCollaboratorRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly documentAccess: DocumentAccessService,
    private readonly passwordHasher = new Argon2PasswordHasher(),
  ) {}

  async list(accountId: string, workspaceId: string, documentId: string) {
    const document = await this.getDocument(documentId, workspaceId)
    await this.assertManager(accountId, workspaceId, document)
    return this.shareLinkRepository.listByDocument(documentId)
  }

  async create(accountId: string, workspaceId: string, documentId: string, payload: unknown) {
    const document = await this.getDocument(documentId, workspaceId)
    const membership = await this.assertManager(accountId, workspaceId, document)
    const input = createSchema.parse(payload)
    if (input.expiresAt && new Date(input.expiresAt) <= new Date()) {
      throw new Error('expiresAt must be in the future')
    }
    const token = randomBytes(24).toString('base64url')
    const passwordHash = input.password ? await this.passwordHasher.hash(input.password) : null
    const shareLink = await this.shareLinkRepository.create({
      documentId,
      token,
      accessLevel: input.accessLevel as DocumentShareLinkAccess,
      passwordHash,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdByMembershipId: membership.id,
    })
    return { shareLink, token }
  }

  async revoke(accountId: string, workspaceId: string, shareLinkId: string) {
    const shareLink = await this.ensureShareLink(shareLinkId)
    const document = await this.getDocument(shareLink.documentId, workspaceId)
    await this.assertManager(accountId, workspaceId, document)
    await this.shareLinkRepository.revoke(shareLinkId)
    await this.sessionRepository.revokeByShareLinkId(shareLinkId)
  }

  async updateOptions(accountId: string, workspaceId: string, shareLinkId: string, payload: unknown) {
    const shareLink = await this.ensureShareLink(shareLinkId)
    const document = await this.getDocument(shareLink.documentId, workspaceId)
    await this.assertManager(accountId, workspaceId, document)
    const input = updateOptionsSchema.parse(payload)
    return this.shareLinkRepository.updateOptions(shareLinkId, { allowExternalEdit: input.allowExternalEdit })
  }

  async resolveToken(token: string, payload: unknown) {
    const result = await this.verifyShareLinkToken(token, resolveSchema.parse(payload))
    return {
      token: result.shareLink.token,
      documentId: result.document.id,
      workspaceId: result.document.workspaceId,
      accessLevel: result.shareLink.accessLevel,
    }
  }

  async acceptGuest(token: string, payload: unknown) {
    const input = acceptSchema.parse(payload)
    const { shareLink, document } = await this.verifyShareLinkToken(token, { password: input.password })
    if (!shareLink.allowExternalEdit) {
      throw new ShareLinkEditNotAllowedError()
    }
    let collaborator = await this.collaboratorRepository.findByEmail(input.email.toLowerCase())
    if (!collaborator) {
      collaborator = await this.collaboratorRepository.create(input.email.toLowerCase(), input.displayName)
    }
    const sessionToken = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + GUEST_SESSION_TTL_MS)
    await this.sessionRepository.create({
      shareLinkId: shareLink.id,
      collaboratorId: collaborator.id,
      tokenHash: hashToken(sessionToken),
      expiresAt,
    })
    return {
      documentId: document.id,
      workspaceId: document.workspaceId,
      accessLevel: shareLink.accessLevel,
      sessionToken,
      expiresAt,
      collaboratorId: collaborator.id,
    }
  }

  async revokeGuestSessions(accountId: string, workspaceId: string, shareLinkId: string) {
    const shareLink = await this.ensureShareLink(shareLinkId)
    const document = await this.getDocument(shareLink.documentId, workspaceId)
    await this.assertManager(accountId, workspaceId, document)
    await this.sessionRepository.revokeByShareLinkId(shareLinkId)
  }

  private async verifyShareLinkToken(
    token: string,
    payload: z.infer<typeof resolveSchema>,
  ): Promise<{ shareLink: ShareLinkEntity; document: DocumentEntity }> {
    const shareLink = await this.shareLinkRepository.findActiveByToken(token)
    if (!shareLink || !this.isActive(shareLink)) {
      throw new DocumentNotFoundError()
    }
    if (shareLink.passwordHash) {
      if (!payload.password || !(await this.passwordHasher.verify(shareLink.passwordHash, payload.password))) {
        throw new ShareLinkPasswordRequiredError()
      }
    }
    const document = await this.documentRepository.findById(shareLink.documentId)
    if (!document || document.deletedAt) {
      throw new DocumentNotFoundError()
    }
    return { shareLink, document }
  }

  private async ensureShareLink(id: string) {
    const shareLink = await this.shareLinkRepository.findById(id)
    if (!shareLink) {
      throw new DocumentNotFoundError()
    }
    return shareLink
  }

  private async getDocument(documentId: string, workspaceId: string): Promise<DocumentEntity> {
    const document = await this.documentRepository.findById(documentId)
    if (!document || document.workspaceId !== workspaceId || document.deletedAt) {
      throw new DocumentNotFoundError()
    }
    return document
  }

  private async assertManager(accountId: string, workspaceId: string, document: DocumentEntity): Promise<MembershipEntity> {
    const membership = await this.membershipRepository.findByWorkspaceAndAccount(workspaceId, accountId)
    if (!membership) {
      throw new MembershipAccessDeniedError()
    }
    if (membership.role === 'owner' || membership.role === 'admin' || membership.id === document.ownerMembershipId) {
      return membership
    }
    throw new MembershipAccessDeniedError()
  }

  private isActive(shareLink: ShareLinkEntity) {
    if (shareLink.revokedAt) return false
    if (shareLink.expiresAt && shareLink.expiresAt.getTime() <= Date.now()) {
      return false
    }
    return true
  }
}
