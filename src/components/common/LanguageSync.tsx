import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n, type Locale } from '../../lib/i18n';

const isWorkspacePath = (pathname: string) => pathname.startsWith('/workspace/') || pathname.startsWith('/document/');

const LanguageSync = () => {
  const { user } = useAuth();
  const { setLocale, locale } = useI18n();
  const location = useLocation();

  useEffect(() => {
    // Respect workspace-level locale overrides; WorkspaceLanguageSync handles those pages.
    if (isWorkspacePath(location.pathname)) {
      return;
    }

    if (user?.preferredLocale && user.preferredLocale !== locale) {
      setLocale(user.preferredLocale as Locale);
    }
  }, [user, locale, setLocale, location.pathname]);

  return null;
};

export default LanguageSync;
