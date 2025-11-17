import type { Folder as FolderModel } from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient'

export interface FolderEntity {
  id: string
  workspaceId: string
  parentId?: string | null
  name: string
  pathCache: string
  sortOrder: number
  deletedAt?: Date | null
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
  constructor(private readonly prisma: DatabaseClient) {}

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

  async softDelete(id: string): Promise<void> {
    await this.prisma.folder.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}

const toEntity = (folder: FolderModel): FolderEntity => ({
  id: folder.id,
  workspaceId: folder.workspaceId,
  parentId: folder.parentId,
  name: folder.name,
  pathCache: folder.pathCache,
  sortOrder: folder.sortOrder,
  deletedAt: folder.deletedAt,
  createdAt: folder.createdAt,
  updatedAt: folder.updatedAt,
})
