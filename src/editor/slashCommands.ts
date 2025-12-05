import type { AppStrings, HeadingLevel } from '../lib/i18n'

export type HeadingSlashCommandDefinition = {
  id: string
  alias: string
  execute: 'heading'
  level: HeadingLevel
}

export type HeadingSlashCommand = HeadingSlashCommandDefinition & {
  title: string
  description: string
  aliases: string[]
}

const headingCommandDefinitions: HeadingSlashCommandDefinition[] = [
  {
    id: 'heading-1',
    alias: 'h1',
    execute: 'heading',
    level: 1,
  },
  {
    id: 'heading-2',
    alias: 'h2',
    execute: 'heading',
    level: 2,
  },
  {
    id: 'heading-3',
    alias: 'h3',
    execute: 'heading',
    level: 3,
  },
  {
    id: 'heading-4',
    alias: 'h4',
    execute: 'heading',
    level: 4,
  },
  {
    id: 'heading-5',
    alias: 'h5',
    execute: 'heading',
    level: 5,
  },
  {
    id: 'heading-6',
    alias: 'h6',
    execute: 'heading',
    level: 6,
  },
]

export const headingSlashCommandDefinitions = headingCommandDefinitions

export const createHeadingSlashCommands = (strings: AppStrings): HeadingSlashCommand[] => {
  const { titles, descriptions } = strings.editor.slashCommands.heading

  return headingCommandDefinitions.map((definition) => ({
    ...definition,
    title: titles[definition.level],
    description: descriptions[definition.level],
    aliases: [definition.alias],
  }))
}

