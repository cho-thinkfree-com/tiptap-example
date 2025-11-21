import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { useState, useEffect, useRef } from 'react';

interface CreateFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

const CreateFolderDialog = ({ open, onClose, onCreate }: CreateFolderDialogProps) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = () => {
    inputRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (open) {
      focusInput();
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Folder name is required.');
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
      <DialogTitle>Create a new folder</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Give your new folder a name.
        </DialogContentText>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <TextField
          inputRef={inputRef}
          autoFocus
          margin="dense"
          id="name"
          label="Folder Name"
          type="text"
          fullWidth
          variant="standard"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button type="submit" onClick={handleCreate} disabled={loading} variant="contained" color="primary">
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateFolderDialog;
