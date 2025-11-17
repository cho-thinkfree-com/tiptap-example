import type { DocumentRevision as RevisionModel } from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient'

export interface DocumentRevisionEntity {
  id: string
  documentId: string
  version: number
  content: unknown
  summary?: string | null
  createdByMembershipId: string
  createdAt: Date
}

export interface DocumentRevisionCreateInput {
  documentId: string
  version: number
  content: unknown
  summary?: string | null
  createdByMembershipId: string
}

export class DocumentRevisionRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async create(input: DocumentRevisionCreateInput): Promise<DocumentRevisionEntity> {
    const revision = await this.prisma.documentRevision.create({
      data: {
        documentId: input.documentId,
        version: input.version,
        content: input.content as any,
        summary: input.summary,
        createdByMembershipId: input.createdByMembershipId,
      },
    })
    return toEntity(revision)
  }

  async findLatest(documentId: string): Promise<DocumentRevisionEntity | null> {
    const revision = await this.prisma.documentRevision.findFirst({
      where: { documentId },
      orderBy: { version: 'desc' },
    })
    return revision ? toEntity(revision) : null
  }

  async listByDocument(documentId: string, limit = 20): Promise<DocumentRevisionEntity[]> {
    const revisions = await this.prisma.documentRevision.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
      take: limit,
    })
    return revisions.map(toEntity)
  }
}

const toEntity = (revision: RevisionModel): DocumentRevisionEntity => ({
  id: revision.id,
  documentId: revision.documentId,
  version: revision.version,
  content: revision.content as unknown,
  summary: revision.summary,
  createdByMembershipId: revision.createdByMembershipId,
  createdAt: revision.createdAt,
})
