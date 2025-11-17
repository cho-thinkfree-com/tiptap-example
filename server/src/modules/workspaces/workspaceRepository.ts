import type { WorkspaceVisibility } from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient'

export interface WorkspaceEntity {
  id: string
  name: string
  slug: string
  description?: string | null
  coverImage?: string | null
  defaultLocale: string
  visibility: WorkspaceVisibility
  ownerAccountId: string
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date | null
}

export interface CreateWorkspaceInput {
  name: string
  slug: string
  description?: string | null
  coverImage?: string | null
  defaultLocale: string
  visibility: WorkspaceVisibility
  ownerAccountId: string
}

export interface UpdateWorkspaceInput {
  name?: string
  description?: string | null
  coverImage?: string | null
  defaultLocale?: string
  visibility?: WorkspaceVisibility
}

export class WorkspaceRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async create(input: CreateWorkspaceInput): Promise<WorkspaceEntity> {
    const workspace = await this.prisma.workspace.create({
      data: input,
    })
    return toEntity(workspace)
  }

  async listByOwner(ownerAccountId: string): Promise<WorkspaceEntity[]> {
    const workspaces = await this.prisma.workspace.findMany({
      where: { ownerAccountId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })
    return workspaces.map(toEntity)
  }

  async findById(id: string): Promise<WorkspaceEntity | null> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
    })
    return workspace ? toEntity(workspace) : null
  }

  async findByIdIncludingDeleted(id: string): Promise<WorkspaceEntity | null> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } })
    return workspace ? toEntity(workspace) : null
  }

  async slugExists(slug: string): Promise<boolean> {
    const count = await this.prisma.workspace.count({
      where: { slug },
    })
    return count > 0
  }

  async update(id: string, input: UpdateWorkspaceInput): Promise<WorkspaceEntity> {
    const workspace = await this.prisma.workspace.update({
      where: { id },
      data: input,
    })
    return toEntity(workspace)
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.workspace.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}

const toEntity = (workspace: {
  id: string
  name: string
  slug: string
  description: string | null
  coverImage: string | null
  defaultLocale: string
  visibility: WorkspaceVisibility
  ownerAccountId: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}): WorkspaceEntity => ({
  id: workspace.id,
  name: workspace.name,
  slug: workspace.slug,
  description: workspace.description,
  coverImage: workspace.coverImage,
  defaultLocale: workspace.defaultLocale,
  visibility: workspace.visibility,
  ownerAccountId: workspace.ownerAccountId,
  createdAt: workspace.createdAt,
  updatedAt: workspace.updatedAt,
  deletedAt: workspace.deletedAt,
})
