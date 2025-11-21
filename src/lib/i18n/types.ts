export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
export type Locale = 'en-US' | 'ko-KR' | 'ja-JP'

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

export type DashboardStrings = {
  title: string
  workspaces: string
  recentDocuments: string
  files: string
  createWorkspace: string
  newFolder: string
  newDocument: string
  noRecentDocumentsNoWorkspace: string
  createWorkspaceDialogTitle: string
  createWorkspaceDialogDescription: string
  createWorkspaceDialogNameLabel: string
  createWorkspaceDialogCreate: string
  createWorkspaceDialogCancel: string
  rename: string
  delete: string
  open: string
  name: string
  workspace: string
  lastModified: string
  modifiedBy: string
  actions: string
  searchDocuments: string
  confirmDeletion: string
  areYouSure: string
  cancel: string
  noWorkspacesFound: string
  noRecentDocuments: string
  folderEmpty: string
  createFirstDocument: string
  manageDocuments: string
}

export type SettingsStrings = {
  global: {
    title: string
    personalInfo: string
    security: string
    legalName: string
    legalNameRequired: string
    email: string
    preferredLanguage: string
    timezone: string
    password: string
    changePassword: string
    saveChanges: string
    updateSuccess: string
    updateError: string
    backToDashboard: string
  }
  workspaceProfile: {
    title: string
    subtitle: string
    workspaceSpecific: string
    workspaceSpecificDesc: string
    emailPasswordHint: string
    globalAccountSettings: string
    profileInfo: string
    displayName: string
    displayNameHelper: string
    displayNameRequired: string
    language: string
    changeAvatar: string
    saveProfile: string
    updateSuccess: string
    updateError: string
    loadError: string
  }
  languageOptions: Record<Locale, string>
}

export type AppStrings = {
  editor: EditorStrings
  auth: AuthStrings
  workspace: WorkspaceStrings
  dashboard: DashboardStrings
  settings: SettingsStrings
}

export type AuthStrings = {
  landing: {
    heroTitle: string
    heroDescription: string
    featureIntro: string
    features: {
      title: string
      desc: string
    }[]
    loginLabel: string
    signupLabel: string
    loginTitle: string
    signupTitle: string
    emailLabel: string
    passwordLabel: string
    passwordHint: string
    legalNameLabel: string
    loginButton: string
    signupButton: string
    errorFallback: string
  }
  login: {
    title: string
    subtitle: string
    emailLabel: string
    passwordLabel: string
    submitButton: string
    loadingButton: string
    noAccount: string
    signupLink: string
  }
  signup: {
    title: string
    subtitle: string
    emailLabel: string
    passwordLabel: string
    legalNameLabel: string
    legalNameRequired: string
    submitButton: string
    loadingButton: string
    hasAccount: string
    loginLink: string
  }
  sessionExpired: string
}

export type WorkspaceStrings = {
  heroTitle: string
  heroSubtitle: string
  statsWorkspaces: string
  statsDocuments: string
  statsMembers: string
  galleryTitle: string
  galleryHint: string
  creationTitle: string
  creationSubtitle: string
  creationButton: string
  selectedWorkspaceTitle: string
  selectedWorkspaceHint: string
  viewAllWorkspaces: string
  workspaceListTitle: string
  workspaceListHint: string
  workspaceSettingsLabel: string
  selectorTitle: string
  selectorHint: string
  noWorkspaces: string
  workspaceOverview: string
  descriptionLabel: string
  visibilityLabel: string
  ownerLabel: string
  documentsTitle: string
  documentSearchPlaceholder: string
  searchButton: string
  noDocuments: string
  foldersTitle: string
  membersTitle: string
  membersRestricted: string
  updateTitle: string
  updateButton: string
  updateSuccess: string
  closeTitle: string
  closeButton: string
  closeWarning: string
  openEditor: string
  switchWorkspace: string
  createWorkspaceTitle: string
  createWorkspacePlaceholder: string
  createWorkspaceButton: string
  onboardingTitle: string
  onboardingDescription: string
  onboardingHint: string
  onboardingButton: string
  logoutLabel: string
  recentUpdatesTitle: string
  membersHint: string
  removeMemberLabel: string
  inviteLabel: string
  invitePlaceholder: string
  inviteButton: string
  profileTitle: string
  profileSubtitle: string
  profileEditLabel: string
  selectWorkspaceMessage: string
  backToFiles: string
  settingsAccessRestricted: string
  settingsAccessRestrictedDetail: string
  filesTitle: string
  nameColumn: string
  lastModifiedColumn: string
  modifiedByColumn: string
  actionsColumn: string
  newFolder: string
  newDocument: string
  emptyFolder: string
  createFirstDocument: string
  confirmDeletionTitle: string
  confirmDeletionBody: string
  cancel: string
  delete: string
  rename: string
}
