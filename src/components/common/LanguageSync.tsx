import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n, type Locale } from '../../lib/i18n';

const LanguageSync = () => {
    const { user } = useAuth();
    const { setLocale, locale } = useI18n();

    useEffect(() => {
        console.log('[LanguageSync] User language:', user?.preferredLocale, 'Current locale:', locale);
        if (user?.preferredLocale && user.preferredLocale !== locale) {
            console.log('[LanguageSync] Switching locale to:', user.preferredLocale);
            setLocale(user.preferredLocale as Locale);
        }
    }, [user, locale, setLocale]);

    return null;
};

export default LanguageSync;
