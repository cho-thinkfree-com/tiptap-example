import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './components/App.tsx'
import { I18nProvider } from './lib/i18n'

createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
)
