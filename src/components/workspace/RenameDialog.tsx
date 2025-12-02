import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { useState, useEffect, useRef } from 'react';

interface RenameDialogProps {
  open: boolean;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
  currentName: string;
  itemType: 'file' | 'folder';
}

const RenameDialog = ({ open, onClose, onRename, currentName, itemType }: RenameDialogProps) => {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
      // Focus input after dialog animation
      if (inputRef.current) {
        setTimeout(() => {
          inputRef.current?.focus();
          // Move cursor to end of text
          const length = inputRef.current?.value.length || 0;
          inputRef.current?.setSelectionRange(length, length);
        }, 100);
      }
    }
  }, [open, currentName]);

  const handleRename = async () => {
    if (!name.trim()) {
      setError(`New ${itemType} name is required.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onRename(name);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Rename {itemType}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Enter a new name for the {itemType}.
        </DialogContentText>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <TextField
          inputRef={inputRef}
          autoFocus
          margin="dense"
          id="name"
          label="New Name"
          type="text"
          fullWidth
          variant="standard"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !loading) {
              e.preventDefault();
              handleRename();
            }
          }}
          disabled={loading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button
          onClick={handleRename}
          disabled={loading}
          variant="contained"
          color="primary"
        >
          {loading ? 'Renaming...' : 'Rename'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RenameDialog;
