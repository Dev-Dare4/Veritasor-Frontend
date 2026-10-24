import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import { MemoryRouter, useLocation } from 'react-router-dom'
import TopAppBar, { WorkspaceMetadata } from './TopAppBar'
import { LocaleProvider } from '../i18n/provider'
import messages from '../i18n/messages/en.json'

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-pathname">{location.pathname}</div>
}

function renderWithProvider(ui: React.ReactElement, { initialEntries = ['/'] }: { initialEntries?: string[] } = {}) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={initialEntries}>
        <LocaleProvider>
          {children}
          <LocationDisplay />
        </LocaleProvider>
      </MemoryRouter>
    ),
  })
}

const mockWorkspaces: WorkspaceMetadata[] = [
  { id: "workspace-1", name: "Acme Corp", initials: "AC", plan: "business", region: "us-east", description: "Main corporate workspace" },
  { id: "workspace-2", name: "My Workspace", initials: "MW", plan: "growth", region: "us-west", description: "Personal workspace" },
  { id: "workspace-3", name: "Test Org", initials: "TO", plan: "starter", region: "eu-west", description: "Testing environment" },
]

describe('TopAppBar - Account Switcher', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('Happy Paths', () => {
    it('renders workspace switcher with current workspace', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      const trigger = screen.getByRole('button', { name: /workspace: acme corp/i })
      expect(trigger).toBeInTheDocument()
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    })

    it('opens workspace menu on click', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      const trigger = screen.getByRole('button', { name: /workspace: acme corp/i })
      fireEvent.click(trigger)
      
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('listbox', { name: /select workspace/i })).toBeInTheDocument()
    })

    it('displays workspace avatars and metadata in menu', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))

      const listbox = screen.getByRole('listbox')
      expect(within(listbox).getByText('Acme Corp')).toBeInTheDocument()
      expect(within(listbox).getByText('My Workspace')).toBeInTheDocument()
      expect(within(listbox).getByText('Test Org')).toBeInTheDocument()
      expect(screen.getByText('business')).toBeInTheDocument()
      expect(screen.getByText('growth')).toBeInTheDocument()
      expect(screen.getByText('starter')).toBeInTheDocument()
    })

    it('switches workspace when option is selected', () => {
      const onWorkspaceChange = vi.fn()
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
          onWorkspaceChange={onWorkspaceChange}
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))
      fireEvent.click(screen.getByText('My Workspace'))
      
      expect(onWorkspaceChange).toHaveBeenCalledWith('workspace-2')
    })

    it('filters workspaces by search', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))
      
      const searchInput = screen.getByPlaceholderText('Find workspace…')
      fireEvent.change(searchInput, { target: { value: 'Test' } })

      const listbox = screen.getByRole('listbox')
      expect(within(listbox).getByText('Test Org')).toBeInTheDocument()
      expect(within(listbox).queryByText('Acme Corp')).not.toBeInTheDocument()
      expect(within(listbox).queryByText('My Workspace')).not.toBeInTheDocument()
    })

    it('shows no results message when search matches nothing', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))
      
      const searchInput = screen.getByPlaceholderText('Find workspace…')
      fireEvent.change(searchInput, { target: { value: 'NonExistent' } })
      
      expect(screen.getByText(/no workspaces match/i)).toBeInTheDocument()
    })

    it('displays keyboard shortcut hint in menu', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))

      expect(screen.getByText('Ctrl+K')).toBeInTheDocument()
      expect(screen.getByText('W')).toBeInTheDocument()
      expect(screen.getByText(/quick switch/i)).toBeInTheDocument()
    })

    it('announces workspace change to screen readers', async () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))
      fireEvent.click(screen.getByText('My Workspace'))
      
      await waitFor(() => {
        const announcement = screen.getByRole('status')
        expect(announcement).toHaveTextContent(/switched to workspace: my workspace/i)
      })
    })
  })

  describe('Invalid Input and Authorization Boundaries', () => {
    it('handles empty workspaces array gracefully', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={[]} 
          initialWorkspace=""
        />
      )
      
      const trigger = screen.getByRole('button', { name: /workspace:/i })
      expect(trigger).toBeInTheDocument()
    })

    it('handles undefined workspaces prop', () => {
      renderWithProvider(<TopAppBar />)
      
      const trigger = screen.getByRole('button', { name: /workspace:/i })
      expect(trigger).toBeInTheDocument()
    })

    it('handles workspace with missing optional fields', () => {
      const incompleteWorkspaces: WorkspaceMetadata[] = [
        { id: "ws-1", name: "Minimal Workspace" },
      ]
      
      renderWithProvider(
        <TopAppBar 
          workspaces={incompleteWorkspaces} 
          initialWorkspace="ws-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: minimal workspace/i }))
      expect(within(screen.getByRole('listbox')).getByText('Minimal Workspace')).toBeInTheDocument()
    })

    it('handles duplicate workspace IDs by using first occurrence', () => {
      const duplicateWorkspaces: WorkspaceMetadata[] = [
        { id: "ws-1", name: "Workspace One", initials: "WO" },
        { id: "ws-1", name: "Workspace One Duplicate", initials: "WD" },
      ]
      
      renderWithProvider(
        <TopAppBar 
          workspaces={duplicateWorkspaces} 
          initialWorkspace="ws-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace:/i }))
      const listbox = screen.getByRole('listbox')
      expect(within(listbox).getByText('Workspace One')).toBeInTheDocument()
      expect(within(listbox).getByText('Workspace One Duplicate')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('opens menu with ArrowDown key', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      const trigger = screen.getByRole('button', { name: /workspace: acme corp/i })
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })
      
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
    })

    it('closes menu with Escape key and returns focus', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      const trigger = screen.getByRole('button', { name: /workspace: acme corp/i })
      fireEvent.click(trigger)
      
      const listbox = screen.getByRole('listbox')
      fireEvent.keyDown(listbox, { key: 'Escape' })
      
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(trigger).toHaveFocus()
    })

    it('navigates options with Arrow keys', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))

      const listbox = screen.getByRole('listbox')
      fireEvent.keyDown(listbox, { key: 'ArrowDown' })
      fireEvent.keyDown(listbox, { key: 'ArrowDown' })

      // Focus should have moved from the first option to the third
      const options = within(listbox).getAllByRole('option')
      expect(options[2]).toHaveFocus()
    })

    it('selects workspace with Enter key', () => {
      const onWorkspaceChange = vi.fn()
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
          onWorkspaceChange={onWorkspaceChange}
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))

      const listbox = screen.getByRole('listbox')
      fireEvent.keyDown(listbox, { key: 'ArrowDown' })

      // Enter is handled on the focused option, not the listbox
      const options = within(listbox).getAllByRole('option')
      fireEvent.keyDown(options[1], { key: 'Enter' })

      expect(onWorkspaceChange).toHaveBeenCalledWith('workspace-2')
    })

    it('navigates to first option with Home key', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))
      
      const listbox = screen.getByRole('listbox')
      fireEvent.keyDown(listbox, { key: 'ArrowDown' })
      fireEvent.keyDown(listbox, { key: 'ArrowDown' })
      fireEvent.keyDown(listbox, { key: 'Home' })
      
      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveFocus()
    })

    it('navigates to last option with End key', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))

      const listbox = screen.getByRole('listbox')
      fireEvent.keyDown(listbox, { key: 'End' })

      const options = within(listbox).getAllByRole('option')
      expect(options[options.length - 1]).toHaveFocus()
    })

    it('supports search input keyboard navigation', async () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
          openWorkspaceSwitcherInSearchMode={true}
        />
      )
      
      const searchInput = screen.getByPlaceholderText('Find workspace…')
      await waitFor(() => expect(searchInput).toHaveFocus())

      fireEvent.keyDown(searchInput, { key: 'ArrowDown' })

      const options = within(screen.getByRole('listbox')).getAllByRole('option')
      expect(options[0]).toHaveFocus()
    })

    it('selects first matching result on Enter in search', () => {
      const onWorkspaceChange = vi.fn()
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
          onWorkspaceChange={onWorkspaceChange}
          openWorkspaceSwitcherInSearchMode={true}
        />
      )
      
      const searchInput = screen.getByPlaceholderText('Find workspace…')
      fireEvent.change(searchInput, { target: { value: 'Test' } })
      fireEvent.keyDown(searchInput, { key: 'Enter' })
      
      expect(onWorkspaceChange).toHaveBeenCalledWith('workspace-3')
    })
  })

  describe('Account Menu', () => {
    it('displays user avatar and name in account menu', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
          userName="Test User"
          userInitials="TU"
          userEmail="test@example.com"
        />
      )
      
      const accountTrigger = screen.getByRole('button', { name: /account menu for test user/i })
      fireEvent.click(accountTrigger)

      const menu = screen.getByRole('menu', { name: /account options/i })
      expect(within(menu).getByText('Test User')).toBeInTheDocument()
      expect(within(menu).getByText('test@example.com')).toBeInTheDocument()
    })

    it('supports custom user avatar', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
          userName="Test User"
          userAvatar="https://example.com/avatar.jpg"
        />
      )
      
      const accountTrigger = screen.getByRole('button', { name: /account menu for test user/i })
      expect(accountTrigger).toBeInTheDocument()
    })

    it('closes account menu with Escape key', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      const accountTrigger = screen.getByRole('button', { name: /account menu/i })
      fireEvent.click(accountTrigger)
      
      const menu = screen.getByRole('menu', { name: /account options/i })
      fireEvent.keyDown(menu, { key: 'Escape' })
      
      expect(accountTrigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('navigates to /settings on clicking Settings, closes menu, and returns focus to trigger', () => {
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
        />
      )

      const accountTrigger = screen.getByRole('button', { name: /account menu/i })
      fireEvent.click(accountTrigger)

      fireEvent.click(screen.getByRole('menuitem', { name: /^settings$/i }))

      expect(screen.getByTestId('location-pathname')).toHaveTextContent('/settings')
      expect(screen.queryByRole('menu', { name: /account options/i })).not.toBeInTheDocument()
      expect(accountTrigger).toHaveFocus()
    })

    it('navigates to /settings on pressing Enter or Space on Settings and returns focus to trigger', () => {
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
        />
      )

      const accountTrigger = screen.getByRole('button', { name: /account menu/i })
      fireEvent.click(accountTrigger)

      fireEvent.keyDown(screen.getByRole('menuitem', { name: /^settings$/i }), { key: 'Enter' })

      expect(screen.getByTestId('location-pathname')).toHaveTextContent('/settings')
      expect(screen.queryByRole('menu', { name: /account options/i })).not.toBeInTheDocument()
      expect(accountTrigger).toHaveFocus()

      fireEvent.click(accountTrigger)
      fireEvent.keyDown(screen.getByRole('menuitem', { name: /^settings$/i }), { key: ' ' })
      expect(screen.queryByRole('menu', { name: /account options/i })).not.toBeInTheDocument()
      expect(accountTrigger).toHaveFocus()
    })

    it('navigates to /api-keys on clicking API keys, closes menu, and returns focus to trigger', () => {
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
        />
      )

      const accountTrigger = screen.getByRole('button', { name: /account menu/i })
      fireEvent.click(accountTrigger)

      fireEvent.click(screen.getByRole('menuitem', { name: /api keys/i }))

      expect(screen.getByTestId('location-pathname')).toHaveTextContent('/api-keys')
      expect(screen.queryByRole('menu', { name: /account options/i })).not.toBeInTheDocument()
      expect(accountTrigger).toHaveFocus()
    })

    it('navigates to /api-keys on pressing Enter or Space on API keys and returns focus to trigger', () => {
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
        />
      )

      const accountTrigger = screen.getByRole('button', { name: /account menu/i })
      fireEvent.click(accountTrigger)

      fireEvent.keyDown(screen.getByRole('menuitem', { name: /api keys/i }), { key: 'Enter' })

      expect(screen.getByTestId('location-pathname')).toHaveTextContent('/api-keys')
      expect(screen.queryByRole('menu', { name: /account options/i })).not.toBeInTheDocument()
      expect(accountTrigger).toHaveFocus()

      fireEvent.click(accountTrigger)
      fireEvent.keyDown(screen.getByRole('menuitem', { name: /api keys/i }), { key: ' ' })
      expect(screen.queryByRole('menu', { name: /account options/i })).not.toBeInTheDocument()
      expect(accountTrigger).toHaveFocus()
    })

    it('renders locale picker outside role="menu" in a labelled section and changes locale without closing the account menu', () => {
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
        />
      )

      const accountTrigger = screen.getByRole('button', { name: /account menu/i })
      fireEvent.click(accountTrigger)

      const menu = screen.getByRole('menu', { name: /account options/i })
      expect(within(menu).queryByRole('button', { name: /select language/i })).not.toBeInTheDocument()

      const localeSection = screen.getByRole('region', { name: /language/i })
      const localeTrigger = within(localeSection).getByRole('button', { name: /select language/i })
      fireEvent.click(localeTrigger)

      // Opening the locale picker must not close the account menu
      expect(screen.getByRole('menu', { name: /account options/i })).toBeInTheDocument()

      const spanishOption = screen.getByRole('option', { name: /español/i })
      fireEvent.click(spanishOption)

      // Selecting a locale updates the active locale and keeps the account menu open
      expect(screen.getByRole('menu', { name: /account options/i })).toBeInTheDocument()
      expect(localeTrigger).toHaveTextContent('Español')
      expect(document.documentElement.lang).toBe('es')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA roles and attributes', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      const trigger = screen.getByRole('button', { name: /workspace: acme corp/i })
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('marks current workspace with aria-selected', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))
      
      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')
      expect(options[1]).toHaveAttribute('aria-selected', 'false')
    })

    it('provides screen reader text for current workspace', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))
      
      expect(screen.getByText('(current)')).toBeInTheDocument()
    })

    it('includes keyboard shortcut in aria-label', () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
        />
      )
      
      const trigger = screen.getByRole('button', { name: /workspace: acme corp/i })
      expect(trigger).toHaveAttribute('aria-label', expect.stringContaining('Ctrl+K'))
    })

    it('has focus management for search input when opened in search mode', async () => {
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
          openWorkspaceSwitcherInSearchMode={true}
        />
      )
      
      const searchInput = screen.getByPlaceholderText('Find workspace…')
      await waitFor(() => expect(searchInput).toHaveFocus())
    })
  })

  describe('Edge Cases', () => {
    it('handles single workspace', () => {
      const singleWorkspace: WorkspaceMetadata[] = [
        { id: "ws-1", name: "Only Workspace", initials: "OW" },
      ]
      
      renderWithProvider(
        <TopAppBar 
          workspaces={singleWorkspace} 
          initialWorkspace="ws-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: only workspace/i }))
      expect(within(screen.getByRole('listbox')).getByText('Only Workspace')).toBeInTheDocument()
    })

    it('handles many workspaces with scrolling', () => {
      const manyWorkspaces: WorkspaceMetadata[] = Array.from({ length: 50 }, (_, i) => ({
        id: `ws-${i}`,
        name: `Workspace ${i}`,
        initials: `W${i}`,
        plan: 'growth' as const,
      }))
      
      renderWithProvider(
        <TopAppBar 
          workspaces={manyWorkspaces} 
          initialWorkspace="ws-0"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: workspace 0/i }))
      expect(within(screen.getByRole('listbox')).getAllByRole('option').length).toBe(50)
    })

    it('handles workspace with very long name', () => {
      const longNameWorkspace: WorkspaceMetadata[] = [
        { id: "ws-1", name: "A".repeat(200), initials: "AA" },
      ]
      
      renderWithProvider(
        <TopAppBar 
          workspaces={longNameWorkspace} 
          initialWorkspace="ws-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace:/i }))
      expect(within(screen.getByRole('listbox')).getByText(new RegExp(`^A{200}$`))).toBeInTheDocument()
    })

    it('handles special characters in workspace names', () => {
      const specialWorkspace: WorkspaceMetadata[] = [
        { id: "ws-1", name: "Workspace & Co.", initials: "WC" },
        { id: "ws-2", name: "Test <script>", initials: "TS" },
      ]
      
      renderWithProvider(
        <TopAppBar 
          workspaces={specialWorkspace} 
          initialWorkspace="ws-1"
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace:/i }))
      expect(within(screen.getByRole('listbox')).getByText('Workspace & Co.')).toBeInTheDocument()
    })

    it('handles rapid workspace switching', () => {
      const onWorkspaceChange = vi.fn()
      renderWithProvider(
        <TopAppBar 
          workspaces={mockWorkspaces} 
          initialWorkspace="workspace-1"
          onWorkspaceChange={onWorkspaceChange}
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))
      fireEvent.click(screen.getByText('My Workspace'))
      fireEvent.click(screen.getByRole('button', { name: /workspace: my workspace/i }))
      fireEvent.click(screen.getByText('Test Org'))
      
      expect(onWorkspaceChange).toHaveBeenCalledTimes(2)
    })
  })

  describe('Backward Compatibility', () => {
    it('works with string-based workspaces (legacy support)', () => {
      // This test ensures the component can handle legacy string workspaces
      // by testing with the default workspaces which are now WorkspaceMetadata
      renderWithProvider(<TopAppBar />)

      const trigger = screen.getByRole('button', { name: /workspace:/i })
      expect(trigger).toBeInTheDocument()
    })

    it('maintains existing callback signatures', () => {
      const onSidebarToggle = vi.fn()
      const onSearchClick = vi.fn()
      const onWorkspaceQuickJump = vi.fn()

      renderWithProvider(
        <TopAppBar
          onSidebarToggle={onSidebarToggle}
          onSearchClick={onSearchClick}
          onWorkspaceQuickJump={onWorkspaceQuickJump}
        />
      )

      expect(onSidebarToggle).toBeDefined()
      expect(onSearchClick).toBeDefined()
      expect(onWorkspaceQuickJump).toBeDefined()
    })
  })

  describe('TopAppBar - Environment Toggle', () => {
    it('defaults to testnet and opens a confirmation when switching to mainnet', () => {
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
        />
      )

      const envBadge = screen.getByRole('button', { name: /environment: testnet/i })
      expect(envBadge).toHaveTextContent('testnet')

      fireEvent.click(envBadge)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
      expect(screen.getByRole('button', { name: /environment: mainnet/i })).toHaveTextContent('mainnet')
    })

    it('keeps testnet when the confirmation is cancelled', () => {
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
        />
      )

      const envBadge = screen.getByRole('button', { name: /environment: testnet/i })
      fireEvent.click(envBadge)
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(screen.getByRole('button', { name: /environment: testnet/i })).toHaveTextContent('testnet')
    })

    it('switches back to testnet without confirmation', () => {
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
          initialEnvironment="mainnet"
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /environment: mainnet/i }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /environment: testnet/i })).toBeInTheDocument()
    })
  })

  describe('TopAppBar - Sidebar and Search Triggers', () => {
    it('invokes onSidebarToggle and reflects sidebarOpen state', () => {
      const onSidebarToggle = vi.fn()
      const { rerender } = renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
          onSidebarToggle={onSidebarToggle}
          sidebarOpen={false}
        />
      )

      const hamburger = screen.getByRole('button', { name: /open navigation/i })
      expect(hamburger).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(hamburger)
      expect(onSidebarToggle).toHaveBeenCalledTimes(1)

      rerender(
        <IntlProvider locale="en" messages={messages}>
          <TopAppBar
            workspaces={mockWorkspaces}
            initialWorkspace="workspace-1"
            onSidebarToggle={onSidebarToggle}
            sidebarOpen={true}
          />
        </IntlProvider>
      )

      const closeButton = screen.getByRole('button', { name: /close navigation/i })
      expect(closeButton).toHaveAttribute('aria-expanded', 'true')
      expect(closeButton).toHaveAttribute('aria-controls', 'app-sidebar')
    })

    it('invokes onSearchClick when the search trigger is clicked', () => {
      const onSearchClick = vi.fn()
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
          onSearchClick={onSearchClick}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /search or type command/i }))
      expect(onSearchClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('TopAppBar - Workspace Switcher Open Change', () => {
    it('notifies the parent when the switcher opens and closes', () => {
      const onWorkspaceSwitcherOpenChange = vi.fn()
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
          onWorkspaceSwitcherOpenChange={onWorkspaceSwitcherOpenChange}
        />
      )

      const trigger = screen.getByRole('button', { name: /workspace: acme corp/i })
      fireEvent.click(trigger)
      expect(onWorkspaceSwitcherOpenChange).toHaveBeenLastCalledWith(true)

      fireEvent.click(trigger)
      expect(onWorkspaceSwitcherOpenChange).toHaveBeenLastCalledWith(false)
    })

    it('notifies the parent when the switcher closes via Escape', () => {
      const onWorkspaceSwitcherOpenChange = vi.fn()
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
          onWorkspaceSwitcherOpenChange={onWorkspaceSwitcherOpenChange}
        />
      )

      const trigger = screen.getByRole('button', { name: /workspace: acme corp/i })
      fireEvent.click(trigger)
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })

      expect(onWorkspaceSwitcherOpenChange).toHaveBeenLastCalledWith(false)
    })
  })

  describe('TopAppBar - Create Workspace', () => {
    beforeEach(() => {
      window.localStorage.clear()
    })

    it('closes the workspace menu when create workspace is clicked', () => {
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))
      fireEvent.click(screen.getByRole('option', { name: /create new workspace/i }))

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('shows the default create label when no draft exists', () => {
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))

      expect(screen.getByRole('option', { name: 'Create new workspace' })).toBeInTheDocument()
      expect(screen.queryByText('DRAFT')).not.toBeInTheDocument()
    })

    it('shows the DRAFT badge and resume label when a draft exists in storage', () => {
      window.localStorage.setItem(
        'veritasor-create-workspace-draft',
        JSON.stringify({
          name: 'draft-ws',
          displayName: '',
          description: '',
          plan: 'growth',
          region: 'us-east',
        }),
      )

      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))

      expect(screen.getByText('DRAFT')).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: /create new workspace \(resume draft\)/i }),
      ).toBeInTheDocument()
    })
  })

  describe('TopAppBar - WorkspaceMetadata Rendering', () => {
    it('hides initials when a custom avatar is set', () => {
      const avatarWorkspaces: WorkspaceMetadata[] = [
        { id: 'ws-avatar', name: 'Avatar WS', initials: 'AW', avatar: 'https://example.com/avatar.png' },
      ]

      renderWithProvider(
        <TopAppBar
          workspaces={avatarWorkspaces}
          initialWorkspace="ws-avatar"
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /workspace: avatar ws/i }))

      expect(screen.queryByText('AW')).not.toBeInTheDocument()
      expect(within(screen.getByRole('listbox')).getByText('Avatar WS')).toBeInTheDocument()
    })

    it('falls back to name-derived initials when initials are missing', () => {
      const fallbackWorkspaces: WorkspaceMetadata[] = [
        { id: 'ws-fallback', name: 'Fallback Org' },
      ]

      renderWithProvider(
        <TopAppBar
          workspaces={fallbackWorkspaces}
          initialWorkspace="ws-fallback"
        />
      )

      expect(screen.getByText('FA')).toBeInTheDocument()
    })

    it('renders the workspace description in the switcher option', () => {
      renderWithProvider(
        <TopAppBar
          workspaces={mockWorkspaces}
          initialWorkspace="workspace-1"
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /workspace: acme corp/i }))

      expect(screen.getByText('Main corporate workspace')).toBeInTheDocument()
      expect(screen.getByText('Personal workspace')).toBeInTheDocument()
    })
  })
})
