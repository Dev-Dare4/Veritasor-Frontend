import { useCallback, useEffect, useState, useRef } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import TopAppBar from "./TopAppBar";
import BottomTabBar from "./BottomTabBar";
import { ToastProvider } from "./ToastContext";
import OfflineBanner from "./OfflineBanner";
import { BillingProvider, useBilling } from "./BillingContext";
import ToastContainer from "./ToastContainer";
import ShortcutsOverlay from "./ShortcutsOverlay";
import ContextualHelpSearch from "./ContextualHelpSearch";
import { useSession } from "../hooks/useSession";
import { SessionExpiryWarning } from "./SessionExpiryWarning";
import { ReauthModal } from "./ReauthModal";

const configuredSessionDuration = Number(
  import.meta.env.VITE_SESSION_DURATION_MINUTES
);
const SESSION_DURATION_MINUTES =
  Number.isFinite(configuredSessionDuration) && configuredSessionDuration > 0
    ? configuredSessionDuration
    : 30;

const configuredWarningBefore = Number(
  import.meta.env.VITE_SESSION_WARNING_BEFORE_MINUTES
);
const WARNING_BEFORE_MINUTES =
  Number.isFinite(configuredWarningBefore) &&
  configuredWarningBefore > 0 &&
  configuredWarningBefore < SESSION_DURATION_MINUTES
    ? configuredWarningBefore
    : Math.min(5, SESSION_DURATION_MINUTES / 2);

function BillingBannerSlot() {
  const { failedPayment, dismissFailedPayment } = useBilling();
  if (!failedPayment) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
        padding: "0.6rem 1rem",
        background: "var(--danger-soft, #fef2f2)",
        borderBottom: "1px solid rgba(251, 113, 133, 0.4)",
        textAlign: "center", fontSize: "0.9rem", fontWeight: 600,
        color: "var(--danger, #e11d48)",
      }}
    >
      <span>
        ⚠ A recent payment failed.{' '}
        <button
          type="button"
          onClick={dismissFailedPayment}
          style={{ background: "none", border: "none", color: "inherit", fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontSize: "inherit", fontFamily: "inherit" }}
        >
          Update payment method
        </button>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LayoutInner
// ---------------------------------------------------------------------------

function LayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [helpSearchOpen, setHelpSearchOpen] = useState(false);
  const [openWsSwitcherInSearchMode, setOpenWsSwitcherInSearchMode] = useState(false);
  const handleSessionExpiry = useCallback(() => {
    navigate("/login", {
      replace: true,
      state: { from: location },
    });
  }, [location, navigate]);
  const session = useSession({
    sessionDurationMinutes: SESSION_DURATION_MINUTES,
    warningBeforeMinutes: WARNING_BEFORE_MINUTES,
    onSessionExpiry: handleSessionExpiry,
  });

  const handleReauthSubmit = useCallback(() => {
    setReauthError(
      "Re-authentication is unavailable here. Please sign in again."
    );
  }, []);
  const handleReauthClose = useCallback(() => {
    navigate("/login", {
      replace: true,
      state: { from: location },
    });
  }, [location, navigate]);

  /**
   * Sequential key chord tracker for multi-key shortcuts.
   * Tracks the last key pressed so we can detect Ctrl+K → W.
   */
  const lastKeyRef = useRef<{ key: string; ctrlOrMeta: boolean } | null>(null);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close sidebar, update title, move focus on route change
  useEffect(() => {
    if (location.pathname === prevPathRef.current) return;
    prevPathRef.current = location.pathname;
    setSidebarOpen(false);
    document.title = getPageTitle(location.pathname);
    requestAnimationFrame(() => { mainRef.current?.focus(); });
  }, [location.pathname]);

  // Escape key closes the sidebar and returns focus to the hamburger
  useEffect(() => {
    if (!sidebarOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') { setSidebarOpen(false); focusHamburger(); }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (!isEditable && e.shiftKey && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k" && !isEditable) {
        e.preventDefault();
        if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
        lastKeyRef.current = { key: "k", ctrlOrMeta: true };
        chordTimerRef.current = setTimeout(() => { lastKeyRef.current = null; }, 1500);
        return;
      }
      if (!isEditable && e.key === "w" && lastKeyRef.current?.key === "k" && lastKeyRef.current?.ctrlOrMeta) {
        e.preventDefault();
        if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
        lastKeyRef.current = null;
        return;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
    };
  }, []);

  function toggleSidebar() { setSidebarOpen((o) => !o); }
  function closeSidebar() { setSidebarOpen(false); }

  return (
    <div className="vt-shell">
      {/* Skip link — first focusable element */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <OfflineBanner />
      <TopAppBar
        onSidebarToggle={toggleSidebar}
        sidebarOpen={sidebarOpen}
        openWorkspaceSwitcherInSearchMode={openWsSwitcherInSearchMode}
        onWorkspaceSwitcherOpenChange={(open) => {
          if (!open) setOpenWsSwitcherInSearchMode(false);
        }}
      />

      <div className="app-body">
        <aside id="app-sidebar" className={`app-sidebar${sidebarOpen ? " app-sidebar-open" : ""}`} aria-label="Site navigation">
          <nav aria-label="Main navigation">
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                `sidebar-link${isActive ? " sidebar-link-active" : ""}`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/attestations"
              className={({ isActive }) =>
                `sidebar-link${isActive ? " sidebar-link-active" : ""}`
              }
            >
              Attestations
            </NavLink>
            <NavLink
              to="/sources"
              className={({ isActive }) =>
                `sidebar-link${isActive ? " sidebar-link-active" : ""}`
              }
            >
              Revenue Sources
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `sidebar-link${isActive ? " sidebar-link-active" : ""}`
              }
            >
              Settings
            </NavLink>
            <NavLink
              to="/api-keys"
              className={({ isActive }) =>
                `sidebar-link${isActive ? " sidebar-link-active" : ""}`
              }
            >
              API keys
            </NavLink>
          </nav>
          <div className="sidebar-footer">
            <button type="button" className="sidebar-cookie-btn" onClick={() => navigate('/consent-preferences')} aria-label="Open cookie settings">Cookie settings</button>
            <button type="button" className="sidebar-help-btn" onClick={() => setHelpSearchOpen(true)} aria-label="Open help search (Ctrl+H)">Help &amp; support</button>
            <a className="sidebar-help-btn sidebar-github" href="https://github.com/Veritasor/Veritasor-Frontend" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </aside>

        {sidebarOpen && <div className="app-sidebar-overlay" aria-hidden="true" onClick={closeSidebar} />}

        <main id="main-content" ref={mainRef} tabIndex={-1} className="app-main">
          <BillingBannerSlot />
          <Outlet />
        </main>
      </div>

      <BottomTabBar />
      <ToastContainer />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ContextualHelpSearch open={helpSearchOpen} onClose={() => setHelpSearchOpen(false)} />
      <SessionExpiryWarning
        isOpen={session.showWarning}
        timeLeft={session.timeLeft}
        onExtendSession={session.extendSession}
        onReauth={() => {
          setReauthError(null);
          session.initiateReauth();
        }}
      />
      <ReauthModal
        isOpen={session.isReauthenticating}
        error={reauthError}
        onSuccess={handleReauthSubmit}
        onClose={handleReauthClose}
      />
    </div>
  );
}

export default function Layout() {
  return (
    <BillingProvider>
      <ToastProvider>
        <LayoutInner />
      </ToastProvider>
    </BillingProvider>
  );
}
