import type { DocumentPermissionRole, DocumentWorkspaceAccess } from '@prisma/client'
import { MembershipRepository, type MembershipEntity } from '../workspaces/membershipRepository'
import { DocumentRepository, type DocumentEntity } from './documentRepository'
import { DocumentPermissionRepository } from './documentPermissionRepository'
import { DocumentNotFoundError } from './documentService'
import { MembershipAccessDeniedError } from '../workspaces/membershipService'

export type DocumentAccessLevel = 'none' | 'viewer' | 'commenter' | 'editor' | 'owner'

export interface DocumentAccessResult {
  document: DocumentEntity
  membership: MembershipEntity
  level: DocumentAccessLevel
}

const levelPriority: Record<DocumentAccessLevel, number> = {
  none: 0,
  viewer: 1,
  commenter: 2,
  editor: 3,
  owner: 4,
}

const permissionRoleToLevel: Record<DocumentPermissionRole, DocumentAccessLevel> = {
  viewer: 'viewer',
  commenter: 'commenter',
  editor: 'editor',
}

const workspaceAccessToLevel: Record<DocumentWorkspaceAccess, DocumentAccessLevel> = {
  none: 'none',
  viewer: 'viewer',
  commenter: 'commenter',
  editor: 'editor',
}

export class DocumentAccessDeniedError extends Error {
  constructor() {
    super('Document access denied')
    this.name = 'DocumentAccessDeniedError'
  }
}

export class DocumentAccessService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly permissionRepository: DocumentPermissionRepository,
    private readonly membershipRepository: MembershipRepository,
  ) {}

  async getAccess(accountId: string, workspaceId: string, documentId: string): Promise<DocumentAccessResult> {
    const document = await this.documentRepository.findById(documentId)
    if (!document || document.workspaceId !== workspaceId || document.deletedAt) {
      throw new DocumentNotFoundError()
    }
    const membership = await this.membershipRepository.findByWorkspaceAndAccount(workspaceId, accountId)
    if (!membership || membership.status !== 'active') {
      throw new MembershipAccessDeniedError()
    }

    let level: DocumentAccessLevel = 'none'

    if (membership.id === document.ownerMembershipId) {
      level = 'owner'
    } else if (membership.role === 'owner') {
      level = 'owner'
    } else if (membership.role === 'admin') {
      level = 'editor'
    } else {
      level = this.applyVisibilityDefaults(document, membership)
      const explicit = await this.permissionRepository.findByDocumentAndMembership(documentId, membership.id)
      if (explicit) {
        level = this.pickHigher(level, permissionRoleToLevel[explicit.role])
      }
    }

    return { document, membership, level }
  }

  async assertCanView(accountId: string, workspaceId: string, documentId: string): Promise<DocumentAccessResult> {
    const access = await this.getAccess(accountId, workspaceId, documentId)
    if (levelPriority[access.level] < levelPriority.viewer) {
      throw new DocumentAccessDeniedError()
    }
    return access
  }

  async assertCanEdit(accountId: string, workspaceId: string, documentId: string): Promise<DocumentAccessResult> {
    const access = await this.getAccess(accountId, workspaceId, documentId)
    if (levelPriority[access.level] < levelPriority.editor) {
      throw new DocumentAccessDeniedError()
    }
    return access
  }

  private applyVisibilityDefaults(document: DocumentEntity, membership: MembershipEntity): DocumentAccessLevel {
    switch (document.visibility) {
      case 'workspace': {
        let level = workspaceAccessToLevel[document.workspaceDefaultAccess]
        if (level === 'editor' && document.workspaceEditorAdminsOnly && membership.role === 'member') {
          level = 'viewer'
        }
        return level
      }
      case 'public':
        return 'viewer'
      case 'shared':
      case 'private':
      default:
        return 'none'
    }
  }

  private pickHigher(current: DocumentAccessLevel, next: DocumentAccessLevel): DocumentAccessLevel {
    return levelPriority[next] > levelPriority[current] ? next : current
  }
}
