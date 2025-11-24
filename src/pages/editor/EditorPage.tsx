import { Alert, Box, CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDocument, getLatestRevision, type DocumentRevision, type DocumentSummary } from '../../lib/api';
import ConnectedEditor from './ConnectedEditor';

const EditorPage = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const { tokens } = useAuth();
  const [document, setDocument] = useState<DocumentSummary | null>(null);
  const [revision, setRevision] = useState<DocumentRevision | null>(null);
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
    if (tokens && documentId) {
      setLoading(true);
      Promise.all([
        getDocument(documentId, tokens.accessToken),
        getLatestRevision(documentId, tokens.accessToken),
      ])
        .then(([docData, revData]) => {
          setDocument(docData);
          setRevision(revData);
        })
        .catch((err) => {
          setError((err as Error).message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [tokens, documentId]);



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
        initialRevision={revision}
      />
    </Box>
  );
};

export default EditorPage;
