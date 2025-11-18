import type {
  Document as DocumentModel,
  DocumentStatus,
  DocumentVisibility,
  DocumentWorkspaceAccess,
} from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient'

export interface DocumentEntity {
  id: string
  workspaceId: string
  folderId?: string | null
  ownerMembershipId: string
  title: string
  slug: string
  status: DocumentStatus
  visibility: DocumentVisibility
  summary?: string | null
  sortOrder: number
  workspaceDefaultAccess: DocumentWorkspaceAccess
  workspaceEditorAdminsOnly: boolean
  deletedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface DocumentCreateInput {
  workspaceId: string
  folderId?: string | null
  ownerMembershipId: string
  title: string
  slug: string
  status: DocumentStatus
  visibility: DocumentVisibility
  summary?: string | null
  sortOrder?: number
  workspaceDefaultAccess?: DocumentWorkspaceAccess
  workspaceEditorAdminsOnly?: boolean
}

export interface DocumentUpdateInput {
  folderId?: string | null
  title?: string
  slug?: string
  status?: DocumentStatus
  visibility?: DocumentVisibility
  summary?: string | null
  sortOrder?: number
  workspaceDefaultAccess?: DocumentWorkspaceAccess
  workspaceEditorAdminsOnly?: boolean
  deletedAt?: Date | null
}

export interface DocumentListFilters {
  folderId?: string | null
  status?: DocumentStatus
  visibility?: DocumentVisibility
  search?: string
  includeDeleted?: boolean
}

export class DocumentRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async create(input: DocumentCreateInput): Promise<DocumentEntity> {
    const document = await this.prisma.document.create({
      data: {
        workspaceId: input.workspaceId,
        folderId: input.folderId ?? null,
        ownerMembershipId: input.ownerMembershipId,
        title: input.title,
        slug: input.slug,
        status: input.status,
        visibility: input.visibility,
        summary: input.summary,
        sortOrder: input.sortOrder ?? 0,
        workspaceDefaultAccess: input.workspaceDefaultAccess,
        workspaceEditorAdminsOnly: input.workspaceEditorAdminsOnly,
      },
    })
    return toEntity(document)
  }

  async update(id: string, input: DocumentUpdateInput): Promise<DocumentEntity> {
    const document = await this.prisma.document.update({
      where: { id },
      data: {
        folderId: input.folderId,
        title: input.title,
        slug: input.slug,
        status: input.status,
        visibility: input.visibility,
        summary: input.summary,
        sortOrder: input.sortOrder,
        workspaceDefaultAccess: input.workspaceDefaultAccess,
        workspaceEditorAdminsOnly: input.workspaceEditorAdminsOnly,
        deletedAt: input.deletedAt,
      },
    })
    return toEntity(document)
  }

  async updateWithConcurrency(
    id: string,
    expectedUpdatedAt: Date,
    input: DocumentUpdateInput,
  ): Promise<DocumentEntity | null> {
    const result = await this.prisma.document.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data: {
        folderId: input.folderId,
        title: input.title,
        slug: input.slug,
        status: input.status,
        visibility: input.visibility,
        summary: input.summary,
        sortOrder: input.sortOrder,
        workspaceDefaultAccess: input.workspaceDefaultAccess,
        workspaceEditorAdminsOnly: input.workspaceEditorAdminsOnly,
      },
    })
    if (result.count === 0) {
      return null
    }
    const document = await this.findById(id)
    return document
  }

  async findById(id: string): Promise<DocumentEntity | null> {
    const document = await this.prisma.document.findUnique({ where: { id } })
    return document ? toEntity(document) : null
  }

  async listByWorkspace(workspaceId: string, filters: DocumentListFilters = {}): Promise<DocumentEntity[]> {
    const documents = await this.prisma.document.findMany({
      where: {
        workspaceId,
        deletedAt: filters.includeDeleted ? undefined : null,
        ...(filters.folderId !== undefined ? { folderId: filters.folderId } : {}),
        status: filters.status,
        visibility: filters.visibility,
        ...(filters.search
          ? {
              title: {
                contains: filters.search,
              },
            }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    })
    return documents.map(toEntity)
  }

  async slugExists(workspaceId: string, slug: string, excludeId?: string): Promise<boolean> {
    const document = await this.prisma.document.findFirst({
      where: {
        workspaceId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    })
    return Boolean(document)
  }

  async reassignFolder(sourceFolderId: string, targetFolderId: string | null): Promise<void> {
    await this.prisma.document.updateMany({
      where: { folderId: sourceFolderId },
      data: { folderId: targetFolderId },
    })
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}

const toEntity = (document: DocumentModel): DocumentEntity => ({
  id: document.id,
  workspaceId: document.workspaceId,
  folderId: document.folderId,
  ownerMembershipId: document.ownerMembershipId,
  title: document.title,
  slug: document.slug,
  status: document.status,
  visibility: document.visibility,
  summary: document.summary,
  sortOrder: document.sortOrder,
  workspaceDefaultAccess: document.workspaceDefaultAccess,
  workspaceEditorAdminsOnly: document.workspaceEditorAdminsOnly,
  deletedAt: document.deletedAt,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
})
