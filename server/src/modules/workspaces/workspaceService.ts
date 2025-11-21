import { z } from 'zod'
import type { WorkspaceVisibility } from '@prisma/client'
import { WorkspaceRepository, type WorkspaceEntity } from './workspaceRepository.js'
import { MembershipRepository } from './membershipRepository.js'
import { ensureUniqueSlug } from '../../lib/slug.js'
import { WorkspaceAccessService } from './workspaceAccess.js'
import { AccountRepository } from '../accounts/accountRepository.js'

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
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field required' })

export class WorkspaceService {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly workspaceAccess: WorkspaceAccessService,
    private readonly accountRepository: AccountRepository,
  ) { }

  async create(ownerAccountId: string, rawInput: z.input<typeof createWorkspaceSchema>): Promise<WorkspaceEntity> {
    const input = createWorkspaceSchema.parse(rawInput)
    const slug = await ensureUniqueSlug(input.name, (candidate: string) => this.repository.slugExists(candidate))

    const owner = await this.accountRepository.findById(ownerAccountId)
    if (!owner) {
      throw new Error('Owner account not found')
    }

    const effectiveTimezone = rawInput.defaultTimezone ?? owner.preferredTimezone ?? 'UTC'

    const workspace = await this.repository.create({
      ownerAccountId,
      name: input.name,
      description: input.description,
      coverImage: input.coverImage,
      defaultLocale: input.defaultLocale,
      defaultTimezone: effectiveTimezone,
      visibility: input.visibility,
      slug,
    })

    const ownerDisplayName = owner.legalName?.trim() && owner.legalName.trim().length > 0 ? owner.legalName.trim() : owner.email.split('@')[0]

    await this.membershipRepository.create({
      workspaceId: workspace.id,
      accountId: ownerAccountId,
      role: 'owner',
      status: 'active',
      preferredLocale: owner.preferredLocale,
      displayName: ownerDisplayName,
      timezone: owner.preferredTimezone ?? effectiveTimezone,
    })

    return workspace
  }

  listOwned(ownerAccountId: string) {
    return this.repository.listByOwner(ownerAccountId)
  }

  getById(id: string) {
    return this.repository.findById(id)
  }

  async update(actorAccountId: string, workspaceId: string, rawInput: z.input<typeof updateWorkspaceSchema>) {
    await this.workspaceAccess.assertAdminOrOwner(actorAccountId, workspaceId)
    const input = updateWorkspaceSchema.parse(rawInput)
    return this.repository.update(workspaceId, input)
  }

  async softDelete(ownerAccountId: string, workspaceId: string): Promise<void> {
    const workspace = await this.repository.findByIdIncludingDeleted(workspaceId)
    if (!workspace || workspace.ownerAccountId !== ownerAccountId) {
      throw new WorkspaceNotFoundError()
    }
    if (workspace.deletedAt) {
      return
    }
    await this.repository.softDelete(workspaceId)
  }
}

export class WorkspaceNotFoundError extends Error {
  constructor() {
    super('Workspace not found or inaccessible')
    this.name = 'WorkspaceNotFoundError'
  }
}
