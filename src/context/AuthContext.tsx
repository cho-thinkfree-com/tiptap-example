import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LoginInput, SignupInput, LoginResult, AccountResponse } from '../lib/api'
import { login as loginRequest, signup as signupRequest, logout as logoutRequest, getMe } from '../lib/api'



interface AuthContextValue {
  user: AccountResponse | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (input: LoginInput) => Promise<LoginResult>
  signup: (input: SignupInput) => Promise<LoginResult>
  logout: () => Promise<void>
  logoutMessage: string | null
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)



export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AccountResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null)

  const refreshProfile = useCallback(async () => {
    try {
      const { account } = await getMe()
      setUser(account)
    } catch (error) {
      // console.error('Failed to fetch user profile:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  const login = useCallback(async (input: LoginInput) => {
    const result = await loginRequest(input)
    setLogoutMessage(null)
    // Clear manual logout flag on successful login
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('manual-logout')
    }
    await refreshProfile()
    return result
  }, [refreshProfile])

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



  const logout = useCallback(async () => {
    // Set flag to indicate this is a manual logout (not session expiry)
    // This prevents ProtectedRoute from adding redirect parameter
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('manual-logout', 'true')
    }

    try {
      await logoutRequest()
    } catch {
      // ignore failures, still clear local state
    } finally {
      setUser(null)
      setLogoutMessage(null)
    }
  }, [])

  useEffect(() => {
    const handleExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      setLogoutMessage(detail?.message ?? 'auth.sessionExpired')
      setUser(null)
    }

    window.addEventListener('tiptap-auth-expired', handleExpired)
    return () => {
      window.removeEventListener('tiptap-auth-expired', handleExpired)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      signup,
      logout,
      logoutMessage,
      refreshProfile,
    }),
    [user, isLoading, login, signup, logout, logoutMessage, refreshProfile],
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
