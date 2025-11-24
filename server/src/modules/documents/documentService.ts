import { z } from 'zod'
import type { DocumentStatus, DocumentVisibility } from '@prisma/client'
import { DocumentRepository, type DocumentEntity, type DocumentListFilters } from './documentRepository.js'
import {
  DocumentRevisionRepository,
  type DocumentRevisionEntity,
} from './documentRevisionRepository.js'
import { FolderRepository, type FolderEntity } from './folderRepository.js'
import { MembershipRepository } from '../workspaces/membershipRepository.js'
import { WorkspaceAccessService } from '../workspaces/workspaceAccess.js'
import { ensureUniqueSlug, slugify } from '../../lib/slug.js'
import { FolderNotFoundError } from './folderService.js'
import { MembershipAccessDeniedError } from '../workspaces/membershipService.js'
import {
  DocumentPlanLimitService,
  NoopDocumentPlanLimitService,
} from './planLimitService.js'

const documentStatusEnum: [DocumentStatus, ...DocumentStatus[]] = ['draft', 'published', 'archived']
const documentVisibilityEnum: [DocumentVisibility, ...DocumentVisibility[]] = ['private', 'workspace', 'shared', 'public']
const tiptapJsonSchema = z
  .any()
  .refine((value) => typeof value === 'object' && value !== null, { message: 'content must be object or array' })

const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
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

const calculateContentSize = (content: unknown): number => {
  try {
    const json = JSON.stringify(content ?? {})
    return Buffer.byteLength(json, 'utf8')
  } catch {
    return 0
  }
}

export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly revisionRepository: DocumentRevisionRepository,
    private readonly folderRepository: FolderRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly workspaceAccess: WorkspaceAccessService,
    private readonly planLimitService: DocumentPlanLimitService = new NoopDocumentPlanLimitService(),
  ) { }

  async listWorkspaceDocuments(
    accountId: string,
    workspaceId: string,
    filters: DocumentListFilters = {},
  ): Promise<{ documents: DocumentEntity[]; folders: FolderEntity[] }> {
    await this.workspaceAccess.assertMember(accountId, workspaceId)
    const [documents, folders] = await Promise.all([
      this.documentRepository.listByWorkspace(workspaceId, filters),
      this.folderRepository.listChildren(workspaceId, filters.folderId ?? null),
    ])
    return { documents, folders }
  }

  async listRecentDocuments(accountId: string): Promise<DocumentEntity[]> {
    const memberships = await this.membershipRepository.findByAccount(accountId);
    const workspaceIds = memberships.map(m => m.workspaceId);
    return this.documentRepository.listRecentByWorkspaces(workspaceIds, { limit: 10 });
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

    // Ensure title is unique
    const title = await this.generateUniqueTitle(
      workspaceId,
      input.folderId ?? null,
      input.title || 'Untitled'
    )

    const slug = await this.resolveSlug(workspaceId, input.slug ?? title, {
      strict: Boolean(input.slug),
    })

    const initialContent = input.initialRevision?.content ?? { type: 'doc', content: [] }
    const initialContentSize = calculateContentSize(initialContent)

    const document = await this.documentRepository.create({
      workspaceId,
      folderId: input.folderId ?? null,
      ownerMembershipId: membership.id,
      title,
      slug,
      status: input.status,
      visibility: input.visibility,
      summary: input.summary,
      contentSize: initialContentSize,
      sortOrder: input.sortOrder,
    })

    await this.revisionRepository.create({
      documentId: document.id,
      version: 1,
      content: initialContent,
      contentSize: initialContentSize,
      summary: input.initialRevision?.summary,
      createdByMembershipId: membership.id,
    })

    return document
  }

  private async generateUniqueTitle(
    workspaceId: string,
    folderId: string | null,
    baseTitle: string = 'Untitled'
  ): Promise<string> {
    const existingDocs = await this.documentRepository.listByWorkspace(
      workspaceId,
      { folderId }
    )
    const existingFolders = await this.folderRepository.listChildren(workspaceId, folderId)

    const existingNames = new Set([
      ...existingDocs.map(doc => doc.title.toLowerCase()),
      ...existingFolders.map(folder => folder.name.toLowerCase())
    ])

    if (!existingNames.has(baseTitle.toLowerCase())) {
      return baseTitle
    }

    let counter = 1
    while (existingNames.has(`${baseTitle} (${counter})`.toLowerCase())) {
      counter++
    }

    return `${baseTitle} (${counter})`
  }

  async updateDocument(
    accountId: string,
    workspaceId: string,
    documentId: string,
    rawInput: z.input<typeof updateDocumentSchema>
  ): Promise<DocumentEntity> {
    const document = await this.ensureDocument(documentId, workspaceId)
    await this.workspaceAccess.assertMember(accountId, workspaceId)

    const input = updateDocumentSchema.parse(rawInput)

    if (input.slug) {
      await this.resolveSlug(workspaceId, input.slug, { excludeId: documentId, strict: true })
    }

    if (input.title && input.title !== document.title) {
      // Optional: check for title uniqueness if enforced
    }

    return this.documentRepository.update(documentId, input)
  }

  async appendRevision(
    accountId: string,
    documentId: string,
    rawInput: z.input<typeof revisionSchema>
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
    const contentSize = calculateContentSize(input.content)

    const revision = await this.revisionRepository.create({
      documentId,
      version: nextVersion,
      content: input.content,
      contentSize,
      summary: input.summary,
      createdByMembershipId: membership.id,
    })

    await this.documentRepository.update(documentId, { contentSize })

    return revision
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

  async softDelete(accountId: string, documentId: string): Promise<void> {
    const document = await this.ensureDocument(documentId);
    await this.workspaceAccess.assertMember(accountId, document.workspaceId);
    await this.documentRepository.softDelete(documentId);
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

export class DocumentTitleConflictError extends Error {
  constructor() {
    super('A document or folder with this name already exists')
    this.name = 'DocumentTitleConflictError'
  }
}

export class DocumentRevisionNotFoundError extends Error {
  constructor() {
    super('Revision not found')
    this.name = 'DocumentRevisionNotFoundError'
  }
}
