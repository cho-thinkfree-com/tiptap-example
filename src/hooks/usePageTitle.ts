import { useEffect } from 'react';

export const usePageTitle = (title: string, unsaved: boolean = false) => {
    useEffect(() => {
        const prevTitle = document.title;
        const prefix = unsaved ? '* ' : '';
        document.title = `${prefix}${title} | ododocs`;

        return () => {
            document.title = prevTitle;
        };
    }, [title, unsaved]);
};
