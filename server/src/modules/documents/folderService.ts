import { z } from 'zod'
import { FolderRepository, type FolderEntity } from './folderRepository.js'
import { DocumentRepository } from './documentRepository.js'
import { WorkspaceAccessService } from '../workspaces/workspaceAccess.js'
import { MembershipRepository } from '../workspaces/membershipRepository.js'
import { MembershipAccessDeniedError } from '../workspaces/membershipService.js'

const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().optional(),
})

const updateFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field required' })

const moveFolderSchema = z.object({
  parentId: z.string().uuid().nullable(),
  sortOrder: z.number().int().optional(),
})

const MAX_DEPTH = 8

export class FolderService {
  constructor(
    private readonly folderRepository: FolderRepository,
    private readonly workspaceAccess: WorkspaceAccessService,
    private readonly documentRepository: DocumentRepository,
    private readonly membershipRepository: MembershipRepository,
  ) { }

  async listFolders(accountId: string, workspaceId: string, includeDeleted = false): Promise<FolderEntity[]> {
    await this.workspaceAccess.assertMember(accountId, workspaceId)
    return this.folderRepository.listByWorkspace(workspaceId, includeDeleted)
  }

  async listTrashed(accountId: string, workspaceId: string, options?: { sortBy?: string, sortOrder?: 'asc' | 'desc' }): Promise<FolderEntity[]> {
    await this.workspaceAccess.assertMember(accountId, workspaceId)
    return this.folderRepository.findTrashed(workspaceId, options)
  }

  async getFolderWithAncestors(accountId: string, workspaceId: string, folderId: string) {
    await this.workspaceAccess.assertMember(accountId, workspaceId)
    const result = await this.folderRepository.findByIdWithAncestors(folderId)
    if (!result || result.folder.workspaceId !== workspaceId) {
      throw new FolderNotFoundError()
    }
    return result
  }

  async createFolder(accountId: string, workspaceId: string, rawInput: z.input<typeof createFolderSchema>) {
    await this.workspaceAccess.assertAdminOrOwner(accountId, workspaceId)
    const input = createFolderSchema.parse(rawInput)
    const parent = input.parentId ? await this.ensureFolder(workspaceId, input.parentId) : null
    if (parent?.deletedAt) {
      throw new FolderNotFoundError()
    }
    this.ensureDepthForCreate(parent)
    await this.assertNameUnique(workspaceId, input.parentId ?? null, input.name)

    const path = parent ? `${parent.pathCache}/${input.name}` : input.name
    return this.folderRepository.create({
      workspaceId,
      parentId: input.parentId ?? null,
      name: input.name,
      pathCache: path,
      sortOrder: input.sortOrder,
    })
  }

  async updateFolder(
    accountId: string,
    workspaceId: string,
    folderId: string,
    rawInput: z.input<typeof updateFolderSchema>,
  ) {
    await this.workspaceAccess.assertAdminOrOwner(accountId, workspaceId)
    const folder = await this.ensureFolder(workspaceId, folderId)
    if (folder.deletedAt) throw new FolderNotFoundError()
    const input = updateFolderSchema.parse(rawInput)
    if (input.name) {
      await this.assertNameUnique(workspaceId, folder.parentId ?? null, input.name, folder.id)
    }
    const updated = await this.folderRepository.update(folder.id, {
      name: input.name,
      sortOrder: input.sortOrder,
    })
    if (input.name) {
      await this.rebuildSubtreePaths(workspaceId, folder.id)
    }
    return updated
  }

  async moveFolder(
    accountId: string,
    workspaceId: string,
    folderId: string,
    rawInput: z.input<typeof moveFolderSchema>,
  ) {
    await this.workspaceAccess.assertAdminOrOwner(accountId, workspaceId)
    const folder = await this.ensureFolder(workspaceId, folderId)
    if (folder.deletedAt) throw new FolderNotFoundError()
    const input = moveFolderSchema.parse(rawInput)
    if (input.parentId === folder.id) {
      throw new FolderHierarchyError('Folder cannot be its own parent')
    }
    const parent = input.parentId ? await this.ensureFolder(workspaceId, input.parentId) : null
    if (parent?.deletedAt) {
      throw new FolderNotFoundError()
    }

    const allFolders = await this.folderRepository.listByWorkspace(workspaceId)
    this.ensureDepthForMove(parent, folder, allFolders)
    const isCycle = parent ? this.isDescendant(folder.id, parent.id, allFolders) : false
    if (isCycle) {
      throw new FolderHierarchyError('Cannot move folder under its own descendant')
    }

    await this.folderRepository.update(folder.id, {
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder,
    })
    await this.rebuildSubtreePaths(workspaceId, folder.id)
    return this.ensureFolder(workspaceId, folder.id)
  }

  async restoreFolder(accountId: string, folderId: string): Promise<FolderEntity> {
    const folder = await this.folderRepository.findById(folderId)
    if (!folder || !folder.deletedAt) {
      throw new FolderNotFoundError()
    }
    await this.workspaceAccess.assertMember(accountId, folder.workspaceId)

    const originalParentId = (folder as any).originalParentId
    let targetParentId: string | null = null

    if (originalParentId) {
      const parentPath = await this.validateFolderPath(originalParentId, folder.workspaceId)
      if (parentPath) {
        targetParentId = originalParentId
      }
    }

    const restored = await this.folderRepository.restore(folderId, targetParentId)
    await this.rebuildSubtreePaths(folder.workspaceId, folder.id)
    return restored
  }

  async permanentlyDeleteFolder(accountId: string, folderId: string): Promise<void> {
    const folder = await this.folderRepository.findById(folderId)
    if (!folder) return
    await this.workspaceAccess.assertAdminOrOwner(accountId, folder.workspaceId)
    await this.folderRepository.permanentDelete(folderId)
  }

  async deleteFolder(accountId: string, workspaceId: string, folderId: string) {
    await this.workspaceAccess.assertAdminOrOwner(accountId, workspaceId)
    const folder = await this.ensureFolder(workspaceId, folderId)
    if (folder.deletedAt) return

    const membership = await this.membershipRepository.findByWorkspaceAndAccount(workspaceId, accountId)
    if (!membership) {
      throw new MembershipAccessDeniedError()
    }

    // We no longer check for children, as we support deleting non-empty folders (move to trash)
    // We also don't reassign documents.

    await this.folderRepository.softDelete(folder.id, membership.id)
  }

  private async validateFolderPath(folderId: string, workspaceId: string): Promise<boolean> {
    const result = await this.folderRepository.findByIdWithAncestors(folderId)
    if (!result || result.folder.workspaceId !== workspaceId || result.folder.deletedAt) {
      return false
    }
    // Check if any ancestor is deleted
    for (const ancestor of result.ancestors) {
      if (ancestor.deletedAt) return false
    }
    return true
  }

  private async ensureFolder(workspaceId: string, folderId: string): Promise<FolderEntity> {
    const folder = await this.folderRepository.findById(folderId)
    if (!folder || folder.workspaceId !== workspaceId) {
      throw new FolderNotFoundError()
    }
    return folder
  }

  private async assertNameUnique(
    workspaceId: string,
    parentId: string | null,
    name: string,
    excludeId?: string,
  ) {
    const folderExists = await this.folderRepository.isNameTaken(workspaceId, parentId, name, excludeId)
    if (folderExists) {
      throw new FolderNameConflictError()
    }
    const docExists = await this.documentRepository.titleExists(workspaceId, parentId, name)
    if (docExists) {
      throw new FolderNameConflictError()
    }
  }

  private async rebuildSubtreePaths(workspaceId: string, folderId: string) {
    const folders = await this.folderRepository.listByWorkspace(workspaceId, true)
    const map = new Map(folders.map((f) => [f.id, f]))
    const root = map.get(folderId)
    if (!root) return

    const updates: Array<{ id: string; path: string }> = []
    const buildPath = (node: FolderEntity, parentPath?: string) => {
      if (node.deletedAt) return
      const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name
      updates.push({ id: node.id, path: currentPath })
      const children = folders.filter((child) => child.parentId === node.id && !child.deletedAt)
      children.forEach((child) => buildPath(child, currentPath))
    }

    const parentPath = root.parentId ? map.get(root.parentId ?? '')?.pathCache : undefined
    buildPath(root, parentPath)
    await Promise.all(updates.map((item) => this.folderRepository.updatePathCache(item.id, item.path)))
  }

  private ensureDepthForCreate(parent: FolderEntity | null) {
    if (!parent) return
    const nextDepth = parent.pathCache.split('/').length + 1
    if (nextDepth > MAX_DEPTH) {
      throw new FolderDepthExceededError()
    }
  }

  private ensureDepthForMove(parent: FolderEntity | null, folder: FolderEntity, folders: FolderEntity[]) {
    const parentDepth = parent ? parent.pathCache.split('/').length : 0
    const subtreeHeight = this.calculateSubtreeHeight(folder.id, folders)
    if (parentDepth + subtreeHeight > MAX_DEPTH) {
      throw new FolderDepthExceededError()
    }
  }

  private calculateSubtreeHeight(folderId: string, folders: FolderEntity[]): number {
    const children = folders.filter((item) => item.parentId === folderId && !item.deletedAt)
    if (children.length === 0) {
      return 1
    }
    const childHeights = children.map((child) => this.calculateSubtreeHeight(child.id, folders))
    return 1 + Math.max(...childHeights)
  }

  private isDescendant(targetId: string, potentialChildId: string, folders: FolderEntity[]): boolean {
    const map = new Map(folders.map((folder) => [folder.id, folder]))
    let current: FolderEntity | undefined = map.get(potentialChildId)
    while (current?.parentId) {
      if (current.parentId === targetId) {
        return true
      }
      current = map.get(current.parentId)
    }
    return false
  }
}

export class FolderNotFoundError extends Error {
  constructor() {
    super('Folder not found')
    this.name = 'FolderNotFoundError'
  }
}

export class FolderNameConflictError extends Error {
  constructor() {
    super('Folder name already exists in this location')
    this.name = 'FolderNameConflictError'
  }
}

export class FolderHierarchyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FolderHierarchyError'
  }
}

export class FolderDepthExceededError extends Error {
  constructor() {
    super('Folder depth limit exceeded')
    this.name = 'FolderDepthExceededError'
  }
}

export class FolderHasChildrenError extends Error {
  constructor() {
    super('Folder contains child folders and cannot be deleted yet')
    this.name = 'FolderHasChildrenError'
  }
}
