import { z } from 'zod'
import type { DocumentWorkspaceAccess } from '@prisma/client'
import { DocumentRepository, type DocumentEntity } from './documentRepository'
import { DocumentPermissionRepository, type DocumentPermissionEntity } from './documentPermissionRepository'
import { MembershipRepository, type MembershipEntity } from '../workspaces/membershipRepository'
import { MembershipAccessDeniedError } from '../workspaces/membershipService'
import { DocumentNotFoundError } from './documentService'
import { DocumentAccessService } from './documentAccessService'

const permissionInputSchema = z.object({
  principalType: z.literal('membership'),
  principalId: z.string().uuid(),
  role: z.enum(['viewer', 'commenter', 'editor']),
})

const workspaceAccessSchema = z
  .object({
    defaultAccess: z.enum(['none', 'viewer', 'commenter', 'editor']).optional(),
    editorsAdminOnly: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field required' })

export class DocumentPermissionService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly permissionRepository: DocumentPermissionRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly documentAccess: DocumentAccessService,
  ) {}

  async listPermissions(accountId: string, workspaceId: string, documentId: string) {
    const document = await this.getDocument(documentId, workspaceId)
    await this.assertManager(accountId, workspaceId, document)
    const permissions = await this.permissionRepository.listByDocument(documentId)
    return this.buildSummary(document, permissions)
  }

  async getSummary(accountId: string, workspaceId: string, documentId: string) {
    const access = await this.documentAccess.assertCanView(accountId, workspaceId, documentId)
    const permissions = await this.permissionRepository.listByDocument(documentId)
    return this.buildSummary(access.document, permissions)
  }

  async grantPermission(accountId: string, workspaceId: string, documentId: string, payload: unknown) {
    const document = await this.getDocument(documentId, workspaceId)
    await this.assertManager(accountId, workspaceId, document)
    const input = permissionInputSchema.parse(payload)
    const targetMembership = await this.membershipRepository.findById(input.principalId)
    if (!targetMembership || targetMembership.workspaceId !== workspaceId) {
      throw new DocumentNotFoundError()
    }
    if (targetMembership.status !== 'active') {
      throw new MembershipAccessDeniedError()
    }
    const permission = await this.permissionRepository.upsertMembershipPermission(
      documentId,
      targetMembership.id,
      input.role,
    )
    return permission
  }

  async revokePermission(accountId: string, workspaceId: string, documentId: string, permissionId: string) {
    const document = await this.getDocument(documentId, workspaceId)
    await this.assertManager(accountId, workspaceId, document)
    const permission = await this.permissionRepository.findById(permissionId)
    if (!permission || permission.documentId !== documentId) {
      throw new DocumentNotFoundError()
    }
    await this.permissionRepository.delete(permissionId)
  }

  async updateWorkspaceAccess(accountId: string, workspaceId: string, documentId: string, payload: unknown) {
    const document = await this.getDocument(documentId, workspaceId)
    await this.assertManager(accountId, workspaceId, document)
    const input = workspaceAccessSchema.parse(payload)
    const updated = await this.documentRepository.update(documentId, {
      workspaceDefaultAccess: input.defaultAccess as DocumentWorkspaceAccess | undefined,
      workspaceEditorAdminsOnly: input.editorsAdminOnly,
    })
    return updated
  }

  private async getDocument(documentId: string, workspaceId: string): Promise<DocumentEntity> {
    const document = await this.documentRepository.findById(documentId)
    if (!document || document.workspaceId !== workspaceId || document.deletedAt) {
      throw new DocumentNotFoundError()
    }
    return document
  }

  private async assertManager(accountId: string, workspaceId: string, document: DocumentEntity): Promise<MembershipEntity> {
    const membership = await this.membershipRepository.findByWorkspaceAndAccount(workspaceId, accountId)
    if (!membership) {
      throw new MembershipAccessDeniedError()
    }
    if (membership.role === 'owner' || membership.role === 'admin' || membership.id === document.ownerMembershipId) {
      return membership
    }
    throw new MembershipAccessDeniedError()
  }

  private buildSummary(document: DocumentEntity, permissions: DocumentPermissionEntity[]) {
    return {
      documentId: document.id,
      workspaceDefaultAccess: document.workspaceDefaultAccess,
      workspaceEditorsAdminOnly: document.workspaceEditorAdminsOnly,
      permissions,
    }
  }
}
