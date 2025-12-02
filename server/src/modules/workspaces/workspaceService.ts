import { z } from 'zod'
import type { WorkspaceVisibility } from '@prisma/client'
import { WorkspaceRepository, type WorkspaceEntity } from './workspaceRepository.js'
import { MembershipRepository } from './membershipRepository.js'
import { ensureUniqueSlug } from '../../lib/slug.js'
import { WorkspaceAccessService } from './workspaceAccess.js'
import { AccountRepository } from '../accounts/accountRepository.js'
import type { SocketService } from '../../lib/socket.js'

const visibilityEnum: [WorkspaceVisibility, ...WorkspaceVisibility[]] = ['private', 'listed', 'public']

const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), { message: 'cover image must be https' })

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional(),
  coverImage: httpsUrlSchema.optional(),
  defaultLocale: z.string().trim().min(2).max(10).default('en'),
  defaultTimezone: z.string().trim().min(1).max(50).optional(),
  visibility: z.enum(visibilityEnum).default('private'),
  handle: z.string().optional(),
})

const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional(),
    coverImage: httpsUrlSchema.optional(),
    defaultLocale: z.string().trim().min(2).max(10).optional(),
    defaultTimezone: z.string().trim().min(1).max(50).optional(),
    visibility: z.enum(visibilityEnum).optional(),
    handle: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field required' })

export class WorkspaceService {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly workspaceAccess: WorkspaceAccessService,
    private readonly accountRepository: AccountRepository,
    private socketService?: SocketService,
  ) { }

  /**
   * Set the socket service after initialization (for dependency injection)
   */
  public setSocketService(socketService: SocketService): void {
    this.socketService = socketService;
  }

  async create(ownerAccountId: string, rawInput: z.input<typeof createWorkspaceSchema>): Promise<WorkspaceEntity> {
    const input = createWorkspaceSchema.parse(rawInput)

    let handle = input.handle
    if (!handle) {
      handle = await ensureUniqueSlug(input.name, (candidate: string) => this.repository.slugExists(candidate))
    } else {
      // Check if provided handle is available
      const exists = await this.repository.slugExists(handle)
      if (exists) {
        throw new Error('Handle already taken')
      }
    }

    const owner = await this.accountRepository.findById(ownerAccountId)
    if (!owner) {
      throw new Error('Owner account not found')
    }

    const effectiveTimezone = rawInput.defaultTimezone ?? owner.preferredTimezone ?? 'UTC'

    const workspace = await this.repository.create({
      ownerId: ownerAccountId,
      name: input.name,
      description: input.description,
      defaultLanguage: input.defaultLocale,
      visibility: input.visibility,
      handle,
    })

    const ownerDisplayName = owner.legalName?.trim() && owner.legalName.trim().length > 0 ? owner.legalName.trim() : owner.email.split('@')[0]

    await this.membershipRepository.create({
      workspaceId: workspace.id,
      accountId: ownerAccountId,
      role: 'owner',
      status: 'active',
      preferredLocale: owner.preferredLocale ?? undefined,
      displayName: ownerDisplayName,
      timezone: owner.preferredTimezone ?? effectiveTimezone,
    })

    return workspace
  }

  async listForAccount(accountId: string): Promise<WorkspaceEntity[]> {
    const memberships = await this.membershipRepository.findByAccount(accountId)
    const workspaceIds = memberships.map((m) => m.workspaceId)
    return this.repository.findByIds(workspaceIds)
  }

  async getById(accountId: string, workspaceId: string): Promise<WorkspaceEntity | null> {
    await this.workspaceAccess.assertMember(accountId, workspaceId)
    return this.repository.findById(workspaceId)
  }

  async update(actorAccountId: string, workspaceId: string, rawInput: z.input<typeof updateWorkspaceSchema>) {
    await this.workspaceAccess.assertAdminOrOwner(actorAccountId, workspaceId)
    const input = updateWorkspaceSchema.parse(rawInput)

    const updated = await this.repository.update(workspaceId, {
      name: input.name,
      description: input.description,
      defaultLanguage: input.defaultLocale,
      visibility: input.visibility,
      handle: input.handle,
    })

    // Emit socket event for workspace updates
    if (this.socketService) {
      this.socketService.emitToWorkspace(workspaceId, {
        type: 'workspace:updated',
        workspaceId,
        updates: {
          name: input.name,
          description: input.description,
          defaultLanguage: input.defaultLocale,
          visibility: input.visibility,
          handle: input.handle,
        },
      });
    }

    return updated;
  }

  async softDelete(ownerAccountId: string, workspaceId: string): Promise<void> {
    const workspace = await this.repository.findByIdIncludingDeleted(workspaceId)
    if (!workspace || workspace.ownerId !== ownerAccountId) {
      throw new WorkspaceNotFoundError()
    }
    // Schema doesn't support soft delete, so we just check if it exists
    await this.repository.softDelete(workspaceId)
  }
}

export class WorkspaceNotFoundError extends Error {
  constructor() {
    super('Workspace not found or inaccessible')
    this.name = 'WorkspaceNotFoundError'
  }
}
