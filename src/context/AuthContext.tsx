import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LoginInput, SignupInput, LoginResult, AccountResponse } from '../lib/api'
import { login as loginRequest, signup as signupRequest, logout as logoutRequest, getMe } from '../lib/api'

export interface AuthTokens {
  sessionId: string
  accountId: string
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
}

interface AuthContextValue {
  tokens: AuthTokens | null
  user: AccountResponse | null
  isAuthenticated: boolean
  login: (input: LoginInput) => Promise<LoginResult>
  signup: (input: SignupInput) => Promise<LoginResult>
  logout: () => Promise<void>
  logoutMessage: string | null
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const STORAGE_KEY = 'tiptap-example-auth'

const readStoredTokens = (): AuthTokens | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as AuthTokens
  } catch {
    return null
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [tokens, setTokens] = useState<AuthTokens | null>(() => readStoredTokens())
  const [user, setUser] = useState<AccountResponse | null>(null)
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (tokens) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [tokens])

  const refreshProfile = useCallback(async () => {
    if (!tokens?.accessToken) {
      setUser(null)
      return
    }
    try {
      const profile = await getMe(tokens.accessToken)
      setUser(profile)
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      // Don't logout here, just fail to get profile. Maybe token is valid but server error.
    }
  }, [tokens?.accessToken])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  const login = useCallback(async (input: LoginInput) => {
    const result = await loginRequest(input)
    setTokens({
      sessionId: result.sessionId,
      accountId: result.accountId,
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      refreshToken: result.refreshToken,
      refreshTokenExpiresAt: result.refreshTokenExpiresAt,
    })
    setLogoutMessage(null)
    // Clear manual logout flag on successful login
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('manual-logout')
    }
    return result
  }, [])

  const signup = useCallback(
    async (input: SignupInput) => {
      await signupRequest(input)
      const result = await login({ email: input.email, password: input.password })
      // Force profile refresh to ensure preferredLanguage is loaded
      await refreshProfile()
      setLogoutMessage(null)
      return result
    },
    [login, refreshProfile],
  )

  const accessToken = tokens?.accessToken

  const logout = useCallback(async () => {
    // Set flag to indicate this is a manual logout (not session expiry)
    // This prevents ProtectedRoute from adding redirect parameter
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('manual-logout', 'true')
    }

    try {
      if (accessToken) {
        await logoutRequest(accessToken)
      }
    } catch {
      // ignore failures, still clear local state
    } finally {
      setTokens(null)
      setUser(null)
      setLogoutMessage(null)
    }
  }, [accessToken])

  useEffect(() => {
    const handleExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      setLogoutMessage(detail?.message ?? 'auth.sessionExpired')
      setTokens(null)
      setUser(null)
    }

    const handleRefreshed = (event: Event) => {
      const detail = (event as CustomEvent<LoginResult>).detail
      setTokens({
        sessionId: detail.sessionId,
        accountId: detail.accountId,
        accessToken: detail.accessToken,
        accessTokenExpiresAt: detail.accessTokenExpiresAt,
        refreshToken: detail.refreshToken,
        refreshTokenExpiresAt: detail.refreshTokenExpiresAt,
      })
    }

    window.addEventListener('tiptap-auth-expired', handleExpired)
    window.addEventListener('tiptap-auth-refreshed', handleRefreshed)
    return () => {
      window.removeEventListener('tiptap-auth-expired', handleExpired)
      window.removeEventListener('tiptap-auth-refreshed', handleRefreshed)
    }
  }, [])

  const value = useMemo(
    () => ({
      tokens,
      user,
      isAuthenticated: Boolean(tokens?.accessToken),
      login,
      signup,
      logout,
      logoutMessage,
      refreshProfile,
    }),
    [tokens, user, login, signup, logout, logoutMessage, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
