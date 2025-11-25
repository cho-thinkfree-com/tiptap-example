import type { Folder as FolderModel } from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient.js'

export interface FolderEntity {
  id: string
  workspaceId: string
  parentId?: string | null
  name: string
  pathCache: string
  sortOrder: number
  deletedAt?: Date | null
  deletedBy?: string | null
  originalParentId?: string | null
  originalParentName?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface FolderCreateInput {
  workspaceId: string
  parentId?: string | null
  name: string
  pathCache: string
  sortOrder?: number
}

export interface FolderUpdateInput {
  name?: string
  parentId?: string | null
  sortOrder?: number
  pathCache?: string
  deletedAt?: Date | null
}

export class FolderRepository {
  constructor(private readonly prisma: DatabaseClient) { }

  async create(input: FolderCreateInput): Promise<FolderEntity> {
    const folder = await this.prisma.folder.create({
      data: {
        workspaceId: input.workspaceId,
        parentId: input.parentId ?? null,
        name: input.name,
        pathCache: input.pathCache,
        sortOrder: input.sortOrder ?? 0,
      },
    })
    return toEntity(folder)
  }

  async update(id: string, input: FolderUpdateInput): Promise<FolderEntity> {
    const folder = await this.prisma.folder.update({
      where: { id },
      data: {
        name: input.name,
        parentId: input.parentId,
        sortOrder: input.sortOrder,
        pathCache: input.pathCache,
        deletedAt: input.deletedAt,
      },
    })
    return toEntity(folder)
  }

  async updatePathCache(id: string, pathCache: string): Promise<void> {
    await this.prisma.folder.update({
      where: { id },
      data: { pathCache },
    })
  }

  async findById(id: string): Promise<FolderEntity | null> {
    const folder = await this.prisma.folder.findUnique({ where: { id } })
    return folder ? toEntity(folder) : null
  }

  async findByIdWithAncestors(id: string): Promise<{ folder: FolderEntity; ancestors: FolderEntity[] } | null> {
    const folder = await this.findById(id)
    if (!folder) return null

    const ancestors: FolderEntity[] = []
    let current = folder
    console.log(`[findByIdWithAncestors] Starting for folder: ${folder.name} (${folder.id}), parentId: ${folder.parentId}`)
    while (current.parentId) {
      console.log(`[findByIdWithAncestors] Fetching parent: ${current.parentId}`)
      const parent = await this.findById(current.parentId)
      if (!parent) {
        console.log(`[findByIdWithAncestors] Parent not found!`)
        break
      }
      console.log(`[findByIdWithAncestors] Found parent: ${parent.name}`)
      ancestors.unshift(parent)
      current = parent
    }
    console.log(`[findByIdWithAncestors] Final ancestors count: ${ancestors.length}`)
    return { folder, ancestors }
  }

  async listByWorkspace(workspaceId: string, includeDeleted = false): Promise<FolderEntity[]> {
    const folders = await this.prisma.folder.findMany({
      where: {
        workspaceId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return folders.map(toEntity)
  }

  async listChildren(workspaceId: string, parentId: string | null): Promise<FolderEntity[]> {
    const folders = await this.prisma.folder.findMany({
      where: { workspaceId, parentId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return folders.map(toEntity)
  }

  async isNameTaken(
    workspaceId: string,
    parentId: string | null,
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    const folders = await this.prisma.folder.findMany({
      where: {
        workspaceId,
        parentId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    })
    return folders.some((folder) => folder.name.toLowerCase() === name.toLowerCase())
  }

  async softDelete(id: string, deletedByMembershipId: string): Promise<void> {
    const folder = await this.findById(id)
    if (!folder) return

    await this.prisma.folder.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: deletedByMembershipId,
        originalParentId: folder.parentId,
      },
    })
  }

  async findTrashed(workspaceId: string): Promise<FolderEntity[]> {
    const folders = await this.prisma.folder.findMany({
      where: {
        workspaceId,
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: 'desc' },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
    return folders.map(toEntity)
  }

  async restore(id: string, targetParentId?: string | null): Promise<FolderEntity> {
    const folder = await this.prisma.folder.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
        originalParentId: null,
        parentId: targetParentId,
      },
    })
    return toEntity(folder)
  }

  async permanentDelete(id: string): Promise<void> {
    // 1. Find all descendant folder IDs to delete documents within them
    // We need a recursive query or iterative approach.
    // Since Prisma doesn't support recursive CTEs easily, we'll fetch all folders and build tree or filter?
    // Or just rely on the fact that we are deleting the folder.
    // BUT documents have onDelete: SetNull. We need to delete them manually.

    // Helper to get all descendant IDs
    const getAllDescendantIds = async (rootId: string): Promise<string[]> => {
      const children = await this.prisma.folder.findMany({
        where: { parentId: rootId },
        select: { id: true }
      })
      let ids = children.map(c => c.id)
      for (const childId of ids) {
        const descendants = await getAllDescendantIds(childId)
        ids = [...ids, ...descendants]
      }
      return ids
    }

    const descendantIds = await getAllDescendantIds(id)
    const allFolderIds = [id, ...descendantIds]

    // 2. Delete all documents in these folders
    await this.prisma.document.deleteMany({
      where: {
        folderId: { in: allFolderIds }
      }
    })

    // 3. Delete the folder (Cascade will handle child folders)
    await this.prisma.folder.delete({
      where: { id },
    })
  }

  async deleteOldTrashed(olderThan: Date): Promise<number> {
    // We need to delete folders that are older than X AND their parents are not deleted?
    // Or just any folder older than X.
    // If we delete a folder, we must also delete its contents.
    // This is complex for bulk delete.
    // For now, let's just find top-level trashed items older than X and delete them one by one?
    // Or just delete documents inside them and then the folders.

    const foldersToDelete = await this.prisma.folder.findMany({
      where: {
        deletedAt: { lt: olderThan },
      },
      select: { id: true }
    })

    let count = 0
    for (const folder of foldersToDelete) {
      await this.permanentDelete(folder.id)
      count++
    }
    return count
  }
}

const toEntity = (folder: FolderModel & { parent?: { id: string; name: string } | null }): FolderEntity => ({
  id: folder.id,
  workspaceId: folder.workspaceId,
  parentId: folder.parentId,
  name: folder.name,
  pathCache: folder.pathCache,
  sortOrder: folder.sortOrder,
  deletedAt: folder.deletedAt,
  deletedBy: folder.deletedBy,
  originalParentId: folder.originalParentId,
  originalParentName: folder.parent?.name ?? null,
  createdAt: folder.createdAt,
  updatedAt: folder.updatedAt,
})
