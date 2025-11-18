import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import EditorLayout from './layout/EditorLayout'
import AuthLanding from './auth/AuthLanding'
import { AuthProvider, useAuth } from '../context/AuthContext'

const theme = createTheme()

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}

const AppContent = () => {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <EditorLayout /> : <AuthLanding />
}

export default App

