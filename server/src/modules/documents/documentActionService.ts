import { z } from 'zod'
import type { DocumentVisibility, DocumentStatus } from '@prisma/client'
import { DocumentRepository } from './documentRepository'
import { DocumentRevisionRepository } from './documentRevisionRepository'
import { DocumentAccessService } from './documentAccessService'
import { FolderRepository } from './folderRepository'
import { FolderNotFoundError } from './folderService'
import { DocumentPlanLimitService, NoopDocumentPlanLimitService } from './planLimitService'
import { MembershipAccessDeniedError } from '../workspaces/membershipService'
import { DocumentRevisionNotFoundError } from './documentService'

const updatePayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    summary: z.string().trim().max(280).optional(),
    folderId: z.string().uuid().nullable().optional(),
    visibility: z.enum(['private', 'workspace', 'shared', 'public']).optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    sortOrder: z.number().int().optional(),
    expectedUpdatedAt: z.string().datetime(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== 'expectedUpdatedAt'), {
    message: 'No fields to update',
  })

const deleteSchema = z.object({ force: z.boolean().optional() })

export class DocumentUpdateConflictError extends Error {
  constructor() {
    super('Document was updated by another user')
    this.name = 'DocumentUpdateConflictError'
  }
}

export class DocumentActionService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly revisionRepository: DocumentRevisionRepository,
    private readonly folderRepository: FolderRepository,
    private readonly documentAccess: DocumentAccessService,
    private readonly planLimitService: DocumentPlanLimitService = new NoopDocumentPlanLimitService(),
  ) {}

  async getDocument(accountId: string, workspaceId: string, documentId: string) {
    const access = await this.documentAccess.assertCanView(accountId, workspaceId, documentId)
    const revision = await this.revisionRepository.findLatest(documentId)
    if (!revision) {
      throw new DocumentRevisionNotFoundError()
    }
    return { document: access.document, revision }
  }

  async listRevisions(accountId: string, workspaceId: string, documentId: string, limit = 20) {
    await this.documentAccess.assertCanView(accountId, workspaceId, documentId)
    return this.revisionRepository.listByDocument(documentId, limit)
  }

  async updateDocument(accountId: string, workspaceId: string, documentId: string, payload: unknown) {
    const input = updatePayloadSchema.parse(payload)
    const access = await this.documentAccess.assertCanEdit(accountId, workspaceId, documentId)
    await this.planLimitService.assertDocumentEditAllowed(workspaceId)
    let folderId = access.document.folderId
    if (input.folderId !== undefined) {
      folderId = input.folderId
      if (input.folderId) {
        const folder = await this.folderRepository.findById(input.folderId)
        if (!folder || folder.workspaceId !== workspaceId || folder.deletedAt) {
          throw new FolderNotFoundError()
        }
      }
    }

    const updated = await this.documentRepository.updateWithConcurrency(
      documentId,
      new Date(input.expectedUpdatedAt),
      {
        title: input.title,
        summary: input.summary,
        folderId,
        visibility: input.visibility as DocumentVisibility | undefined,
        status: input.status as DocumentStatus | undefined,
        sortOrder: input.sortOrder,
      },
    )
    if (!updated) {
      throw new DocumentUpdateConflictError()
    }
    return updated
  }

  async deleteDocument(accountId: string, workspaceId: string, documentId: string, payload: unknown = {}) {
    z.object({}).parse(payload)
    const access = await this.documentAccess.getAccess(accountId, workspaceId, documentId)
    const membership = access.membership
    const isManager =
      membership.role === 'owner' ||
      membership.role === 'admin' ||
      membership.id === access.document.ownerMembershipId
    if (!isManager) {
      throw new MembershipAccessDeniedError()
    }
    await this.documentRepository.softDelete(documentId)
  }
}
