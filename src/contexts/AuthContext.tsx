import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface User {
  name: string
  email: string
  picture: string
  sub: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (userData: User) => void
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Clear all localStorage data (including old user data)
    localStorage.clear()
    
    // Check if user is already logged in (from sessionStorage)
    // sessionStorage persists on refresh but clears when tab is closed
    const savedUser = sessionStorage.getItem('user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        console.error('Error parsing saved user:', error)
        sessionStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = (userData: User) => {
    setUser(userData)
    sessionStorage.setItem('user', JSON.stringify(userData))
  }

  const logout = () => {
    setUser(null)
    sessionStorage.removeItem('user')
    // Sign out from Google
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

