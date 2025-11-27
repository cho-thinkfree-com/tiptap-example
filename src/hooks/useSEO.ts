import { useEffect } from 'react';

interface SEOProps {
    title: string;
    description?: string;
    author?: string;
    publishedTime?: string;
    modifiedTime?: string;
    url?: string;
    type?: 'website' | 'article';
    robots?: string;
}

export const useSEO = ({
    title,
    description,
    author,
    publishedTime,
    modifiedTime,
    url,
    type = 'article',
    robots,
}: SEOProps) => {
    useEffect(() => {
        // Set document title
        const fullTitle = `${title} - ododocs`;
        document.title = fullTitle;

        // Helper function to set or update meta tag
        const setMetaTag = (property: string, content: string, isProperty = true) => {
            const attribute = isProperty ? 'property' : 'name';
            let element = document.querySelector(`meta[${attribute}="${property}"]`);

            if (!element) {
                element = document.createElement('meta');
                element.setAttribute(attribute, property);
                document.head.appendChild(element);
            }

            element.setAttribute('content', content);
        };

        // Basic meta tags
        if (description) {
            setMetaTag('description', description, false);
        }

        if (robots) {
            setMetaTag('robots', robots, false);
        }

        if (author) {
            setMetaTag('author', author, false);
        }

        // Open Graph meta tags
        setMetaTag('og:title', fullTitle);
        setMetaTag('og:type', type);

        if (description) {
            setMetaTag('og:description', description);
        }

        if (url) {
            setMetaTag('og:url', url);
        }

        setMetaTag('og:site_name', 'ododocs');

        // Twitter Card meta tags
        setMetaTag('twitter:card', 'summary_large_image', false);
        setMetaTag('twitter:title', fullTitle, false);

        if (description) {
            setMetaTag('twitter:description', description, false);
        }

        // Article meta tags
        if (type === 'article') {
            if (publishedTime) {
                setMetaTag('article:published_time', publishedTime);
            }

            if (modifiedTime) {
                setMetaTag('article:modified_time', modifiedTime);
            }

            if (author) {
                setMetaTag('article:author', author);
            }
        }

        // Cleanup function to reset title on unmount
        return () => {
            document.title = 'ododocs';
        };
    }, [title, description, author, publishedTime, modifiedTime, url, type, robots]);
};
