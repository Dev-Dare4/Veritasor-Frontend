export type ShortcutCategoryName = 'Global' | 'Navigation' | 'Editing'

export type ShortcutActionId =
  | 'open-shortcuts'
  | 'open-command-palette'
  | 'workspace-jump'
  | 'open-help'
  | 'close-overlay'
  | 'nav-dashboard'
  | 'nav-attestations'
  | 'nav-sources'
  | 'connect-source'

export interface KeyboardShortcutActions {
  onNavigateDashboard?: () => void
  onNavigateAttestations?: () => void
  onNavigateSources?: () => void
  onConnectRevenueSource?: () => void
  onOpenHelpSearch?: () => void
  onToggleShortcuts?: () => void
  onOpenCommandPalette?: () => void
  onWorkspaceJump?: () => void
  onCloseOverlay?: () => void
  [key: string]: (() => void) | undefined
}

export interface ShortcutDefinition {
  id: ShortcutActionId
  category: ShortcutCategoryName
  keys: string[]
  label: string
  actionKey: keyof KeyboardShortcutActions
  type: 'single' | 'sequence' | 'chord'
  /** For sequential chords, e.g. ['g', 'd'] */
  sequence?: string[]
}

export interface Shortcut {
  keys: string[]
  label: string
}

export interface ShortcutCategory {
  name: string
  shortcuts: Shortcut[]
}

export const SHORTCUT_REGISTRY: readonly ShortcutDefinition[] = [
  {
    id: 'open-shortcuts',
    category: 'Global',
    keys: ['Shift', '?'],
    label: 'Open keyboard shortcuts',
    actionKey: 'onToggleShortcuts',
    type: 'single',
  },
  {
    id: 'open-command-palette',
    category: 'Global',
    keys: ['Ctrl', 'K'],
    label: 'Open command palette',
    actionKey: 'onOpenCommandPalette',
    type: 'single',
  },
  {
    id: 'workspace-jump',
    category: 'Global',
    keys: ['Ctrl', 'K', 'W'],
    label: 'Quick-jump workspaces (opens switcher in search mode)',
    actionKey: 'onWorkspaceJump',
    type: 'chord',
  },
  {
    id: 'open-help',
    category: 'Global',
    keys: ['Ctrl', 'H'],
    label: 'Open help search',
    actionKey: 'onOpenHelpSearch',
    type: 'single',
  },
  {
    id: 'close-overlay',
    category: 'Global',
    keys: ['Esc'],
    label: 'Close dialog / overlay',
    actionKey: 'onCloseOverlay',
    type: 'single',
  },
  {
    id: 'nav-dashboard',
    category: 'Navigation',
    keys: ['G', 'D'],
    label: 'Go to Dashboard',
    actionKey: 'onNavigateDashboard',
    type: 'sequence',
    sequence: ['g', 'd'],
  },
  {
    id: 'nav-attestations',
    category: 'Navigation',
    keys: ['G', 'A'],
    label: 'Go to Attestations',
    actionKey: 'onNavigateAttestations',
    type: 'sequence',
    sequence: ['g', 'a'],
  },
  {
    id: 'nav-sources',
    category: 'Navigation',
    keys: ['G', 'S'],
    label: 'Go to Revenue Sources',
    actionKey: 'onNavigateSources',
    type: 'sequence',
    sequence: ['g', 's'],
  },
  {
    id: 'connect-source',
    category: 'Editing',
    keys: ['C', 'S'],
    label: 'Connect revenue source',
    actionKey: 'onConnectRevenueSource',
    type: 'sequence',
    sequence: ['c', 's'],
  },
] as const

export function getShortcutCategories(
  registry: readonly ShortcutDefinition[] = SHORTCUT_REGISTRY,
): ShortcutCategory[] {
  const categoryMap = new Map<ShortcutCategoryName, Shortcut[]>()

  for (const item of registry) {
    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, [])
    }
    categoryMap.get(item.category)!.push({
      keys: item.keys,
      label: item.label,
    })
  }

  return Array.from(categoryMap.entries()).map(([name, shortcuts]) => ({
    name,
    shortcuts,
  }))
}

export const SHORTCUT_CATEGORIES: ShortcutCategory[] = getShortcutCategories()
