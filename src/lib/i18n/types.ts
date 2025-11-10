export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
export type Locale = 'en-US' | 'ko-KR'

export type HeadingStrings = {
  titles: Record<HeadingLevel, string>
  descriptions: Record<HeadingLevel, string>
  shortcuts: Partial<Record<HeadingLevel, string[]>>
}

export type ToolbarStrings = {
  moreFormatting: string
  moreFormattingOptions: string
  additionalTools: string
  headingLabel: string
  textAlignLabel: string
  listControlsLabel: string
  scriptControlsLabel: string
  scriptNormalLabel: string
  indentControlsLabel: string
  showTableOfContents: string
  hideTableOfContents: string
  toggleTableOfContents: string
  showToolbar: string
  hideToolbar: string
  calloutLabel: string
  calloutInfo: string
  calloutWarning: string
  calloutError: string
  calloutSuccess: string
  removeCallout: string
}

export type ShortcutDefinition = {
  id: string
  label: string
  description: string
  keys: string[]
}

export type ShortcutsStrings = {
  title: string
  items: ShortcutDefinition[]
}

export type SlashHelpStrings = {
  title: string
  description: string
  commandsTitle: string
  shortcutsTitle: string
  searchPlaceholder: string
  noResults: string
  noCommands: string
  noShortcuts: string
  close: string
}

export type EditorStrings = {
  title: {
    placeholder: string
    ariaLabel: string
  }
  content: {
    placeholder: string
  }
  toolbar: ToolbarStrings
  slashCommands: {
    heading: HeadingStrings
  }
  toc: {
    emptyPlaceholder: string
  }
  slashHelp: SlashHelpStrings
  shortcuts: ShortcutsStrings
}

export type AppStrings = {
  editor: EditorStrings
}
