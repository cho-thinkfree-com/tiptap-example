// API client for ododocs backend
// Base URL from environment or default to localhost

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9920'

function buildQuery(params?: Record<string, string | number | boolean | undefined>) {
  if (!params) return ''
  const filtered = Object.entries(params).filter(([_, v]) => v !== undefined)
  if (filtered.length === 0) return ''
  const query = new URLSearchParams(filtered.map(([k, v]) => [k, String(v)]))
  return `?${query.toString()}`
}

function dispatchAuthExpired(message: string) {
  const event = new CustomEvent('auth:expired', {
    detail: { message },
    bubbles: true,
    composed: true,
  })
  document.dispatchEvent(event)
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    const error = await response.json().catch(() => ({ error: 'Unauthorized' }))
    dispatchAuthExpired(error.error || 'Session expired')
    throw new ApiError(error.error || 'Unauthorized', 401)
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new ApiError(error.error || `HTTP ${response.status}`, response.status)
  }

  return response.json()
}

interface RequestOptions {
  method?: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
}

async function requestJSON<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options
  const url = `${API_BASE_URL}${path}${buildQuery(query)}`

  const headers: Record<string, string> = {}
  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  return handleResponse<T>(response)
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AccountResponse {
  id: string
  email: string
  status: string
  legalName?: string | null
  preferredLocale?: string | null
  preferredTimezone?: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkspaceSummary {
  id: string
  name: string
  description?: string | null
  visibility: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface MembershipSummary {
  id: string
  workspaceId: string
  accountId: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'invited' | 'pending' | 'removed'
  displayName?: string | null
  avatarUrl?: string | null
  timezone?: string | null
  preferredLocale?: string | null
  blogHandle?: string | null
  blogDescription?: string | null
  blogTheme?: string | null
  createdAt: string
  updatedAt: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface SignupInput {
  email: string
  password: string
  legalName?: string
  preferredLocale?: string
  preferredTimezone?: string
}

export interface LoginResult {
  account: AccountResponse
  session: any
}

// NEW: Unified FileSystemEntry type
export interface FileSystemEntry {
  id: string
  name: string
  type: 'folder' | 'file'
  parentId?: string | null
  workspaceId: string

  // File metadata
  mimeType?: string | null
  extension?: string | null
  size?: string | null // BigInt as string

  // Current revision
  currentRevisionId?: string | null

  // Metadata
  isStarred: boolean
  description?: string | null
  tags: string[]
  viewCount?: number
  summary?: string | null

  // Soft delete
  deletedAt?: string | null
  deletedBy?: string | null
  originalParentId?: string | null

  // Timestamps
  createdAt: string
  updatedAt: string
  createdBy: string
  lastModifiedBy?: string | null
  lastModifiedByName?: string | null

  // Folder information (for documents)
  folderId?: string | null
  folderName?: string | null

  // Relations (optionally populated)
  shareLinks?: any[]
  parent?: FileSystemEntry | null
  children?: FileSystemEntry[]
  currentRevision?: any
  creator?: any
}

// Backwards compatibility aliases
export type DocumentSummary = FileSystemEntry & {
  type: 'file';
  mimeType: 'application/x-odocs';
  title?: string;
  documentNumber?: number;
}
export type FolderSummary = FileSystemEntry & { type: 'folder' }
export type FileSummary = FileSystemEntry & { type: 'file' }

export interface ShareLinkResponse {
  id: string
  token: string
  url: string
  accessType: 'private' | 'link' | 'public'
  expiresAt?: string | null
  requiresPassword?: boolean
}

// ============================================================================
// AUTH API
// ============================================================================

export async function login(input: { email: string; password: string }) {
  return requestJSON<{ account: AccountResponse; session: any }>('/api/v1/auth/login', {
    method: 'POST',
    body: input,
  })
}

export async function signup(input: SignupInput) {
  return requestJSON<{ account: AccountResponse; session: any }>('/api/v1/auth/signup', {
    method: 'POST',
    body: input,
  })
}

export async function logout() {
  return requestJSON<{ success: boolean }>('/api/v1/auth/logout', {
    method: 'POST',
  })
}

export async function getMe() {
  return requestJSON<{ account: AccountResponse }>('/api/v1/auth/me')
}

// ============================================================================
// WORKSPACE API
// ============================================================================

export async function getWorkspaces() {
  const { workspaces } = await requestJSON<{ workspaces: WorkspaceSummary[] }>('/api/v1/workspaces')
  return workspaces
}

export async function getWorkspace(workspaceId: string) {
  return requestJSON<WorkspaceSummary>(`/api/v1/workspaces/${workspaceId}`)
}

export async function createWorkspace(input: { name: string; description?: string; handle?: string }) {
  return requestJSON<WorkspaceSummary>('/api/v1/workspaces', {
    method: 'POST',
    body: input,
  })
}

export async function updateWorkspace(
  workspaceId: string,
  input: { name?: string; description?: string; handle?: string; visibility?: string }
) {
  return requestJSON<WorkspaceSummary>(`/api/v1/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function getWorkspaceMembers(workspaceId: string) {
  const { memberships } = await requestJSON<{ memberships: MembershipSummary[] }>(`/api/v1/workspaces/${workspaceId}/members`)
  return memberships
}

// ============================================================================
// FILE SYSTEM API (NEW UNIFIED API)
// ============================================================================

// List files in workspace root
export async function getWorkspaceFiles(workspaceId: string, folderId?: string | null) {
  const path = folderId
    ? `/api/workspaces/${workspaceId}/files/${folderId}`
    : `/api/workspaces/${workspaceId}/files`

  return requestJSON<FileSystemEntry[]>(path)
}

// Create folder
export async function createFolder(workspaceId: string, name: string, parentId?: string) {
  return requestJSON<FileSystemEntry>(`/api/workspaces/${workspaceId}/folders`, {
    method: 'POST',
    body: { name, parentId },
  })
}

// Create document (.odocs file)
export async function createDocument(
  workspaceId: string,
  title: string,
  content?: any,
  folderId?: string
) {
  return requestJSON<FileSystemEntry>(`/api/workspaces/${workspaceId}/documents`, {
    method: 'POST',
    body: { title, content, folderId },
  })
}

// Get document content
export async function getDocumentContent(documentId: string) {
  return requestJSON<any>(`/api/documents/${documentId}/content`)
}

// Update document content
export async function updateDocumentContent(documentId: string, content: any) {
  return requestJSON<FileSystemEntry>(`/api/documents/${documentId}/content`, {
    method: 'PUT',
    body: { content },
  })
}

// Get single file/folder
export async function getFileSystemEntry(fileId: string) {
  return requestJSON<FileSystemEntry>(`/api/filesystem/${fileId}`)
}

// Rename
export async function renameFileSystemEntry(fileId: string, name: string) {
  return requestJSON<FileSystemEntry>(`/api/filesystem/${fileId}/rename`, {
    method: 'PATCH',
    body: { name },
  })
}

// Update metadata
export async function updateFileSystemEntry(
  fileId: string,
  updates: {
    name?: string;
    displayName?: string;
    description?: string;
    isShared?: boolean;
    isStarred?: boolean;
  }
) {
  return requestJSON<FileSystemEntry>(`/api/filesystem/${fileId}`, {
    method: 'PATCH',
    body: updates,
  })
}

// Move
export async function moveFileSystemEntry(fileId: string, parentId: string | null) {
  return requestJSON<FileSystemEntry>(`/api/filesystem/${fileId}/move`, {
    method: 'PATCH',
    body: { parentId },
  })
}

// Toggle star
export async function toggleFileStar(fileId: string) {
  return requestJSON<FileSystemEntry>(`/api/filesystem/${fileId}/star`, {
    method: 'POST',
  })
}

// Delete
export async function deleteFileSystemEntry(fileId: string) {
  return requestJSON<{ success: boolean }>(`/api/filesystem/${fileId}`, {
    method: 'DELETE',
  })
}

// Restore
export async function restoreFileSystemEntry(fileId: string) {
  return requestJSON<FileSystemEntry>(`/api/filesystem/${fileId}/restore`, {
    method: 'POST',
  })
}

// Get ancestors (breadcrumb)
export async function getFileAncestors(fileId: string) {
  return requestJSON<FileSystemEntry[]>(`/api/filesystem/${fileId}/ancestors`)
}

// Get starred
export async function getStarredFiles(workspaceId: string) {
  return requestJSON<FileSystemEntry[]>(`/api/workspaces/${workspaceId}/starred`)
}

// Get recently modified
export async function getRecentFiles(workspaceId: string, limit?: number) {
  return requestJSON<FileSystemEntry[]>(`/api/workspaces/${workspaceId}/recent`, {
    query: { limit },
  })
}

// Search
export async function searchFiles(workspaceId: string, query: string) {
  return requestJSON<FileSystemEntry[]>(`/api/workspaces/${workspaceId}/search`, {
    query: { q: query },
  })
}

// Create share link
export async function createShareLink(
  fileId: string,
  options?: { password?: string; expiresAt?: string; accessType?: 'private' | 'link' | 'public' }
) {
  return requestJSON<ShareLinkResponse>(`/api/filesystem/${fileId}/share`, {
    method: 'POST',
    body: options,
  })
}

// Alias for backward compatibility
export const createFileShareLink = createShareLink

// Get shared file (public)
export async function getSharedFile(token: string, password?: string) {
  return requestJSON<{ file: FileSystemEntry; shareLink: any }>(`/api/share/${token}`, {
    query: { password },
  })
}

// Download shared file
export function getSharedFileDownloadUrl(token: string, password?: string) {
  const query = password ? `?password=${encodeURIComponent(password)}` : ''
  return `${API_BASE_URL}/api/share/${token}/download${query}`
}

// ============================================================================
// BACKWARDS COMPATIBILITY (deprecated but still work)
// ============================================================================

// Aliases for backward compatibility
export const getWorkspaceDocuments = getWorkspaceFiles
export const getFolder = getFileSystemEntry
export const renameDocument = renameFileSystemEntry
export const renameFolder = renameFileSystemEntry

// Delete aliases
export const deleteFile = deleteFileSystemEntry
export const deleteDocument = deleteFileSystemEntry
export const deleteFolder = deleteFileSystemEntry

// Upload to S3 directly
export async function uploadFileToS3(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  })

  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.statusText}`)
  }

  return response
}
export const restoreDocument = restoreFileSystemEntry
export const restoreFolder = restoreFileSystemEntry
export const toggleDocumentStarred = toggleFileStar
export const toggleFolderStarred = toggleFileStar
export const downloadDocument = (documentId: string) => {
  return `${API_BASE_URL}/api/files/${documentId}/download`
}
export const moveFolder = moveFileSystemEntry
export const updateDocument = updateDocumentContent

// Upload file (presigned URL flow)
export async function initiateFileUpload(
  workspaceId: string,
  name: string,
  mimeType: string,
  size: number,
  folderId?: string
) {
  return requestJSON<{ uploadUrl: string; uploadKey: string; fileId: string }>(
    `/api/workspaces/${workspaceId}/files/upload`,
    {
      method: 'POST',
      body: { name, mimeType, size, folderId },
    }
  )
}

export async function confirmFileUpload(
  workspaceId: string,
  uploadKey: string,
  name: string,
  mimeType: string,
  size: number,
  folderId?: string
) {
  return requestJSON<FileSystemEntry>(`/api/workspaces/${workspaceId}/files/confirm`, {
    method: 'POST',
    body: { uploadKey, name, mimeType, size, folderId },
  })
}

// ============================================================================
// LEGACY/STUB FUNCTIONS (for compatibility)
// ============================================================================

// Account
export async function updateAccount(body: any) {
  return requestJSON<any>('/api/v1/auth/update', {
    method: 'PATCH',
    body,
  })
}

// Workspace Members
export async function getWorkspaceMemberProfile(workspaceId: string, accountId?: string) {
  // If accountId not provided, backend will use current user from auth token
  const endpoint = accountId
    ? `/api/v1/workspaces/${workspaceId}/members/${accountId}`
    : `/api/v1/workspaces/${workspaceId}/members/me`
  return requestJSON<any>(endpoint)
}

export async function updateWorkspaceMemberProfile(workspaceId: string, accountIdOrBody: string | any, body?: any) {
  // Support both signatures:
  // 1. updateWorkspaceMemberProfile(workspaceId, body)
  // 2. updateWorkspaceMemberProfile(workspaceId, accountId, body)
  const isBodyOnly = typeof accountIdOrBody === 'object'
  const endpoint = isBodyOnly
    ? `/api/v1/workspaces/${workspaceId}/members/me`
    : `/api/v1/workspaces/${workspaceId}/members/${accountIdOrBody}`
  const requestBody = isBodyOnly ? accountIdOrBody : body

  return requestJSON<any>(endpoint, {
    method: 'PATCH',
    body: requestBody,
  })
}

export async function getWorkspaceMemberPublicProfile(workspaceIdOrHandle: string, membershipId?: string) {
  if (membershipId) {
    return requestJSON<any>(`/api/v1/blog/${workspaceIdOrHandle}/${membershipId}/profile`)
  }
  return requestJSON<any>(`/api/v1/blog/${workspaceIdOrHandle}/profile`)
}

export async function inviteWorkspaceMember(workspaceId: string, email: string, role: string) {
  return requestJSON<any>(`/api/v1/workspaces/${workspaceId}/members`, {
    method: 'POST',
    body: { email, role },
  })
}

export async function changeWorkspaceMemberRole(workspaceId: string, membershipId: string, role: string) {
  return requestJSON<any>(`/api/v1/workspaces/${workspaceId}/members/${membershipId}/role`, {
    method: 'PATCH',
    body: { role },
  })
}

export async function removeWorkspaceMember(workspaceId: string, membershipId: string) {
  return requestJSON<any>(`/api/v1/workspaces/${workspaceId}/members/${membershipId}`, {
    method: 'DELETE',
  })
}

// Share Links (legacy)
export async function getShareLinks(documentId: string) {
  return requestJSON<any[]>(`/api/v1/documents/${documentId}/share-links`)
}

export async function revokeShareLink(linkId: string) {
  return requestJSON<any>(`/api/v1/share-links/${linkId}/revoke`, {
    method: 'POST',
  })
}

export async function updateShareLink(linkId: string, body: any) {
  return requestJSON<any>(`/api/v1/share-links/${linkId}`, {
    method: 'PATCH',
    body,
  })
}

export async function resolveShareLink(token: string, password?: string) {
  return requestJSON<any>(`/api/v1/share-links/${token}/access`, {
    method: 'POST',
    body: { password },
  })
}

// Documents (legacy)
export async function getRecentDocuments(params?: any) {
  return requestJSON<any[]>('/api/v1/documents/recent', {
    query: params,
  })
}

export async function getPublicDocuments(workspaceId: string) {
  return requestJSON<any[]>(`/api/v1/workspaces/${workspaceId}/public-documents`)
}

export async function getAuthorPublicDocuments(identifier: string, type: 'handle' | 'token' = 'handle', page = 1, limit = 10) {
  if (type === 'token') {
    return requestJSON<any>(`/api/v1/share-links/${identifier}/author-documents`, {
      query: { page, limit },
    })
  }
  return requestJSON<any>(`/api/v1/blog/${identifier}/documents`, {
    query: { page, limit },
  })
}

export async function getWorkspaceMemberPublicDocuments(workspaceIdOrHandle: string, membershipIdOrPage?: string | number, pageOrLimit: number = 1, _limit: number = 10) {
  // Handle overload: (handle, page, limit) vs (workspaceId, membershipId)
  // Since page is number and membershipId is string (UUID), we can distinguish.

  if (typeof membershipIdOrPage === 'string') {
    // (workspaceId, membershipId) case - Legacy
    // Note: Legacy route might not support pagination yet, or we need to add it.
    // Assuming legacy route returns all docs or default limit.
    return requestJSON<any>(`/api/v1/blog/${workspaceIdOrHandle}/${membershipIdOrPage}/documents`)
  }

  // (handle, page, limit) case
  const page = typeof membershipIdOrPage === 'number' ? membershipIdOrPage : 1
  return requestJSON<any>(`/api/v1/blog/${workspaceIdOrHandle}/documents`, {
    query: { page, limit: pageOrLimit },
  })
}

// Blog
export async function getBlogByHandle(handle: string, page = 1, limit = 10) {
  return requestJSON<any>(`/api/v1/blog/${handle}`, {
    query: { page, limit },
  })
}

export async function checkBlogHandleAvailability(handle: string) {
  return requestJSON<{ available: boolean }>(`/api/v1/blog/check/${handle}`)
}

export async function getBlogDocument(handle: string, documentNumber: string) {
  return requestJSON<any>(`/api/v1/blog/${handle}/documents/${documentNumber}`)
}

// Trash
export async function listTrash(workspaceId: string, params?: any) {
  return requestJSON<any>(`/api/v1/workspaces/${workspaceId}/trash`, {
    query: params,
  })
}

export async function permanentlyDeleteDocument(documentId: string) {
  return requestJSON<any>(`/api/v1/documents/${documentId}/permanent`, {
    method: 'DELETE',
  })
}

export async function permanentlyDeleteFolder(folderId: string) {
  return requestJSON<any>(`/api/v1/folders/${folderId}/permanent`, {
    method: 'DELETE',
  })
}

// Assets
export async function resolveAssetUrls(workspaceId: string, documentId: string, urls: string[], shareToken?: string) {
  const { resolved } = await requestJSON<{ resolved: Record<string, string> }>(
    `/api/workspaces/${workspaceId}/files/${documentId}/assets/resolve`,
    {
      method: 'POST',
      body: { urls, shareToken },
    }
  )
  return resolved
}

export async function getAssetUploadUrl(workspaceId: string, documentId: string, mimeType: string) {
  return requestJSON<{ uploadUrl: string; odocsUrl: string }>(`/api/workspaces/${workspaceId}/files/${documentId}/assets/upload`, {
    method: 'POST',
    body: { mimeType },
  })
}

export async function uploadAssetToS3(uploadUrl: string, file: File) {
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  })
}

// Export types for compatibility
export type DocumentRevision = any
export type AuthorDocument = any
