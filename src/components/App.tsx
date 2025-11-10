import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import EditorLayout from './layout/EditorLayout'

const theme = createTheme()

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <EditorLayout />
    </ThemeProvider>
  )
}

export default App

