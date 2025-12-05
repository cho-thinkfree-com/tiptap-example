import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Paper, Typography } from '@mui/material'
import type { ReactNode } from 'react'

export interface CommandItem {
    title: string
    description: string
    aliases?: string[]
    icon: ReactNode
    command: (props: { editor: any; range: any }) => void
}

interface SlashCommandListProps {
    items: CommandItem[]
    command: (item: CommandItem) => void
    editor: any
}

const SlashCommandList = forwardRef((props: SlashCommandListProps, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const scrollContainerRef = React.useRef<HTMLDivElement>(null)

    const selectItem = (index: number) => {
        const item = props.items[index]
        if (item) {
            props.command(item)
        }
    }

    useEffect(() => {
        setSelectedIndex(0)
    }, [props.items])

    useEffect(() => {
        const container = scrollContainerRef.current
        if (container) {
            const selectedElement = container.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' })
            }
        }
    }, [selectedIndex])

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
                return true
            }

            if (event.key === 'ArrowDown') {
                setSelectedIndex((selectedIndex + 1) % props.items.length)
                return true
            }

            if (event.key === 'Enter') {
                selectItem(selectedIndex)
                return true
            }

            return false
        },
    }))

    return (
        <Paper
            ref={scrollContainerRef}
            elevation={3}
            sx={{
                width: 300,
                maxHeight: 330,
                overflow: 'auto',
                borderRadius: 2,
                // Removed border to avoid double-border look with tippy
                bgcolor: 'background.paper',
            }}
        >
            <List dense sx={{ p: 0.5 }}>
                {props.items.length > 0 ? (
                    props.items.map((item, index) => (
                        <ListItemButton
                            key={index}
                            data-index={index}
                            selected={index === selectedIndex}
                            onClick={() => selectItem(index)}
                            sx={{
                                borderRadius: 1,
                                mb: 0.5,
                                '&.Mui-selected': {
                                    bgcolor: 'action.selected',
                                    '&:hover': {
                                        bgcolor: 'action.hover',
                                    },
                                },
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText
                                primary={
                                    <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="body2" fontWeight={500}>
                                            {item.title}
                                        </Typography>
                                        {item.aliases && item.aliases.length > 0 && (
                                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                                {item.aliases[0]}
                                            </Typography>
                                        )}
                                    </Box>
                                }
                            // Removed description as requested
                            />
                        </ListItemButton>
                    ))
                ) : (
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            No results
                        </Typography>
                    </Box>
                )}
            </List>
        </Paper>
    )
})

SlashCommandList.displayName = 'SlashCommandList'

export default SlashCommandList
