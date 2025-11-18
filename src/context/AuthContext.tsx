import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LoginInput, SignupInput, LoginResult } from '../lib/api'
import { login as loginRequest, signup as signupRequest } from '../lib/api'

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
  isAuthenticated: boolean
  login: (input: LoginInput) => Promise<LoginResult>
  signup: (input: SignupInput) => Promise<LoginResult>
  logout: () => void
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
    return result
  }, [])

  const signup = useCallback(
    async (input: SignupInput) => {
      await signupRequest(input)
      return login({ email: input.email, password: input.password })
    },
    [login],
  )

  const logout = useCallback(() => {
    setTokens(null)
  }, [])

  const value = useMemo(
    () => ({
      tokens,
      isAuthenticated: Boolean(tokens?.accessToken),
      login,
      signup,
      logout,
    }),
    [tokens, login, signup, logout],
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
