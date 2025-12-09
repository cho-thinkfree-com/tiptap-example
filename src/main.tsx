import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './components/App.tsx'
import { I18nProvider } from './lib/i18n'
import { baseTheme } from './theme/baseTheme.ts'
import './styles/global.css'
import 'highlight.js/styles/atom-one-light.css'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={baseTheme}>
    <CssBaseline />
    <I18nProvider>
      <App />
    </I18nProvider>
  </ThemeProvider>,
)
