import { MemoryRouter } from 'react-router-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TopAppBar, { WorkspaceMetadata } from '../components/TopAppBar'
import Layout from '../components/Layout'
import { CookieConsentProvider } from '../components/CookieConsentContext'
import { LocaleProvider } from '../i18n/provider'

const mockWorkspaces: WorkspaceMetadata[] = [
  { id: "acme-corp", name: "Acme Corp", initials: "AC" },
  { id: "my-workspace", name: "My Workspace", initials: "MW" },
  { id: "test-org", name: "Test Org", initials: "TO" },
]

function renderWithRouter(ui: React.ReactElement, { initialEntries = ['/'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <CookieConsentProvider>
        <LocaleProvider>{ui}</LocaleProvider>
      </CookieConsentProvider>
    </MemoryRouter>,
  )
}

// ─── TopAppBar ────────────────────────────────────────────────────────────────

describe('TopAppBar', () => {
  describe('rendering', () => {
    it('renders as a banner landmark', () => {
      renderWithRouter(<TopAppBar />)
      expect(screen.getByRole('banner')).toBeInTheDocument()
    })

    it('renders brand name', () => {
      const { container } = renderWithRouter(<TopAppBar />)
      expect(container.querySelector('.app-bar-brand')).toHaveTextContent('Veritasor')
    })

    it('renders workspace trigger with initial workspace', () => {
      renderWithRouter(<TopAppBar initialWorkspace="acme-corp" workspaces={mockWorkspaces} />)
      expect(
        screen.getByRole('button', { name: /workspace: acme corp/i }),
      ).toBeInTheDocument()
    })

    it('renders environment badge with initial environment', () => {
      renderWithRouter(<TopAppBar initialEnvironment="testnet" />)
      expect(
        screen.getByRole('button', { name: /environment: testnet/i }),
      ).toBeInTheDocument()
    })

    it('renders account trigger with user name', () => {
      renderWithRouter(<TopAppBar userName="Joel Agboola" />)
      expect(
        screen.getByRole('button', { name: /account menu for joel agboola/i }),
      ).toBeInTheDocument()
    })

    it('renders hamburger button with open-navigation label by default', () => {
      renderWithRouter(<TopAppBar sidebarOpen={false} />)
      expect(screen.getByRole('button', { name: /open navigation/i })).toBeInTheDocument()
    })

    it('renders user initials in avatar', () => {
      renderWithRouter(<TopAppBar userInitials="JA" />)
      expect(screen.getByText('JA')).toBeInTheDocument()
    })
  })

  // ─── Workspace switcher ────────────────────────────────────────────────────

  describe('workspace switcher — closed state', () => {
    it('workspace listbox is not present initially', () => {
      renderWithRouter(<TopAppBar />)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('workspace trigger has aria-haspopup="listbox"', () => {
      renderWithRouter(<TopAppBar />)
      expect(screen.getByRole('button', { name: /workspace/i })).toHaveAttribute(
        'aria-haspopup',
        'listbox',
      )
    })

    it('workspace trigger has aria-expanded="false" when closed', () => {
      renderWithRouter(<TopAppBar />)
      expect(screen.getByRole('button', { name: /workspace/i })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
    })
  })

  describe('workspace switcher — open state', () => {
    it('opens listbox on trigger click', () => {
      renderWithRouter(<TopAppBar workspaces={mockWorkspaces.slice(0, 2)} />)
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('closes listbox on second trigger click', () => {
      renderWithRouter(<TopAppBar workspaces={[mockWorkspaces[0]]} />)
      const btn = screen.getByRole('button', { name: /workspace/i })
      fireEvent.click(btn)
      fireEvent.click(btn)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('trigger has aria-expanded="true" when open', () => {
      renderWithRouter(<TopAppBar />)
      const btn = screen.getByRole('button', { name: /workspace/i })
      fireEvent.click(btn)
      expect(btn).toHaveAttribute('aria-expanded', 'true')
    })

    it('renders all workspace options', () => {
      renderWithRouter(
        <TopAppBar workspaces={mockWorkspaces} />,
      )
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      expect(screen.getByRole('option', { name: /acme corp/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /my workspace/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /test org/i })).toBeInTheDocument()
    })

    it('marks the current workspace as aria-selected="true"', () => {
      renderWithRouter(
        <TopAppBar
          workspaces={mockWorkspaces.slice(0, 2)}
          initialWorkspace="my-workspace"
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      expect(screen.getByRole('option', { name: /my workspace/i })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(screen.getByRole('option', { name: /acme corp/i })).toHaveAttribute(
        'aria-selected',
        'false',
      )
    })

    it('closes outside click — mousedown on document body', () => {
      const { baseElement } = renderWithRouter(
        <TopAppBar workspaces={[mockWorkspaces[0]]} />,
      )
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      fireEvent.mouseDown(baseElement)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('does not close workspace menu on mousedown inside workspace trigger', () => {
      renderWithRouter(<TopAppBar workspaces={[mockWorkspaces[0]]} />)
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      fireEvent.mouseDown(screen.getByRole('button', { name: /workspace/i }))
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('does not close workspace menu on mousedown inside workspace listbox', () => {
      renderWithRouter(<TopAppBar workspaces={[mockWorkspaces[0]]} />)
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      fireEvent.mouseDown(screen.getByRole('listbox'))
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
  })

  describe('workspace switcher — selection', () => {
    it('selects a workspace on option click and closes menu', () => {
      renderWithRouter(
        <TopAppBar workspaces={mockWorkspaces.slice(0, 2)} initialWorkspace="acme-corp" />,
      )
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      fireEvent.click(screen.getByRole('option', { name: /my workspace/i }))
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /workspace: my workspace/i }),
      ).toBeInTheDocument()
    })

    it('selects workspace on Enter key', () => {
      renderWithRouter(
        <TopAppBar workspaces={mockWorkspaces.slice(0, 2)} initialWorkspace="acme-corp" />,
      )
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      fireEvent.keyDown(screen.getByRole('option', { name: /my workspace/i }), {
        key: 'Enter',
      })
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /workspace: my workspace/i }),
      ).toBeInTheDocument()
    })

    it('selects workspace on Space key', () => {
      renderWithRouter(
        <TopAppBar workspaces={mockWorkspaces.slice(0, 2)} initialWorkspace="acme-corp" />,
      )
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      fireEvent.keyDown(screen.getByRole('option', { name: /my workspace/i }), {
        key: ' ',
      })
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('does not select workspace on other key in option', () => {
      renderWithRouter(
        <TopAppBar workspaces={mockWorkspaces.slice(0, 2)} initialWorkspace="acme-corp" />,
      )
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      fireEvent.keyDown(screen.getByRole('option', { name: /my workspace/i }), { key: 'Tab' })
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /workspace: acme corp/i }),
      ).toBeInTheDocument()
    })
  })

  describe('workspace switcher — keyboard navigation', () => {
    it('opens listbox on ArrowDown key from trigger', () => {
      renderWithRouter(<TopAppBar workspaces={[mockWorkspaces[0]]} />)
      fireEvent.keyDown(screen.getByRole('button', { name: /workspace/i }), {
        key: 'ArrowDown',
      })
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('closes listbox on Escape key from trigger', () => {
      renderWithRouter(<TopAppBar workspaces={[mockWorkspaces[0]]} />)
      const btn = screen.getByRole('button', { name: /workspace/i })
      fireEvent.click(btn)
      fireEvent.keyDown(btn, { key: 'Escape' })
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('closes listbox on Escape from the listbox', () => {
      renderWithRouter(<TopAppBar workspaces={[mockWorkspaces[0]]} />)
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('ArrowDown in listbox wraps to first item from last', () => {
      const testWorkspaces: WorkspaceMetadata[] = [
        { id: "a", name: "A", initials: "A" },
        { id: "b", name: "B", initials: "B" },
        { id: "c", name: "C", initials: "C" },
      ]
      renderWithRouter(<TopAppBar workspaces={testWorkspaces} />)
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      const list = screen.getByRole('listbox')
      // Fire ArrowDown multiple times; should not throw
      fireEvent.keyDown(list, { key: 'ArrowDown' })
      fireEvent.keyDown(list, { key: 'ArrowDown' })
      fireEvent.keyDown(list, { key: 'ArrowDown' })
      // After 3 downs from none-selected, wraps back to first — no error
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('ArrowUp in listbox wraps to last item from first', () => {
      const testWorkspaces: WorkspaceMetadata[] = [
        { id: "a", name: "A", initials: "A" },
        { id: "b", name: "B", initials: "B" },
      ]
      renderWithRouter(<TopAppBar workspaces={testWorkspaces} />)
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowUp' })
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('Home key focuses first option', () => {
      const testWorkspaces: WorkspaceMetadata[] = [
        { id: "a", name: "A", initials: "A" },
        { id: "b", name: "B", initials: "B" },
        { id: "c", name: "C", initials: "C" },
      ]
      renderWithRouter(<TopAppBar workspaces={testWorkspaces} />)
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Home' })
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('End key focuses last option', () => {
      const testWorkspaces: WorkspaceMetadata[] = [
        { id: "a", name: "A", initials: "A" },
        { id: "b", name: "B", initials: "B" },
        { id: "c", name: "C", initials: "C" },
      ]
      renderWithRouter(<TopAppBar workspaces={testWorkspaces} />)
      fireEvent.click(screen.getByRole('button', { name: /workspace/i }))
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'End' })
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('Escape key does nothing when listbox is already closed', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.keyDown(screen.getByRole('button', { name: /workspace/i }), {
        key: 'Escape',
      })
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('ArrowDown does nothing when listbox is already open (handled by list)', () => {
      renderWithRouter(<TopAppBar workspaces={[mockWorkspaces[0]]} />)
      const btn = screen.getByRole('button', { name: /workspace/i })
      fireEvent.click(btn)
      // Pressing ArrowDown on trigger when open should NOT toggle closed
      fireEvent.keyDown(btn, { key: 'ArrowDown' })
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
  })

  // ─── Environment badge ─────────────────────────────────────────────────────

  describe('environment badge', () => {
    it('renders testnet badge by default', () => {
      renderWithRouter(<TopAppBar initialEnvironment="testnet" />)
      expect(screen.getByRole('button', { name: /environment: testnet/i })).toBeInTheDocument()
    })

    it('renders mainnet badge when set', () => {
      renderWithRouter(<TopAppBar initialEnvironment="mainnet" />)
      expect(screen.getByRole('button', { name: /environment: mainnet/i })).toBeInTheDocument()
    })

    it('toggles from testnet to mainnet on click', () => {
      renderWithRouter(<TopAppBar initialEnvironment="testnet" />)
      fireEvent.click(screen.getByRole('button', { name: /environment: testnet/i }))
      expect(screen.getByRole('button', { name: /environment: mainnet/i })).toBeInTheDocument()
    })

    it('toggles from mainnet to testnet on click', () => {
      renderWithRouter(<TopAppBar initialEnvironment="mainnet" />)
      fireEvent.click(screen.getByRole('button', { name: /environment: mainnet/i }))
      expect(screen.getByRole('button', { name: /environment: testnet/i })).toBeInTheDocument()
    })
  })

  // ─── Account menu ──────────────────────────────────────────────────────────

  describe('account menu — closed state', () => {
    it('account menu is not present initially', () => {
      renderWithRouter(<TopAppBar />)
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('account trigger has aria-haspopup="menu"', () => {
      renderWithRouter(<TopAppBar />)
      expect(screen.getByRole('button', { name: /account menu/i })).toHaveAttribute(
        'aria-haspopup',
        'menu',
      )
    })

    it('account trigger has aria-expanded="false" when closed', () => {
      renderWithRouter(<TopAppBar />)
      expect(screen.getByRole('button', { name: /account menu/i })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
    })
  })

  describe('account menu — open state', () => {
    it('opens menu on trigger click', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('closes menu on second trigger click', () => {
      renderWithRouter(<TopAppBar />)
      const btn = screen.getByRole('button', { name: /account menu/i })
      fireEvent.click(btn)
      fireEvent.click(btn)
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('trigger has aria-expanded="true" when open', () => {
      renderWithRouter(<TopAppBar />)
      const btn = screen.getByRole('button', { name: /account menu/i })
      fireEvent.click(btn)
      expect(btn).toHaveAttribute('aria-expanded', 'true')
    })

    it('renders Profile settings menuitem', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      expect(screen.getByRole('menuitem', { name: /^settings$/i })).toBeInTheDocument()
    })

    it('renders API keys menuitem', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      expect(screen.getByRole('menuitem', { name: /api keys/i })).toBeInTheDocument()
    })

    it('renders Sign out menuitem', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()
    })

    it('closes menu when Profile settings is clicked', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.click(screen.getByRole('menuitem', { name: /^settings$/i }))
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('closes menu when API keys is clicked', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.click(screen.getByRole('menuitem', { name: /api keys/i }))
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('closes menu when Sign out is clicked', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.click(screen.getByRole('menuitem', { name: /sign out/i }))
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('closes outside click — mousedown on document body', () => {
      const { baseElement } = renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      expect(screen.getByRole('menu')).toBeInTheDocument()
      fireEvent.mouseDown(baseElement)
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('does not close account menu on mousedown inside account trigger', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.mouseDown(screen.getByRole('button', { name: /account menu/i }))
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('does not close account menu on mousedown inside account menu', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.mouseDown(screen.getByRole('menu'))
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })
  })

  describe('account menu — keyboard navigation', () => {
    it('opens menu on ArrowDown key from trigger', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.keyDown(screen.getByRole('button', { name: /account menu/i }), {
        key: 'ArrowDown',
      })
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('closes menu on Escape key from trigger', () => {
      renderWithRouter(<TopAppBar />)
      const btn = screen.getByRole('button', { name: /account menu/i })
      fireEvent.click(btn)
      fireEvent.keyDown(btn, { key: 'Escape' })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('closes menu on Escape from the menu element', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('activates Profile settings on Enter key', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menuitem', { name: /^settings$/i }), { key: 'Enter' })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('activates Profile settings on Space key', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menuitem', { name: /^settings$/i }), { key: ' ' })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('does not close menu on other key from Profile settings', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menuitem', { name: /^settings$/i }), { key: 'Tab' })
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('activates API keys on Enter key', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menuitem', { name: /api keys/i }), {
        key: 'Enter',
      })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('activates API keys on Space key', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menuitem', { name: /api keys/i }), {
        key: ' ',
      })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('does not close menu on other key from API keys', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menuitem', { name: /api keys/i }), {
        key: 'Tab',
      })
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('activates Sign out on Enter key', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menuitem', { name: /sign out/i }), {
        key: 'Enter',
      })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('activates Sign out on Space key', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menuitem', { name: /sign out/i }), {
        key: ' ',
      })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('does not close menu on other key from Sign out', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menuitem', { name: /sign out/i }), {
        key: 'Tab',
      })
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('ArrowDown in menu wraps correctly', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      const menu = screen.getByRole('menu')
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('ArrowUp in menu wraps to last from first', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('Home focuses first menuitem', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Home' })
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('End focuses last menuitem', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' })
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('Escape does nothing when menu is already closed', () => {
      renderWithRouter(<TopAppBar />)
      fireEvent.keyDown(screen.getByRole('button', { name: /account menu/i }), {
        key: 'Escape',
      })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('ArrowDown does nothing to closed state when already open', () => {
      renderWithRouter(<TopAppBar />)
      const btn = screen.getByRole('button', { name: /account menu/i })
      fireEvent.click(btn)
      fireEvent.keyDown(btn, { key: 'ArrowDown' })
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })
  })

  // ─── Sidebar toggle (hamburger) ────────────────────────────────────────────

  describe('sidebar toggle', () => {
    it('calls onSidebarToggle when hamburger is clicked', () => {
      const onToggle = vi.fn()
      renderWithRouter(<TopAppBar onSidebarToggle={onToggle} sidebarOpen={false} />)
      fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('shows "Close navigation" label when sidebar is open', () => {
      renderWithRouter(<TopAppBar sidebarOpen={true} />)
      expect(
        screen.getByRole('button', { name: /close navigation/i }),
      ).toBeInTheDocument()
    })

    it('shows "Open navigation" label when sidebar is closed', () => {
      renderWithRouter(<TopAppBar sidebarOpen={false} />)
      expect(
        screen.getByRole('button', { name: /open navigation/i }),
      ).toBeInTheDocument()
    })

    it('hamburger has aria-expanded=true when sidebar is open', () => {
      renderWithRouter(<TopAppBar sidebarOpen={true} />)
      expect(
        screen.getByRole('button', { name: /close navigation/i }),
      ).toHaveAttribute('aria-expanded', 'true')
    })

    it('hamburger has aria-expanded=false when sidebar is closed', () => {
      renderWithRouter(<TopAppBar sidebarOpen={false} />)
      expect(
        screen.getByRole('button', { name: /open navigation/i }),
      ).toHaveAttribute('aria-expanded', 'false')
    })

    it('hamburger has aria-controls="app-sidebar"', () => {
      renderWithRouter(<TopAppBar />)
      expect(
        screen.getByRole('button', { name: /navigation/i }),
      ).toHaveAttribute('aria-controls', 'app-sidebar')
    })
  })
})

// ─── Layout ───────────────────────────────────────────────────────────────────

describe('Layout', () => {
  it('renders the banner (top app bar) inside the shell', () => {
    renderWithRouter(<Layout />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('renders skip-to-content link', () => {
    renderWithRouter(<Layout />)
    expect(screen.getByText(/skip to main content/i)).toBeInTheDocument()
  })

  it('skip link href points to #main-content', () => {
    renderWithRouter(<Layout />)
    expect(
      (screen.getByText(/skip to main content/i) as HTMLAnchorElement).href,
    ).toContain('#main-content')
  })

  it('renders main element with id="main-content"', () => {
    renderWithRouter(<Layout />)
    expect(document.getElementById('main-content')).toBeInTheDocument()
  })

  it('main element has tabIndex="-1" for skip-link focus target', () => {
    renderWithRouter(<Layout />)
    expect(document.getElementById('main-content')).toHaveAttribute('tabindex', '-1')
  })

  it('main element has class app-main', () => {
    renderWithRouter(<Layout />)
    expect(document.getElementById('main-content')).toHaveClass('app-main')
  })

  it('renders navigation landmark with aria-label', () => {
    renderWithRouter(<Layout />)
    expect(
      screen.getByRole('navigation', { name: /main navigation/i }),
    ).toBeInTheDocument()
  })

  it('renders sidebar with complementary landmark and label', () => {
    renderWithRouter(<Layout />)
    expect(
      screen.getByRole('complementary', { name: /site navigation/i }),
    ).toBeInTheDocument()
  })

  it('sidebar has id="app-sidebar" for hamburger aria-controls', () => {
    renderWithRouter(<Layout />)
    expect(document.getElementById('app-sidebar')).toBeInTheDocument()
  })

  it('renders Dashboard nav link', () => {
    renderWithRouter(<Layout />)
    expect(screen.getAllByRole('link', { name: /dashboard/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('renders Attestations nav link', () => {
    renderWithRouter(<Layout />)
    expect(screen.getAllByRole('link', { name: /attestations/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('active link (Dashboard at /) has aria-current="page"', () => {
    renderWithRouter(<Layout />, { initialEntries: ['/dashboard'] })
    const aside = document.getElementById('app-sidebar')!
    const dashLinks = Array.from(aside.querySelectorAll('a')).filter(a => /dashboard/i.test(a.textContent ?? ''))
    const activeLink = dashLinks.find(l => l.getAttribute('aria-current') === 'page')
    expect(activeLink).toBeDefined()
  })

  it('inactive link does not have aria-current', () => {
    renderWithRouter(<Layout />, { initialEntries: ['/'] })
    // The sidebar Attestations link should not be active at /
    const aside = document.getElementById('app-sidebar')!
    const attestationsLinks = Array.from(aside.querySelectorAll('a')).filter(a => /attestations/i.test(a.textContent ?? ''))
    expect(attestationsLinks.length).toBeGreaterThanOrEqual(1)
    expect(attestationsLinks[0]).not.toHaveAttribute('aria-current', 'page')
  })

  it('Attestations link is active at /attestations and Dashboard is not', () => {
    renderWithRouter(<Layout />, { initialEntries: ['/attestations'] })
    const aside = document.getElementById('app-sidebar')!
    const attestationsLink = Array.from(aside.querySelectorAll('a')).find(a => /attestations/i.test(a.textContent ?? ''))
    const dashboardLink = Array.from(aside.querySelectorAll('a')).find(a => /dashboard/i.test(a.textContent ?? ''))
    expect(attestationsLink).toHaveAttribute('aria-current', 'page')
    expect(dashboardLink).not.toHaveAttribute('aria-current', 'page')
  })

  it('sidebar does not have app-sidebar-open class by default', () => {
    renderWithRouter(<Layout />)
    expect(document.getElementById('app-sidebar')).not.toHaveClass('app-sidebar-open')
  })

  it('sidebar opens when hamburger is clicked', () => {
    renderWithRouter(<Layout />)
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    expect(document.getElementById('app-sidebar')).toHaveClass('app-sidebar-open')
  })

  it('sidebar closes when hamburger is clicked again', () => {
    renderWithRouter(<Layout />)
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    fireEvent.click(screen.getByRole('button', { name: /close navigation/i }))
    expect(document.getElementById('app-sidebar')).not.toHaveClass('app-sidebar-open')
  })

  it('overlay appears when sidebar is open', () => {
    renderWithRouter(<Layout />)
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    expect(document.querySelector('.app-sidebar-overlay')).toBeInTheDocument()
  })

  it('sidebar closes when overlay is clicked', () => {
    renderWithRouter(<Layout />)
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    fireEvent.click(document.querySelector('.app-sidebar-overlay')!)
    expect(document.getElementById('app-sidebar')).not.toHaveClass('app-sidebar-open')
  })

  it('overlay is not present when sidebar is closed', () => {
    renderWithRouter(<Layout />)
    expect(document.querySelector('.app-sidebar-overlay')).not.toBeInTheDocument()
  })
})
