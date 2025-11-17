import type { DocumentShareLink as ShareLinkModel, DocumentShareLinkAccess } from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient'

export interface ShareLinkEntity {
  id: string
  documentId: string
  token: string
  accessLevel: DocumentShareLinkAccess
  passwordHash?: string | null
  expiresAt?: Date | null
  revokedAt?: Date | null
  createdByMembershipId: string
  allowExternalEdit: boolean
  createdAt: Date
}

export interface ShareLinkCreateInput {
  documentId: string
  token: string
  accessLevel: DocumentShareLinkAccess
  passwordHash?: string | null
  expiresAt?: Date | null
  createdByMembershipId: string
}

export class DocumentShareLinkRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async create(input: ShareLinkCreateInput): Promise<ShareLinkEntity> {
    const shareLink = await this.prisma.documentShareLink.create({
      data: {
        documentId: input.documentId,
        token: input.token,
        accessLevel: input.accessLevel,
        passwordHash: input.passwordHash,
        expiresAt: input.expiresAt,
        createdByMembershipId: input.createdByMembershipId,
        allowExternalEdit: false,
      },
    })
    return toEntity(shareLink)
  }

  async listByDocument(documentId: string): Promise<ShareLinkEntity[]> {
    const shareLinks = await this.prisma.documentShareLink.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    })
    return shareLinks.map(toEntity)
  }

  async findById(id: string): Promise<ShareLinkEntity | null> {
    const shareLink = await this.prisma.documentShareLink.findUnique({ where: { id } })
    return shareLink ? toEntity(shareLink) : null
  }

  async findActiveByToken(token: string): Promise<ShareLinkEntity | null> {
    const shareLink = await this.prisma.documentShareLink.findFirst({
      where: {
        token,
        revokedAt: null,
      },
    })
    return shareLink ? toEntity(shareLink) : null
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.documentShareLink.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
  }

  async updateOptions(id: string, options: { allowExternalEdit?: boolean }): Promise<ShareLinkEntity> {
    const shareLink = await this.prisma.documentShareLink.update({
      where: { id },
      data: {
        allowExternalEdit: options.allowExternalEdit,
      },
    })
    return toEntity(shareLink)
  }
}

const toEntity = (shareLink: ShareLinkModel): ShareLinkEntity => ({
  id: shareLink.id,
  documentId: shareLink.documentId,
  token: shareLink.token,
  accessLevel: shareLink.accessLevel,
  passwordHash: shareLink.passwordHash,
  expiresAt: shareLink.expiresAt,
  revokedAt: shareLink.revokedAt,
  createdByMembershipId: shareLink.createdByMembershipId,
  allowExternalEdit: shareLink.allowExternalEdit,
  createdAt: shareLink.createdAt,
})
