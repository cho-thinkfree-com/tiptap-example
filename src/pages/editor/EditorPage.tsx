import { Alert, Box, CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getFileSystemEntry, type FileSystemEntry } from '../../lib/api';
import ConnectedEditor from './ConnectedEditor';

const EditorPage = () => {
  const { fileId } = useParams<{ workspaceId: string; fileId: string }>();
  const { isAuthenticated } = useAuth();
  const [document, setDocument] = useState<FileSystemEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lock outer page scroll while editor is mounted so only editor scrolls
  useEffect(() => {
    if (typeof window === 'undefined' || !window.document?.documentElement || !window.document?.body) return undefined;
    const html = window.document.documentElement;
    const body = window.document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && fileId) {
      setLoading(true);
      getFileSystemEntry(fileId)
        .then((docData) => {
          setDocument(docData);
        })
        .catch((err) => {
          setError((err as Error).message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isAuthenticated, fileId]);

  const fullPageBox = (child: React.ReactNode) => (
    <Box sx={{ height: '100dvh', minHeight: '100dvh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {child}
    </Box>
  );

  if (loading) {
    return fullPageBox(<CircularProgress />);
  }

  if (error) {
    return fullPageBox(<Alert severity="error">{error}</Alert>);
  }

  if (!document) {
    return fullPageBox(<Alert severity="warning">Document not found.</Alert>);
  }

  return (
    <Box sx={{ height: '100dvh', minHeight: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <ConnectedEditor
        document={document}
        initialContent={null}
      />
    </Box>
  );
};

export default EditorPage;
