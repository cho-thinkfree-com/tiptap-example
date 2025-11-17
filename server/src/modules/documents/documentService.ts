import { z } from 'zod'
import type { DocumentStatus, DocumentVisibility } from '@prisma/client'
import { DocumentRepository, type DocumentEntity, type DocumentListFilters } from './documentRepository'
import {
  DocumentRevisionRepository,
  type DocumentRevisionEntity,
} from './documentRevisionRepository'
import { FolderRepository, type FolderEntity } from './folderRepository'
import { MembershipRepository } from '../workspaces/membershipRepository'
import { WorkspaceAccessService } from '../workspaces/workspaceAccess'
import { ensureUniqueSlug, slugify } from '../../lib/slug'
import { FolderNotFoundError } from './folderService'
import { MembershipAccessDeniedError } from '../workspaces/membershipService'
import {
  DocumentPlanLimitService,
  NoopDocumentPlanLimitService,
} from './planLimitService'

const documentStatusEnum: [DocumentStatus, ...DocumentStatus[]] = ['draft', 'published', 'archived']
const documentVisibilityEnum: [DocumentVisibility, ...DocumentVisibility[]] = ['private', 'workspace', 'shared', 'public']
const tiptapJsonSchema = z
  .any()
  .refine((value) => typeof value === 'object' && value !== null, { message: 'content must be object or array' })

const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  folderId: z.string().uuid().optional().nullable(),
  slug: z.string().trim().min(1).max(160).optional(),
  visibility: z.enum(documentVisibilityEnum).default('private'),
  status: z.enum(documentStatusEnum).default('draft'),
  summary: z.string().trim().max(280).optional(),
  sortOrder: z.number().int().optional(),
  initialRevision: z
    .object({
      content: tiptapJsonSchema,
      summary: z.string().trim().max(280).optional(),
    })
    .optional(),
})

const updateDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    folderId: z.string().uuid().nullable().optional(),
    slug: z.string().trim().min(1).max(160).optional(),
    visibility: z.enum(documentVisibilityEnum).optional(),
    status: z.enum(documentStatusEnum).optional(),
    summary: z.string().trim().max(280).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field required' })

const revisionSchema = z.object({
  content: tiptapJsonSchema,
  summary: z.string().trim().max(280).optional(),
})

export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly revisionRepository: DocumentRevisionRepository,
    private readonly folderRepository: FolderRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly workspaceAccess: WorkspaceAccessService,
    private readonly planLimitService: DocumentPlanLimitService = new NoopDocumentPlanLimitService(),
  ) {}

  async listWorkspaceDocuments(
    accountId: string,
    workspaceId: string,
    filters: DocumentListFilters = {},
  ): Promise<{ documents: DocumentEntity[]; folders: FolderEntity[] }> {
    await this.workspaceAccess.assertMember(accountId, workspaceId)
    const [documents, folders] = await Promise.all([
      this.documentRepository.listByWorkspace(workspaceId, filters),
      this.folderRepository.listByWorkspace(workspaceId),
    ])
    return { documents, folders }
  }

  async createDocument(
    accountId: string,
    workspaceId: string,
    rawInput: z.input<typeof createDocumentSchema>,
  ): Promise<DocumentEntity> {
    await this.workspaceAccess.assertMember(accountId, workspaceId)
    const membership = await this.membershipRepository.findByWorkspaceAndAccount(workspaceId, accountId)
    if (!membership) {
      throw new MembershipAccessDeniedError()
    }
    const input = createDocumentSchema.parse(rawInput)
    const folder = input.folderId ? await this.ensureFolder(workspaceId, input.folderId) : null
    if (folder?.deletedAt) throw new FolderNotFoundError()
    await this.planLimitService.assertDocumentCreateAllowed(workspaceId)
    const slug = await this.resolveSlug(workspaceId, input.slug ?? input.title, {
      strict: Boolean(input.slug),
    })

    const document = await this.documentRepository.create({
      workspaceId,
      folderId: input.folderId ?? null,
      ownerMembershipId: membership.id,
      title: input.title,
      slug,
      status: input.status,
      visibility: input.visibility,
      summary: input.summary,
      sortOrder: input.sortOrder,
    })

    if (input.initialRevision) {
      await this.revisionRepository.create({
        documentId: document.id,
        version: 1,
        content: input.initialRevision.content,
        summary: input.initialRevision.summary,
        createdByMembershipId: membership.id,
      })
    }
    return document
  }

  async updateDocument(
    accountId: string,
    workspaceId: string,
    documentId: string,
    rawInput: z.input<typeof updateDocumentSchema>,
  ) {
    await this.workspaceAccess.assertMember(accountId, workspaceId)
    const document = await this.ensureDocument(documentId, workspaceId)
    const input = updateDocumentSchema.parse(rawInput)
    let folderId = input.folderId ?? document.folderId ?? null
    if (input.folderId !== undefined) {
      const folder = input.folderId ? await this.ensureFolder(workspaceId, input.folderId) : null
      if (folder?.deletedAt) throw new FolderNotFoundError()
      folderId = input.folderId
    }
    let slug = document.slug
    if (input.slug) {
      slug = await this.resolveSlug(workspaceId, input.slug, { excludeId: document.id, strict: true })
    }

    return this.documentRepository.update(documentId, {
      title: input.title,
      folderId,
      slug,
      status: input.status,
      visibility: input.visibility,
      summary: input.summary,
      sortOrder: input.sortOrder,
    })
  }

  async appendRevision(
    accountId: string,
    documentId: string,
    rawInput: z.input<typeof revisionSchema>,
  ): Promise<DocumentRevisionEntity> {
    const document = await this.ensureDocument(documentId)
    await this.workspaceAccess.assertMember(accountId, document.workspaceId)
    const membership = await this.membershipRepository.findByWorkspaceAndAccount(document.workspaceId, accountId)
    if (!membership) {
      throw new MembershipAccessDeniedError()
    }
    await this.planLimitService.assertDocumentEditAllowed(document.workspaceId)
    const input = revisionSchema.parse(rawInput)
    const latest = await this.revisionRepository.findLatest(documentId)
    const nextVersion = (latest?.version ?? 0) + 1
    return this.revisionRepository.create({
      documentId,
      version: nextVersion,
      content: input.content,
      summary: input.summary,
      createdByMembershipId: membership.id,
    })
  }

  async getLatestRevision(accountId: string, documentId: string) {
    const document = await this.ensureDocument(documentId)
    await this.workspaceAccess.assertMember(accountId, document.workspaceId)
    const revision = await this.revisionRepository.findLatest(documentId)
    if (!revision) {
      throw new DocumentRevisionNotFoundError()
    }
    return { document, revision }
  }

  private async ensureFolder(workspaceId: string, folderId: string) {
    const folder = await this.folderRepository.findById(folderId)
    if (!folder || folder.workspaceId !== workspaceId) {
      throw new FolderNotFoundError()
    }
    return folder
  }

  private async ensureDocument(documentId: string, workspaceId?: string) {
    const document = await this.documentRepository.findById(documentId)
    if (!document || document.deletedAt) {
      throw new DocumentNotFoundError()
    }
    if (workspaceId && document.workspaceId !== workspaceId) {
      throw new DocumentNotFoundError()
    }
    return document
  }

  private async resolveSlug(
    workspaceId: string,
    rawValue: string,
    options: { excludeId?: string; strict?: boolean } = {},
  ) {
    const formatted = slugify(rawValue)
    if (options.strict || options.excludeId) {
      if (await this.documentRepository.slugExists(workspaceId, formatted, options.excludeId)) {
        throw new DocumentSlugConflictError()
      }
      return formatted
    }
    return ensureUniqueSlug(rawValue, (candidate) => this.documentRepository.slugExists(workspaceId, candidate))
  }
}

export class DocumentNotFoundError extends Error {
  constructor() {
    super('Document not found')
    this.name = 'DocumentNotFoundError'
  }
}

export class DocumentSlugConflictError extends Error {
  constructor() {
    super('Document slug already exists in this workspace')
    this.name = 'DocumentSlugConflictError'
  }
}

export class DocumentRevisionNotFoundError extends Error {
  constructor() {
    super('Revision not found')
    this.name = 'DocumentRevisionNotFoundError'
  }
}
