import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n, type Locale } from '../../lib/i18n';
import { getWorkspaceMemberProfile } from '../../lib/api';

const WorkspaceLanguageSync = () => {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const { tokens, user } = useAuth();
    const { setLocale } = useI18n();

    useEffect(() => {
        const syncLanguage = async () => {
            if (workspaceId && tokens) {
                try {
                    const profile = await getWorkspaceMemberProfile(workspaceId, tokens.accessToken);
                    if (profile.preferredLocale) {
                        setLocale(profile.preferredLocale as Locale);
                    }
                } catch (error) {
                    console.error('Failed to fetch workspace profile language:', error);
                }
            } else if (!workspaceId && user?.preferredLocale) {
                // When not in a workspace, revert to global user language
                setLocale(user.preferredLocale as Locale);
            }
        };

        syncLanguage();
    }, [workspaceId, tokens, user, setLocale]);

    return null;
};

export default WorkspaceLanguageSync;
