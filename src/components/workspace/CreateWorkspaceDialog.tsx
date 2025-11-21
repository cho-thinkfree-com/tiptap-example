import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../lib/i18n';

interface CreateWorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

const CreateWorkspaceDialog = ({ open, onClose, onCreate }: CreateWorkspaceDialogProps) => {
  const { strings } = useI18n();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = () => {
    inputRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (open) focusInput();
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Workspace name is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onCreate(name);
      onClose();
      setName('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
    setName('');
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      TransitionProps={{ onEntered: focusInput }}
      PaperProps={{ component: 'form', onSubmit: (e) => { e.preventDefault(); void handleCreate(); } }}
    >
      <DialogTitle>{strings.dashboard.createWorkspaceDialogTitle}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {strings.dashboard.createWorkspaceDialogDescription}
        </DialogContentText>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <TextField
          inputRef={inputRef}
          autoFocus
          margin="dense"
          id="name"
          label={strings.dashboard.createWorkspaceDialogNameLabel}
          type="text"
          fullWidth
          variant="standard"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>{strings.dashboard.createWorkspaceDialogCancel}</Button>
        <Button type="submit" onClick={handleCreate} disabled={loading} variant="contained" color="primary">
          {loading ? strings.dashboard.createWorkspaceDialogCreate : strings.dashboard.createWorkspaceDialogCreate}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateWorkspaceDialog;
