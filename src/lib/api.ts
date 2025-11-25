const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000').replace(/\/+$/, '')

const buildQuery = (params?: Record<string, string | number | boolean | undefined>) => {
  if (!params) return ''
  const entries = Object.entries(params)
    .map(([key, value]) => (value === undefined ? null : `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`))
    .filter((entry): entry is string => entry !== null)
  if (entries.length === 0) return ''
  return `?${entries.join('&')}`
}

const dispatchAuthExpired = (message: string) => {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(
    new CustomEvent('tiptap-auth-expired', {
      detail: {
        message,
      },
    }),
  )
}


export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in (payload as Record<string, unknown>)
        ? (payload as Record<string, string>).message
        : response.statusText
    throw new ApiError(message || 'Request failed', response.status)
  }

  return payload as T
}

interface RequestOptions {
  method?: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
}

const requestJSON = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = 'GET', body, query } = options
  const url = `${API_BASE_URL}${path}${buildQuery(query)}`
  const headers = new Headers()
  if (body) {
    headers.set('Content-Type', 'application/json')
  }

  console.log(`[API] ${method} ${path}`)
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  if (response.status === 401) {
    dispatchAuthExpired('auth.sessionExpired')
  }

  return handleResponse<T>(response)
}

export interface LoginInput {
  email: string
  password: string
}

export interface SignupInput extends LoginInput {
  legalName?: string
  preferredLocale?: string
  preferredTimezone?: string
}

export interface LoginResult {
  sessionId: string
  accountId: string
  expiresAt: string
}

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
  slug: string
  description?: string | null
  visibility: string
  ownerAccountId: string
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
  timezone?: string | null
  preferredLocale?: string | null
}

export interface FolderSummary {
  id: string
  workspaceId: string
  name: string
  parentId?: string | null
  pathCache: string
  createdAt: string
  updatedAt: string
}

export interface DocumentSummary {
  id: string
  workspaceId: string
  title: string
  slug: string
  status: string
  visibility: string
  folderId?: string | null
  summary?: string | null
  contentSize?: number
  createdAt: string
  updatedAt: string
  tags: string[]
  lastModifiedBy?: string | null
}

export interface DocumentCreateInput {
  title?: string
  folderId?: string | null
  slug?: string
  visibility?: 'private' | 'workspace' | 'shared' | 'public'
  status?: 'draft' | 'published' | 'archived'
  summary?: string
  sortOrder?: number
  initialRevision?: {
    content: Record<string, unknown>
    summary?: string
  }
}
export interface FolderCreateInput {
  name: string
  parentId?: string | null
}

export interface ShareLinkResponse {
  shareLink: {
    id: string
    token: string
    accessLevel: string
    revokedAt?: string | null
    expiresAt?: string | null
    allowExternalEdit?: boolean
  }
  token: string
}

export const login = (input: LoginInput) => requestJSON<LoginResult>('/api/auth/login', { method: 'POST', body: input })
export const signup = (input: SignupInput) => requestJSON<AccountResponse>('/api/auth/signup', { method: 'POST', body: input })
export const logout = async () => {
  return requestJSON<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
  })
}
export const getMe = () => requestJSON<AccountResponse>('/api/auth/me')
export const updateAccount = (body: { email?: string; legalName?: string; preferredLanguage?: string; preferredTimezone?: string; currentPassword?: string; newPassword?: string }) => requestJSON<AccountResponse>('/api/auth/me', { method: 'PATCH', body })

export const getWorkspaces = () =>
  requestJSON<{ items: WorkspaceSummary[] }>('/api/workspaces').then((payload) => payload.items ?? [])

export const getWorkspace = (workspaceId: string) =>
  requestJSON<WorkspaceSummary>(`/api/workspaces/${workspaceId}`)

export const getWorkspaceMembers = (workspaceId: string) =>
  requestJSON<{ items: MembershipSummary[] }>(`/api/workspaces/${workspaceId}/members`)

export const getWorkspaceMemberProfile = (workspaceId: string) =>
  requestJSON<MembershipSummary>(`/api/workspaces/${workspaceId}/members/me`)

export const updateWorkspaceMemberProfile = (
  workspaceId: string,
  body: {
    displayName?: string
    avatarUrl?: string
    timezone?: string
    preferredLocale?: string
  },
) =>
  requestJSON<MembershipSummary>(`/api/workspaces/${workspaceId}/members/me`, {
    method: 'PATCH',
    body,
  })

export interface InviteMemberInput {
  accountId: string
  role?: 'owner' | 'admin' | 'member'
}

export const inviteWorkspaceMember = (
  workspaceId: string,
  input: InviteMemberInput,
) =>
  requestJSON<MembershipSummary>(`/api/workspaces/${workspaceId}/members`, {
    method: 'POST',
    body: input,
  })

export const changeWorkspaceMemberRole = (
  workspaceId: string,
  accountId: string,
  role: 'owner' | 'admin' | 'member',
) =>
  requestJSON<MembershipSummary>(`/api/workspaces/${workspaceId}/members/${accountId}/role`, {
    method: 'PATCH',
    body: { role },
  })

export const removeWorkspaceMember = (workspaceId: string, accountId: string) =>
  requestJSON<void>(`/api/workspaces/${workspaceId}/members/${accountId}`, {
    method: 'DELETE',
  })

export const getWorkspaceDocuments = (
  workspaceId: string,
  options?: { search?: string; folderId?: string },
) =>
  requestJSON<{ documents: DocumentSummary[]; folders: FolderSummary[] }>(
    `/api/workspaces/${workspaceId}/documents`,
    {
      query: {
        search: options?.search,
        folderId: options?.folderId,
      },
    },
  )

export const getRecentDocuments = (workspaceId: string) =>
  requestJSON<DocumentSummary[]>(`/api/workspaces/${workspaceId}/documents/recent`)

export interface DocumentRevision {
  id: string;
  documentId: string;
  content: Record<string, unknown>;
  contentSize?: number;
  authorId: string;
  createdAt: string;
}

export const getDocument = (documentId: string) =>
  requestJSON<DocumentSummary>(`/api/documents/${documentId}`)

export const getLatestRevision = (documentId: string) =>
  requestJSON<{ document: DocumentSummary; revision: DocumentRevision }>(
    `/api/documents/${documentId}/revisions/latest`,
  ).then((payload) => payload.revision)

export const appendRevision = (documentId: string, body: { content: Record<string, unknown> }) =>
  requestJSON<DocumentRevision>(`/api/documents/${documentId}/revisions`, { method: 'POST', body })

export const createDocument = (workspaceId: string, body: DocumentCreateInput) =>
  requestJSON<DocumentSummary>(`/api/workspaces/${workspaceId}/documents`, { method: 'POST', body })

export const deleteDocument = (documentId: string) =>
  requestJSON<void>(`/api/documents/${documentId}`, { method: 'DELETE' })

export const renameDocument = (documentId: string, body: { title: string }) =>
  requestJSON<DocumentSummary>(`/api/documents/${documentId}`, { method: 'PATCH', body })

export const createFolder = (workspaceId: string, body: FolderCreateInput) =>
  requestJSON<FolderSummary>(`/api/workspaces/${workspaceId}/folders`, { method: 'POST', body })

export const deleteFolder = (folderId: string) =>
  requestJSON<void>(`/api/folders/${folderId}`, { method: 'DELETE' })

export const renameFolder = (folderId: string, body: { name: string }) =>
  requestJSON<FolderSummary>(`/api/folders/${folderId}`, { method: 'PATCH', body })

export const getFolder = (folderId: string) =>
  requestJSON<{ folder: FolderSummary; ancestors: FolderSummary[] }>(`/api/folders/${folderId}`)

export const addDocumentTag = (documentId: string, tag: string) =>
  requestJSON<{ name: string }>(`/api/documents/${documentId}/tags`, { method: 'POST', body: { name: tag } })

export const removeDocumentTag = (documentId: string, tag: string) =>
  requestJSON<void>(`/api/documents/${documentId}/tags/${encodeURIComponent(tag)}`, {
    method: 'DELETE',
  })

export const createShareLink = (documentId: string) =>
  requestJSON<ShareLinkResponse>(`/api/documents/${documentId}/share-links`, {
    method: 'POST',
    body: { accessLevel: 'viewer' },
  })

export const getShareLinks = (documentId: string) =>
  requestJSON<{ shareLinks: ShareLinkResponse['shareLink'][] }>(`/api/documents/${documentId}/share-links`).then((payload) => payload.shareLinks)

export const revokeShareLink = (shareLinkId: string) =>
  requestJSON<void>(`/api/share-links/${shareLinkId}`, { method: 'DELETE' })

export const updateShareLink = (shareLinkId: string, body: { allowExternalEdit: boolean }) =>
  requestJSON<ShareLinkResponse['shareLink']>(`/api/share-links/${shareLinkId}`, {
    method: 'PATCH',
    body,
  })

export const resolveShareLink = (token: string, password?: string) =>
  requestJSON<{
    token: string
    document: DocumentSummary
    revision: DocumentRevision | null
    accessLevel: string
  }>(`/api/share-links/${token}/access`, {
    method: 'POST',
    body: { password },
  })

export const updateWorkspace = (workspaceId: string, body: { name?: string; description?: string }) =>
  requestJSON<WorkspaceSummary>(`/api/workspaces/${workspaceId}`, { method: 'PATCH', body })

export const closeWorkspace = (workspaceId: string) =>
  requestJSON<void>(`/api/workspaces/${workspaceId}`, { method: 'DELETE' })

export const createWorkspace = (body: { name: string }) =>
  requestJSON<WorkspaceSummary>('/api/workspaces', { method: 'POST', body })

export const checkDocumentTitle = (
  workspaceId: string,
  title: string,
  folderId?: string | null,
  excludeId?: string,
) =>
  requestJSON<{ isDuplicate: boolean }>(
    `/api/workspaces/${workspaceId}/documents/check-title?title=${encodeURIComponent(title)}${folderId ? `&folderId=${folderId}` : ''}${excludeId ? `&excludeId=${excludeId}` : ''}`,
  )

export const updateDocument = (
  documentId: string,
  body: {
    title?: string
    folderId?: string | null
    slug?: string
    status?: 'draft' | 'published' | 'archived'
    visibility?: 'private' | 'workspace' | 'shared' | 'public'
    summary?: string
    sortOrder?: number
  },
) => requestJSON<DocumentSummary>(`/api/documents/${documentId}`, { method: 'PATCH', body })

export const downloadDocument = async (documentId: string) => {
  const url = `${API_BASE_URL}/api/documents/${documentId}/download`

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new ApiError(response.statusText, response.status)
  }

  const blob = await response.blob()
  const contentDisposition = response.headers.get('Content-Disposition')
  let filename = 'document.odocs'
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/) || contentDisposition.match(/filename="(.+)"/)
    if (filenameMatch && filenameMatch[1]) {
      filename = decodeURIComponent(filenameMatch[1])
    }
  }

  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(downloadUrl)
}

// Trash management
export const listTrash = async (workspaceId: string) => {
  return requestJSON(`/api/workspaces/${workspaceId}/trash`, {
    method: 'GET',
  })
}

export const restoreDocument = async (documentId: string) => {
  return requestJSON(`/api/trash/restore/document/${documentId}`, {
    method: 'POST',
  })
}

export const permanentlyDeleteDocument = async (documentId: string) => {
  return requestJSON(`/api/trash/document/${documentId}`, {
    method: 'DELETE',
  })
}

export const restoreFolder = async (folderId: string) => {
  return requestJSON(`/api/trash/restore/folder/${folderId}`, {
    method: 'POST',
  })
}

export const permanentlyDeleteFolder = async (folderId: string) => {
  return requestJSON(`/api/trash/folder/${folderId}`, {
    method: 'DELETE',
  })
}
