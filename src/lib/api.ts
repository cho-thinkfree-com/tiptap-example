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

const dispatchAuthRefreshed = (tokens: LoginResult) => {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(
    new CustomEvent('tiptap-auth-refreshed', {
      detail: tokens,
    }),
  )
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
    throw new Error(message || 'Request failed')
  }

  return payload as T
}

interface RequestOptions {
  method?: string
  token?: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  skipRefresh?: boolean
}

let refreshPromise: Promise<LoginResult> | null = null

const requestJSON = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = 'GET', token, body, query, skipRefresh } = options
  const url = `${API_BASE_URL}${path}${buildQuery(query)}`
  const headers = new Headers()
  if (body) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 401 && !skipRefresh) {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('tiptap-example-auth') : null
      if (stored) {
        const { refreshToken } = JSON.parse(stored)
        if (refreshToken) {
          // Try to refresh
          try {
            if (!refreshPromise) {
              refreshPromise = fetch(`${API_BASE_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
              }).then(async (res) => {
                if (!res.ok) throw new Error('Refresh failed')
                return res.json() as Promise<LoginResult>
              })
            }

            const newTokens = await refreshPromise

            // Update local storage immediately so subsequent requests use it
            // Note: Multiple requests might do this redundantly but it's safe
            window.localStorage.setItem('tiptap-example-auth', JSON.stringify(newTokens))

            // Notify AuthContext to update state
            // Dispatching multiple times is also fine, or we could debounce this
            dispatchAuthRefreshed(newTokens)

            // Retry original request with new access token
            return requestJSON<T>(path, { ...options, token: newTokens.accessToken, skipRefresh: true })
          } finally {
            // Clear promise so next expiration triggers new refresh
            refreshPromise = null
          }
        }
      }
    } catch (e) {
      // Refresh failed, proceed to logout
    }

    dispatchAuthExpired(
      '세션이 만료되었거나 오랫동안 사용하지 않아 자동으로 로그아웃되었습니다. 다시 로그인해 주세요.',
    )
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
}

export interface LoginResult {
  sessionId: string
  accountId: string
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
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
  }
  token: string
}

export const login = (input: LoginInput) => requestJSON<LoginResult>('/api/auth/login', { method: 'POST', body: input, skipRefresh: true })
export const signup = (input: SignupInput) => requestJSON<AccountResponse>('/api/auth/signup', { method: 'POST', body: input, skipRefresh: true })
export const logout = (token?: string) => requestJSON<{ ok: boolean }>('/api/auth/logout', { method: 'POST', token, skipRefresh: true })
export const getMe = (token: string) => requestJSON<AccountResponse>('/api/auth/me', { token })
export const updateAccount = (token: string, body: { email?: string; legalName?: string; preferredLanguage?: string; preferredTimezone?: string; currentPassword?: string; newPassword?: string }) => requestJSON<AccountResponse>('/api/auth/me', { method: 'PATCH', token, body })
export const refresh = (input: { refreshToken: string }) => requestJSON<LoginResult>('/api/auth/refresh', { method: 'POST', body: input, skipRefresh: true })

export const getWorkspaces = (token: string) =>
  requestJSON<{ items: WorkspaceSummary[] }>('/api/workspaces', { token }).then((payload) => payload.items ?? [])

export const getWorkspace = (workspaceId: string, token: string) =>
  requestJSON<WorkspaceSummary>(`/api/workspaces/${workspaceId}`, { token })

export const getWorkspaceMembers = (workspaceId: string, token: string) =>
  requestJSON<{ items: MembershipSummary[] }>(`/api/workspaces/${workspaceId}/members`, { token })

export const getWorkspaceMemberProfile = (workspaceId: string, token: string) =>
  requestJSON<MembershipSummary>(`/api/workspaces/${workspaceId}/members/me`, { token })

export const updateWorkspaceMemberProfile = (
  workspaceId: string,
  token: string,
  body: {
    displayName?: string
    avatarUrl?: string
    timezone?: string
    preferredLocale?: string
  },
) =>
  requestJSON<MembershipSummary>(`/api/workspaces/${workspaceId}/members/me`, {
    method: 'PATCH',
    token,
    body,
  })

export interface InviteMemberInput {
  accountId: string
  role?: 'owner' | 'admin' | 'member'
}

export const inviteWorkspaceMember = (
  workspaceId: string,
  token: string,
  input: InviteMemberInput,
) =>
  requestJSON<MembershipSummary>(`/api/workspaces/${workspaceId}/members`, {
    method: 'POST',
    token,
    body: input,
  })

export const changeWorkspaceMemberRole = (
  workspaceId: string,
  accountId: string,
  token: string,
  role: 'owner' | 'admin' | 'member',
) =>
  requestJSON<MembershipSummary>(`/api/workspaces/${workspaceId}/members/${accountId}/role`, {
    method: 'PATCH',
    token,
    body: { role },
  })

export const removeWorkspaceMember = (workspaceId: string, accountId: string, token: string) =>
  requestJSON<void>(`/api/workspaces/${workspaceId}/members/${accountId}`, {
    method: 'DELETE',
    token,
  })

export const getWorkspaceDocuments = (
  workspaceId: string,
  token: string,
  options?: { search?: string; folderId?: string },
) =>
  requestJSON<{ documents: DocumentSummary[]; folders: FolderSummary[] }>(
    `/api/workspaces/${workspaceId}/documents`,
    {
      token,
      query: {
        search: options?.search,
        folderId: options?.folderId,
      },
    },
  )

export interface DocumentRevision {
  id: string;
  documentId: string;
  content: Record<string, unknown>;
  authorId: string;
  createdAt: string;
}

export const getRecentDocuments = (token: string) =>
  requestJSON<{ items: DocumentSummary[] }>('/api/documents/recent', { token }).then((payload) => payload.items ?? [])

export const getDocument = (documentId: string, token: string) =>
  requestJSON<DocumentSummary>(`/api/documents/${documentId}`, { token })

export const getLatestRevision = (documentId: string, token: string) =>
  requestJSON<{ document: DocumentSummary; revision: DocumentRevision }>(
    `/api/documents/${documentId}/revisions/latest`,
    { token },
  ).then((payload) => payload.revision)

export const appendRevision = (documentId: string, token: string, body: { content: Record<string, unknown> }) =>
  requestJSON<DocumentRevision>(`/api/documents/${documentId}/revisions`, { method: 'POST', token, body })

export const createDocument = (workspaceId: string, token: string, body: DocumentCreateInput) =>
  requestJSON<DocumentSummary>(`/api/workspaces/${workspaceId}/documents`, { method: 'POST', token, body })

export const deleteDocument = (documentId: string, token: string) =>
  requestJSON<void>(`/api/documents/${documentId}`, { method: 'DELETE', token })

export const renameDocument = (documentId: string, token: string, body: { title: string }) =>
  requestJSON<DocumentSummary>(`/api/documents/${documentId}`, { method: 'PATCH', token, body })

export const createFolder = (workspaceId: string, token: string, body: FolderCreateInput) =>
  requestJSON<FolderSummary>(`/api/workspaces/${workspaceId}/folders`, { method: 'POST', token, body })

export const deleteFolder = (folderId: string, token: string) =>
  requestJSON<void>(`/api/folders/${folderId}`, { method: 'DELETE', token })

export const renameFolder = (folderId: string, token: string, body: { name: string }) =>
  requestJSON<FolderSummary>(`/api/folders/${folderId}`, { method: 'PATCH', token, body })

export const getFolder = (folderId: string, token: string) =>
  requestJSON<{ folder: FolderSummary; ancestors: FolderSummary[] }>(`/api/folders/${folderId}`, { token })

export const addDocumentTag = (documentId: string, token: string, tag: string) =>
  requestJSON<{ name: string }>(`/api/documents/${documentId}/tags`, { method: 'POST', token, body: { name: tag } })

export const removeDocumentTag = (documentId: string, tag: string, token: string) =>
  requestJSON<void>(`/api/documents/${documentId}/tags/${encodeURIComponent(tag)}`, {
    method: 'DELETE',
    token,
  })

export const createShareLink = (documentId: string, token: string) =>
  requestJSON<ShareLinkResponse>(`/api/documents/${documentId}/share-links`, {
    method: 'POST',
    token,
    body: { accessLevel: 'viewer' },
  })

export const updateWorkspace = (workspaceId: string, token: string, body: { name?: string; description?: string }) =>
  requestJSON<WorkspaceSummary>(`/api/workspaces/${workspaceId}`, { method: 'PATCH', token, body })

export const closeWorkspace = (workspaceId: string, token: string) =>
  requestJSON<void>(`/api/workspaces/${workspaceId}`, { method: 'DELETE', token })

export const createWorkspace = (token: string, body: { name: string }) =>
  requestJSON<WorkspaceSummary>('/api/workspaces', { method: 'POST', token, body })

export const checkDocumentTitle = (
  workspaceId: string,
  token: string,
  title: string,
  folderId?: string | null,
  excludeId?: string,
) =>
  requestJSON<{ isDuplicate: boolean }>(
    `/api/workspaces/${workspaceId}/documents/check-title?title=${encodeURIComponent(title)}${folderId ? `&folderId=${folderId}` : ''}${excludeId ? `&excludeId=${excludeId}` : ''}`,
    { token },
  )

export const updateDocument = (
  documentId: string,
  token: string,
  body: {
    title?: string
    folderId?: string | null
    slug?: string
    status?: 'draft' | 'published' | 'archived'
    visibility?: 'private' | 'workspace' | 'shared' | 'public'
    summary?: string
    sortOrder?: number
  },
) => requestJSON<DocumentSummary>(`/api/documents/${documentId}`, { method: 'PATCH', token, body })
