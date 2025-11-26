import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import React from 'react';
import { Editor } from '@tiptap/react';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import CropLandscapeIcon from '@mui/icons-material/CropLandscape';
import CropFreeIcon from '@mui/icons-material/CropFree';

type EditorWidthSelectorProps = {
    editor: Editor | null;
    onContentChange?: () => void;
};

const EditorWidthSelector = ({ editor, onContentChange }: EditorWidthSelectorProps) => {
    if (!editor) {
        return null;
    }

    const VALID_WIDTHS = ['780px', '950px', '1200px', '100%'];

    const getClosestWidth = (width: any) => {
        if (!width) return '950px';
        if (VALID_WIDTHS.includes(width)) return width;
        if (width === '100%') return '100%';

        // Parse pixel value
        const pixelValue = parseInt(width, 10);
        if (isNaN(pixelValue)) return '950px';

        // Find closest option among pixel values
        const pixelOptions = [780, 950, 1200];
        const closest = pixelOptions.reduce((prev, curr) => {
            return (Math.abs(curr - pixelValue) < Math.abs(prev - pixelValue) ? curr : prev);
        });

        return `${closest}px`;
    };

    const [width, setWidth] = React.useState(getClosestWidth(editor.state.doc.attrs['x-odocs-layoutWidth']));

    React.useEffect(() => {
        const updateWidth = () => {
            const currentAttr = editor.state.doc.attrs['x-odocs-layoutWidth'];
            setWidth(getClosestWidth(currentAttr));
        };

        editor.on('transaction', updateWidth);
        return () => {
            editor.off('transaction', updateWidth);
        };
    }, [editor]);

    const handleWidthChange = (_event: React.MouseEvent<HTMLElement>, newWidth: string | null) => {
        // Enforce radio button behavior: one option must always be selected.
        // If newWidth is null (user clicked the currently selected button), do nothing.
        if (newWidth !== null) {
            const json = editor.getJSON();
            if (!json.attrs) {
                json.attrs = {};
            }
            json.attrs['x-odocs-layoutWidth'] = newWidth;
            editor.commands.setContent(json, { emitUpdate: true });

            // Force a transaction to ensure 'update' event fires and listeners (like ConnectedEditor) pick it up
            // This is necessary because setContent with emitUpdate might not trigger the exact event flow expected by the autosave logic
            editor.view.dispatch(editor.state.tr.setMeta('addToHistory', false));

            // Explicitly notify parent about content change to trigger save
            if (onContentChange) {
                onContentChange();
            }
        }
    };

    return (
        <ToggleButtonGroup
            value={width}
            exclusive
            onChange={handleWidthChange}
            aria-label="editor width"
            size="small"
            sx={{
                height: 32,
                '& .MuiToggleButton-root': {
                    padding: '4px 8px',
                    border: 'none',
                    borderRadius: '4px !important',
                    margin: '0 2px',
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(0, 0, 0, 0.08)',
                    }
                }
            }}
        >
            <Tooltip title="Narrow (780px)">
                <ToggleButton value="780px" aria-label="780px width">
                    <CropFreeIcon fontSize="small" />
                </ToggleButton>
            </Tooltip>
            <Tooltip title="Standard (950px)">
                <ToggleButton value="950px" aria-label="950px width">
                    <CropLandscapeIcon fontSize="small" />
                </ToggleButton>
            </Tooltip>
            <Tooltip title="Wide (1200px)">
                <ToggleButton value="1200px" aria-label="1200px width">
                    <AspectRatioIcon fontSize="small" />
                </ToggleButton>
            </Tooltip>
            <Tooltip title="Full Width">
                <ToggleButton value="100%" aria-label="full width">
                    <ViewWeekIcon fontSize="small" />
                </ToggleButton>
            </Tooltip>
        </ToggleButtonGroup>
    );
};

export default EditorWidthSelector;
