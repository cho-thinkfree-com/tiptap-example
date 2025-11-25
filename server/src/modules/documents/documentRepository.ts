import type {
  Document as DocumentModel,
  DocumentStatus,
  DocumentVisibility,
  DocumentWorkspaceAccess,
} from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient.js'

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
  contentSize: number
  sortOrder: number
  workspaceDefaultAccess: DocumentWorkspaceAccess
  workspaceEditorAdminsOnly: boolean
  deletedAt?: Date | null
  deletedBy?: string | null
  originalFolderId?: string | null
  originalFolderName?: string | null
  createdAt: Date
  updatedAt: Date
  tags: string[]
  lastModifiedBy?: string | null
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
  contentSize?: number
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
  contentSize?: number
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
  tags?: string[]
  sortBy?: 'title' | 'name' | 'updatedAt' | 'contentSize' | 'type'
  sortOrder?: 'asc' | 'desc'
}

export class DocumentRepository {
  constructor(private readonly prisma: DatabaseClient) { }

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
        contentSize: input.contentSize ?? 0,
        sortOrder: input.sortOrder ?? 0,
        workspaceEditorAdminsOnly: input.workspaceEditorAdminsOnly,
      },
      include: {
        tags: {
          select: {
            name: true,
          },
        },
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
        contentSize: input.contentSize,
        sortOrder: input.sortOrder,
        workspaceDefaultAccess: input.workspaceDefaultAccess,
        workspaceEditorAdminsOnly: input.workspaceEditorAdminsOnly,
        deletedAt: input.deletedAt,
      },
      include: {
        tags: {
          select: {
            name: true,
          },
        },
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
        contentSize: input.contentSize,
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
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        tags: {
          select: { name: true },
        },
      },
    })
    return document ? toEntity(document) : null
  }

  async listByWorkspace(workspaceId: string, filters: DocumentListFilters = {}): Promise<DocumentEntity[]> {
    const orderBy: any[] = []

    if (filters.sortBy) {
      if (filters.sortBy === 'title' || filters.sortBy === 'name') {
        orderBy.push({ title: filters.sortOrder || 'asc' })
      } else if (filters.sortBy === 'updatedAt') {
        orderBy.push({ updatedAt: filters.sortOrder || 'desc' })
      } else if (filters.sortBy === 'contentSize' || filters.sortBy === 'size') {
        orderBy.push({ contentSize: filters.sortOrder || 'desc' })
      }
    } else {
      orderBy.push({ sortOrder: 'asc' }, { title: 'asc' })
    }

    const documents = await this.prisma.document.findMany({
      where: {
        workspaceId,
        deletedAt: filters.includeDeleted ? undefined : null,
        folderId: filters.folderId ?? null,
        status: filters.status,
        visibility: filters.visibility,
        ...(filters.search
          ? {
            title: {
              contains: filters.search,
            },
          }
          : {}),
        ...(filters.tags && filters.tags.length > 0
          ? {
            tags: {
              some: {
                name: {
                  in: filters.tags,
                },
              },
            },
          }
          : {}),
      },
      orderBy,
      include: {
        tags: {
          select: {
            name: true,
          },
        },
        revisions: {
          orderBy: {
            version: 'desc',
          },
          take: 1,
          include: {
            createdByMembership: {
              include: {
                account: true,
              },
            },
          },
        },
      },
    })
    return documents.map(toEntity)
  }

  async listRecentByWorkspaces(workspaceIds: string[], options?: { limit?: number, sortBy?: string, sortOrder?: 'asc' | 'desc' }): Promise<DocumentEntity[]> {
    const orderBy: any[] = []

    if (options?.sortBy) {
      if (options.sortBy === 'title') {
        orderBy.push({ title: options.sortOrder || 'asc' })
      } else if (options.sortBy === 'updatedAt') {
        orderBy.push({ updatedAt: options.sortOrder || 'desc' })
      } else if (options.sortBy === 'contentSize') {
        orderBy.push({ contentSize: options.sortOrder || 'desc' })
      }
    } else {
      orderBy.push({ updatedAt: 'desc' })
    }

    const documents = await this.prisma.document.findMany({
      where: {
        workspaceId: {
          in: workspaceIds,
        },
        deletedAt: null,
      },
      orderBy,
      take: options?.limit ?? 10,
      include: {
        tags: {
          select: { name: true },
        },
        revisions: {
          orderBy: {
            version: 'desc',
          },
          take: 1,
          include: {
            createdByMembership: {
              include: {
                account: true,
              },
            },
          },
        },
      },
    });
    return documents.map(toEntity);
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

  async titleExists(
    workspaceId: string,
    folderId: string | null,
    title: string,
    excludeId?: string,
  ): Promise<boolean> {
    const document = await this.prisma.document.findFirst({
      where: {
        workspaceId,
        folderId,
        deletedAt: null,
        title: {
          equals: title,
        },
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

  async softDelete(id: string, deletedByMembershipId: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { folderId: true },
    });

    await this.prisma.document.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: deletedByMembershipId,
        originalFolderId: doc?.folderId || null,
      },
    });
  }

  async findTrashed(workspaceId: string, options?: { sortBy?: string, sortOrder?: 'asc' | 'desc' }): Promise<DocumentEntity[]> {
    const orderBy: any[] = []

    if (options?.sortBy) {
      if (options.sortBy === 'name') {
        orderBy.push({ title: options.sortOrder || 'asc' })
      } else if (options.sortBy === 'deletedAt') {
        orderBy.push({ deletedAt: options.sortOrder || 'desc' })
      } else if (options.sortBy === 'size') {
        orderBy.push({ contentSize: options.sortOrder || 'desc' })
      }
    } else {
      orderBy.push({ deletedAt: 'desc' })
    }

    const documents = await this.prisma.document.findMany({
      where: {
        workspaceId,
        deletedAt: { not: null },
      },
      orderBy,
      include: {
        tags: {
          select: {
            name: true,
          },
        },
        revisions: {
          orderBy: {
            version: 'desc',
          },
          take: 1,
          include: {
            createdByMembership: {
              include: {
                account: true,
              },
            },
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return documents.map(toEntity);
  }

  async restore(id: string, targetFolderId: string | null): Promise<DocumentEntity> {
    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
        originalFolderId: null,
        folderId: targetFolderId,
      },
      include: {
        tags: {
          select: {
            name: true,
          },
        },
        revisions: {
          orderBy: {
            version: 'desc',
          },
          take: 1,
          include: {
            createdByMembership: {
              include: {
                account: true,
              },
            },
          },
        },
      },
    });
    return toEntity(updated);
  }

  async permanentDelete(id: string): Promise<void> {
    await this.prisma.document.delete({
      where: { id },
    });
  }

  async deleteOldTrashed(olderThan: Date): Promise<number> {
    const result = await this.prisma.document.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lt: olderThan,
        },
      },
    });
    return result.count;
  }
}

const toEntity = (document: DocumentModel & { revisions?: ({ createdByMembership: { account: { legalName: string | null } | null } | null } | null)[]; tags: { name: string }[]; folder?: { id: string; name: string } | null }): DocumentEntity => {
  const latestRevision = document.revisions?.[0] as any
  const revisionContentSize = latestRevision?.contentSize as number | undefined
  const revisionContent = latestRevision?.content
  const fallbackSize =
    revisionContentSize ??
    (revisionContent ? Buffer.byteLength(JSON.stringify(revisionContent), 'utf8') : 0)

  return {
    id: document.id,
    workspaceId: document.workspaceId,
    folderId: document.folderId,
    ownerMembershipId: document.ownerMembershipId,
    title: document.title,
    slug: document.slug,
    status: document.status,
    visibility: document.visibility,
    summary: document.summary,
    contentSize: (document as any).contentSize ?? fallbackSize,
    sortOrder: document.sortOrder,
    workspaceDefaultAccess: document.workspaceDefaultAccess,
    workspaceEditorAdminsOnly: document.workspaceEditorAdminsOnly,
    deletedAt: document.deletedAt,
    deletedBy: document.deletedBy,
    originalFolderId: document.originalFolderId,
    originalFolderName: document.folder?.name ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    tags: document.tags?.map((tag) => tag.name) ?? [],
    lastModifiedBy: document.revisions?.[0]?.createdByMembership?.account?.legalName,
  }
}
