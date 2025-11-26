import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './components/App.tsx'
import { I18nProvider } from './lib/i18n'
import { premiumTheme } from './theme/premiumTheme.ts'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={premiumTheme}>
    <CssBaseline />
    <I18nProvider>
      <App />
    </I18nProvider>
  </ThemeProvider>,
)
