import { createContext, useContext, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useBlocker, useLocation, useNavigate } from 'react-router-dom'
import LocalePickerField from '../components/LocalePicker/LocalePickerField'
import AuditLogTimeline, { type AuditLogEntry } from '../components/audit-log/AuditLogTimeline'
import type { AuditLogEntryDetail } from '../components/audit-log/AuditLogDetailDrawer'
import TokensExport from '../components/tokens/TokensExport'
import TokensDiffViewer from '../components/tokens/TokensDiffViewer'
import A11yAuditPanel from '../components/a11y/A11yAuditPanel'
import A11yCoverageMatrix from '../components/a11y/A11yCoverageMatrix'
import SettingsIntegrationsPanel from './SettingsIntegrationsPanel'
import MfaMethodChooser from '../components/MfaMethodChooser'
import type { MfaMethod } from '../components/MfaMethodChooser'
import WebhookRetryPanel from '../components/WebhookRetryPanel'
import type { WebhookDelivery } from '../components/api-keys/apiKeyTypes'
import DensityToggle from '../components/DensityToggle'
import DirtyStateBanner from '../components/DirtyStateBanner'
import { useDirtyForm, type SaveStatus } from '../hooks/useDirtyForm'
import { validatePassword } from '../utils/passwordPolicy'

// Tab definitions ordered by frequency of use
const TABS = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "appearance", label: "Appearance" },
  { id: "team", label: "Team" },
  { id: "integrations", label: "Integrations" },
  { id: "api-keys", label: "API Keys" },
  { id: "tokens", label: "Tokens" },
  { id: "billing", label: "Billing" },
  { id: "security", label: "Security" },
  { id: "audit-log", label: "Audit Log" },
  { id: "a11y-audit", label: "Accessibility" },
] as const;

type TabId = (typeof TABS)[number]['id']

function getTabFromHash(hash: string): TabId {
  const id = hash.replace("#", "") as TabId;
  return TABS.some((t) => t.id === id) ? id : TABS[0].id;
}

// ─── Dirty-state registry (page-level) ────────────────────────────────────────

type DirtyTabEntry = {
  isDirty: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  save: () => Promise<void>;
  reset: () => void;
};

interface DirtyRegistryCtx {
  entries: Map<TabId, DirtyTabEntry>;
  register: (tab: TabId, entry: DirtyTabEntry) => void;
  unregister: (tab: TabId) => void;
}

const DirtyRegistryContext = createContext<DirtyRegistryCtx | null>(null);

function useDirtyRegistry() {
  const ctx = useContext(DirtyRegistryContext);
  if (!ctx) throw new Error("useDirtyRegistry must be used within Settings");
  return ctx;
}

function usePageDirtyState(registry: DirtyRegistryCtx): {
  anyDirty: boolean;
  dirtyTabs: TabId[];
  aggregateStatus: SaveStatus;
  lastSavedAt: Date | null;
  saveAll: () => Promise<void>;
  discardAll: () => void;
} {
  const { entries } = registry;
  return useMemo(() => {
    let anyDirty = false;
    const dirtyTabs: TabId[] = [];
    let aggregateStatus: SaveStatus = "idle";
    let lastSavedAt: Date | null = null;

    for (const [tab, e] of entries) {
      if (e.isDirty) {
        anyDirty = true;
        dirtyTabs.push(tab);
      }
      if (
        e.saveStatus === "saving" ||
        (e.saveStatus === "dirty" && aggregateStatus !== "saving") ||
        (e.saveStatus === "saved" && aggregateStatus === "idle")
      ) {
        aggregateStatus = e.saveStatus;
      }
      if (e.lastSavedAt && (!lastSavedAt || e.lastSavedAt > lastSavedAt)) {
        lastSavedAt = e.lastSavedAt;
      }
    }

    return {
      anyDirty,
      dirtyTabs,
      aggregateStatus: anyDirty
        ? aggregateStatus === "saving"
          ? "saving"
          : "dirty"
        : aggregateStatus,
      lastSavedAt,
      saveAll: async () => {
        const results = Array.from(entries.values())
          .filter((e) => e.isDirty)
          .map((e) => e.save());
        await Promise.all(results);
      },
      discardAll: () => {
        for (const e of entries.values()) e.reset();
      },
    };
  }, [entries]);
}

// ─── MFA section stubs (completeness) ────────────────────────────────────────

type MfaState = "setup" | "enabled" | "recovery" | "disabled";
const mfaState: MfaState = "disabled";
const mfaSection: Record<MfaState, () => JSX.Element> = {
  setup: () => <div />,
  enabled: () => <div />,
  recovery: () => <div />,
  disabled: () => <div />,
};

// ─── Tab Panels ───────────────────────────────────────────────────────────────

function BusinessProfilePanel() {
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div>
        <h2>Business Profile</h2>
        <p style={{ color: "var(--muted)" }}>
          Manage your business details, legal entity information, and compliance settings.
        </p>
      </div>
    </div>
  );
}

function ProfilePanel() {
  const registry = useDirtyRegistry();

  const form = useDirtyForm({
    storageKey: "veritasor_settings_profile_draft",
    initialValues: {
      displayName: "Joel Agboola",
      email: "joel@example.com",
    },
    autoSave: true,
    autoSaveIntervalMs: 3000,
  });

  useEffect(() => {
    registry.register("profile", {
      isDirty: form.isDirty,
      saveStatus: form.saveStatus,
      lastSavedAt: form.lastSavedAt,
      save: form.save,
      reset: form.reset,
    });
    return () => registry.unregister("profile");
  }, [
    registry.register,
    registry.unregister,
    form.isDirty,
    form.saveStatus,
    form.lastSavedAt,
    form.save,
    form.reset,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await form.save();
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <DirtyStateBanner
        isDirty={form.isDirty}
        saveStatus={form.saveStatus}
        lastSavedAt={form.lastSavedAt}
        onSave={form.save}
        onDiscard={form.reset}
        formLabel="Profile"
      />
      <div>
        <h2>Profile</h2>
        <p style={{ color: "var(--muted)" }}>
          Manage your personal information and display name.
        </p>
        <form
          style={{ display: "grid", gap: "1rem", maxWidth: 480 }}
          onSubmit={handleSubmit}
          aria-describedby="profile-sr-status"
        >
          <span id="profile-sr-status" className="sr-only" aria-live="polite" />
          <LocalePickerField />
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <label
              htmlFor="settings-display-name"
              style={{ fontSize: "0.9rem", fontWeight: 600 }}
            >
              Display name
            </label>
            <input
              id="settings-display-name"
              type="text"
              value={form.values.displayName}
              onChange={(e) => form.setField("displayName", e.target.value)}
              aria-invalid={false}
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: 8,
                border: `1px solid ${form.isDirty ? "var(--border-strong)" : "var(--border)"}`,
                background: "var(--surface-strong)",
                color: "var(--text)",
                fontSize: "0.95rem",
              }}
            />
          </div>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <label
              htmlFor="settings-email"
              style={{ fontSize: "0.9rem", fontWeight: 600 }}
            >
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              value={form.values.email}
              onChange={(e) => form.setField("email", e.target.value)}
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: 8,
                border: `1px solid ${form.isDirty ? "var(--border-strong)" : "var(--border)"}`,
                background: "var(--surface-strong)",
                color: "var(--text)",
                fontSize: "0.95rem",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="submit"
              disabled={!form.isDirty || form.saveStatus === "saving"}
              aria-busy={form.saveStatus === "saving"}
              style={{
                alignSelf: "start",
                padding: "0.6rem 1.25rem",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "#04111f",
                fontWeight: 700,
                cursor:
                  !form.isDirty || form.saveStatus === "saving"
                    ? "default"
                    : "pointer",
                fontSize: "0.95rem",
                opacity:
                  !form.isDirty || form.saveStatus === "saving" ? 0.6 : 1,
                minHeight: "2.75rem",
              }}
            >
              {form.saveStatus === "saving" ? "Saving…" : "Save changes"}
            </button>
            {form.isDirty && (
              <button
                type="button"
                onClick={form.reset}
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  minHeight: "2.75rem",
                }}
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

type NotificationChannel = "email" | "inapp" | "webhook";

interface NotificationCategory {
  id: string;
  title: string;
  description: string;
  defaults: Record<NotificationChannel, boolean>;
}

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    id: "attestation-completed",
    title: "Attestation completed",
    description:
      "A revenue attestation run finished successfully with a valid Merkle root.",
    defaults: { email: true, inapp: true, webhook: true },
  },
  {
    id: "attestation-failed",
    title: "Attestation failed",
    description:
      "An attestation run timed out, returned an error, or produced invalid evidence.",
    defaults: { email: true, inapp: true, webhook: true },
  },
  {
    id: "source-connected",
    title: "Revenue source connected",
    description:
      "A new data source (Stripe, QuickBooks, Plaid, etc.) was linked to the workspace.",
    defaults: { email: true, inapp: true, webhook: false },
  },
  {
    id: "source-disconnected",
    title: "Revenue source disconnected",
    description:
      "A previously connected data source lost authorization or was removed by a team member.",
    defaults: { email: true, inapp: true, webhook: true },
  },
  {
    id: "invoice-generated",
    title: "Billing invoice generated",
    description:
      "A new subscription invoice is ready. Receipts are also available in Billing.",
    defaults: { email: true, inapp: false, webhook: false },
  },
  {
    id: "payment-failed",
    title: "Payment failed",
    description:
      "A subscription charge could not be processed. Service may be interrupted.",
    defaults: { email: true, inapp: true, webhook: true },
  },
  {
    id: "team-invite",
    title: "Team member invite or removal",
    description:
      "Someone was invited to the workspace, accepted, or was removed by an admin.",
    defaults: { email: true, inapp: true, webhook: false },
  },
  {
    id: "api-key-rotated",
    title: "API key rotated or revoked",
    description:
      "A workspace API key was rotated, revoked, or is about to expire.",
    defaults: { email: true, inapp: true, webhook: true },
  },
  {
    id: "security-alert",
    title: "Security alerts",
    description:
      "Sign-in from a new device, MFA method changes, or recovery code usage.",
    defaults: { email: true, inapp: true, webhook: true },
  },
];

const CHANNEL_META: Record<
  NotificationChannel,
  { label: string; icon: string; help: string }
> = {
  email: {
    label: "Email",
    icon: "✉",
    help: "Delivered to your verified inbox with reply-to support.",
  },
  inapp: {
    label: "In-app",
    icon: "🔔",
    help: "Shown in the product bell menu and marked as read/unread.",
  },
  webhook: {
    label: "Webhook",
    icon: "🔗",
    help: "POST event payload to the configured endpoint URL.",
  },
};

function buildInitialPrefs(): Record<
  string,
  Record<NotificationChannel, boolean>
> {
  const prefs: Record<string, Record<NotificationChannel, boolean>> = {};
  for (const cat of NOTIFICATION_CATEGORIES) {
    prefs[cat.id] = { ...cat.defaults };
  }
  return prefs;
}

function NotificationsPanel() {
  const registry = useDirtyRegistry();
  const notificationItems = [
    "Attestation completed",
    "Attestation failed",
    "New revenue source connected",
    "Billing invoice generated",
  ] as const;
  type NotifItem = (typeof notificationItems)[number];

  const initialNotifs: Record<NotifItem, boolean> = {
    "Attestation completed": true,
    "Attestation failed": true,
    "New revenue source connected": true,
    "Billing invoice generated": true,
  };

  const form = useDirtyForm({
    storageKey: "veritasor_settings_notifications_draft",
    initialValues: initialNotifs,
    autoSave: true,
    autoSaveIntervalMs: 2500,
  });

  useEffect(() => {
    registry.register("notifications", {
      isDirty: form.isDirty,
      saveStatus: form.saveStatus,
      lastSavedAt: form.lastSavedAt,
      save: form.save,
      reset: form.reset,
    });
    return () => registry.unregister("notifications");
  }, [
    registry.register,
    registry.unregister,
    form.isDirty,
    form.saveStatus,
    form.lastSavedAt,
    form.save,
    form.reset,
  ]);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <DirtyStateBanner
        isDirty={form.isDirty}
        saveStatus={form.saveStatus}
        lastSavedAt={form.lastSavedAt}
        onSave={form.save}
        onDiscard={form.reset}
        formLabel="Notifications"
      />
      <div>
        <h2>Notifications</h2>
        <p style={{ color: "var(--muted)" }}>
          Choose which events trigger email notifications.
        </p>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="sr-only">Email notification preferences</legend>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              display: "grid",
              gap: "0.75rem",
              maxWidth: 480,
            }}
          >
            {notificationItems.map((item) => (
              <li
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <input
                  id={`notif-${item}`}
                  type="checkbox"
                  checked={form.values[item]}
                  onChange={(e) => form.setField(item, e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <label
                  htmlFor={`notif-${item}`}
                  style={{ fontSize: "0.95rem" }}
                >
                  {item}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </div>
    </div>
  );
}

function ApiKeysPanel() {
  return (
    <div>
      <h2>API Keys</h2>
      <p style={{ color: "var(--muted)" }}>
        Create and manage API keys for programmatic access.
      </p>
      <div
        style={{
          padding: "0.9rem 1rem",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface-strong)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 600,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
            Production key
          </div>
          <code style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            vrt_live_••••••••••••3f9a
          </code>
        </div>
        <button
          type="button"
          style={{
            padding: "0.4rem 0.9rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          Revoke
        </button>
      </div>
    </div>
  );
}

type InvoiceStatus = "paid" | "open" | "overdue" | "void";

interface Invoice {
  id: string;
  period: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  pdfUrl: string;
}

const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; bg: string; border: string; color: string; dot: string }
> = {
  paid: {
    label: "Paid",
    bg: "var(--success-soft)",
    border: "rgba(52, 211, 153, 0.35)",
    color: "var(--success)",
    dot: "var(--success)",
  },
  open: {
    label: "Open",
    bg: "rgba(96, 165, 250, 0.12)",
    border: "rgba(96, 165, 250, 0.35)",
    color: "#60a5fa",
    dot: "#60a5fa",
  },
  overdue: {
    label: "Overdue",
    bg: "var(--danger-soft)",
    border: "rgba(251, 113, 133, 0.35)",
    color: "var(--danger)",
    dot: "var(--danger)",
  },
  void: {
    label: "Void",
    bg: "var(--surface-soft)",
    border: "rgba(148, 163, 184, 0.35)",
    color: "var(--muted)",
    dot: "var(--muted)",
  },
};

const MOCK_INVOICES: Invoice[] = [
  {
    id: "inv_001",
    period: "June 2026",
    amount: 49.0,
    status: "paid",
    dueDate: "2026-06-01",
    pdfUrl: "#invoice-001",
  },
  {
    id: "inv_002",
    period: "May 2026",
    amount: 49.0,
    status: "paid",
    dueDate: "2026-05-01",
    pdfUrl: "#invoice-002",
  },
  {
    id: "inv_003",
    period: "April 2026",
    amount: 49.0,
    status: "paid",
    dueDate: "2026-04-01",
    pdfUrl: "#invoice-003",
  },
  {
    id: "inv_004",
    period: "July 2026",
    amount: 49.0,
    status: "open",
    dueDate: "2026-07-15",
    pdfUrl: "#invoice-004",
  },
  {
    id: "inv_005",
    period: "March 2026",
    amount: 29.0,
    status: "overdue",
    dueDate: "2026-03-15",
    pdfUrl: "#invoice-005",
  },
  {
    id: "inv_006",
    period: "February 2026",
    amount: 29.0,
    status: "void",
    dueDate: "2026-02-15",
    pdfUrl: "#invoice-006",
  },
  {
    id: "inv_007",
    period: "January 2026",
    amount: 29.0,
    status: "paid",
    dueDate: "2026-01-15",
    pdfUrl: "#invoice-007",
  },
  {
    id: "inv_008",
    period: "December 2025",
    amount: 29.0,
    status: "paid",
    dueDate: "2025-12-15",
    pdfUrl: "#invoice-008",
  },
  {
    id: "inv_009",
    period: "November 2025",
    amount: 29.0,
    status: "paid",
    dueDate: "2025-11-15",
    pdfUrl: "#invoice-009",
  },
  {
    id: "inv_010",
    period: "October 2025",
    amount: 29.0,
    status: "paid",
    dueDate: "2025-10-15",
    pdfUrl: "#invoice-010",
  },
  {
    id: "inv_011",
    period: "September 2025",
    amount: 29.0,
    status: "paid",
    dueDate: "2025-09-15",
    pdfUrl: "#invoice-011",
  },
  {
    id: "inv_012",
    period: "August 2025",
    amount: 29.0,
    status: "paid",
    dueDate: "2025-08-15",
    pdfUrl: "#invoice-012",
  },
];

const INVOICES_PER_PAGE = 5;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  const meta = INVOICE_STATUS_META[status];
  return (
    <span
      role="status"
      aria-label={`Invoice status: ${meta.label}`}
      className="status-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "var(--density-badge-padding)",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: "var(--density-badge-font)",
        border: `1px solid ${meta.border}`,
        background: meta.bg,
        color: meta.color,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "0.5rem",
          height: "0.5rem",
          borderRadius: "50%",
          background: meta.dot,
          flexShrink: 0,
        }}
      />
      {meta.label}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.75rem 1rem",
  textAlign: "left",
  fontSize: "0.78rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--muted)",
  borderBottom: "1px solid var(--border)",
};

const tdStyle: React.CSSProperties = {
  padding: "0.9rem 1rem",
  fontSize: "0.92rem",
  color: "var(--text)",
  verticalAlign: "middle",
};

const iconBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.5rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-strong)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
  minHeight: "2.5rem",
  textDecoration: "none",
  transition: "border-color 120ms ease, background-color 120ms ease",
};

const pagerBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "2.5rem",
  minHeight: "2.5rem",
  padding: "0.45rem 0.85rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: "0.88rem",
  fontWeight: 500,
  transition: "all 120ms ease",
};

const inputStyle: React.CSSProperties = {
  padding: "0.6rem 0.8rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-strong)",
  color: "var(--text)",
  fontSize: "0.95rem",
  minHeight: "2.75rem",
};

function InvoiceList() {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(MOCK_INVOICES.length / INVOICES_PER_PAGE);
  const startIdx = (page - 1) * INVOICES_PER_PAGE;
  const pageInvoices = MOCK_INVOICES.slice(
    startIdx,
    startIdx + INVOICES_PER_PAGE,
  );

  return (
    <section
      aria-labelledby="invoice-list-heading"
      style={{ display: "grid", gap: "1rem" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            id="invoice-list-heading"
            style={{ margin: 0, fontSize: "1.05rem" }}
          >
            Invoice history
          </h3>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            Download PDF receipts and track payment status.
          </p>
        </div>
        <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Showing {startIdx + 1}–
          {Math.min(startIdx + INVOICES_PER_PAGE, MOCK_INVOICES.length)} of{" "}
          {MOCK_INVOICES.length}
        </div>
      </div>

      <div
        role="region"
        aria-label="Invoice list table"
        style={{ overflowX: "auto" }}
      >
        <table
          className="invoice-table"
          style={{
            width: "100%",
            minWidth: 560,
            borderCollapse: "separate",
            borderSpacing: 0,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          <thead>
            <tr style={{ background: "var(--surface-strong)" }}>
              <th scope="col" style={thStyle}>
                Period
              </th>
              <th scope="col" style={thStyle}>
                Due date
              </th>
              <th scope="col" style={thStyle}>
                Amount
              </th>
              <th scope="col" style={thStyle}>
                Status
              </th>
              <th scope="col" style={{ ...thStyle, textAlign: "right" }}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageInvoices.map((inv) => {
              const due = new Date(inv.dueDate);
              return (
                <tr
                  key={inv.id}
                  className="invoice-row"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{inv.period}</div>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.82rem",
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                      }}
                    >
                      {inv.id}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {due.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatCurrency(inv.amount)}
                  </td>
                  <td style={tdStyle}>
                    <InvoiceStatusChip status={inv.status} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <a
                      href={inv.pdfUrl}
                      className="icon-button"
                      aria-label={`Download PDF invoice for ${inv.period}`}
                      style={iconBtnStyle}
                    >
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0 }}
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span style={{ whiteSpace: "nowrap" }}>PDF</span>
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Invoice list pagination"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            Page{" "}
            <span style={{ fontWeight: 600, color: "var(--text)" }}>
              {page}
            </span>{" "}
            of {totalPages}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              style={pagerBtnStyle}
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Go to page ${p}`}
                style={{
                  ...pagerBtnStyle,
                  background: p === page ? "var(--accent)" : "transparent",
                  color: p === page ? "#04111f" : "var(--text)",
                  borderColor: p === page ? "transparent" : "var(--border)",
                  fontWeight: p === page ? 700 : 500,
                }}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
              style={pagerBtnStyle}
            >
              Next →
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}

type CardBrand = "visa" | "mastercard" | "amex" | "discover";
type PaymentMethodStatus = "ok" | "expiring" | "expired";

interface PaymentMethod {
  id: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  status: PaymentMethodStatus;
  isDefault: boolean;
}

const CARD_BRAND_META: Record<
  CardBrand,
  { label: string; gradient: string; pattern: string }
> = {
  visa: {
    label: "Visa",
    gradient: "linear-gradient(135deg, #1a1f71 0%, #2d4ecf 100%)",
    pattern: "•",
  },
  mastercard: {
    label: "Mastercard",
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #dc2626 100%)",
    pattern: "◆",
  },
  amex: {
    label: "Amex",
    gradient: "linear-gradient(135deg, #006fcf 0%, #0077c5 100%)",
    pattern: "▲",
  },
  discover: {
    label: "Discover",
    gradient: "linear-gradient(135deg, #ff6600 0%, #e63946 100%)",
    pattern: "■",
  },
};

const MOCK_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "pm_001",
    brand: "visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2028,
    status: "ok",
    isDefault: true,
  },
  {
    id: "pm_002",
    brand: "mastercard",
    last4: "5678",
    expMonth: 8,
    expYear: 2026,
    status: "expiring",
    isDefault: false,
  },
  {
    id: "pm_003",
    brand: "amex",
    last4: "0005",
    expMonth: 3,
    expYear: 2025,
    status: "expired",
    isDefault: false,
  },
];

function getPaymentStatusMeta(status: PaymentMethodStatus) {
  if (status === "expired")
    return {
      label: "Expired",
      icon: "⚠",
      bg: "var(--danger-soft)",
      border: "rgba(251, 113, 133, 0.35)",
      color: "var(--danger)",
    };
  if (status === "expiring")
    return {
      label: "Expiring soon",
      icon: "⏰",
      bg: "var(--warning-soft)",
      border: "rgba(251, 191, 36, 0.35)",
      color: "var(--warning)",
    };
  return {
    label: "Active",
    icon: "✓",
    bg: "var(--success-soft)",
    border: "rgba(52, 211, 153, 0.35)",
    color: "var(--success)",
  };
}

function CardArt({ method }: { method: PaymentMethod }) {
  const meta = CARD_BRAND_META[method.brand];
  return (
    <div
      aria-hidden="true"
      style={{
        width: 64,
        height: 40,
        borderRadius: 8,
        background: meta.gradient,
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        padding: "0.35rem 0.5rem",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.08,
          fontSize: 14,
          lineHeight: "10px",
          letterSpacing: "2px",
          color: "#fff",
          padding: "6px 8px",
          fontFamily: "ui-monospace, monospace",
          wordBreak: "break-all",
        }}
      >
        {meta.pattern.repeat(40)}
      </div>
      <span
        style={{
          position: "relative",
          color: "#fff",
          fontSize: "0.68rem",
          fontWeight: 800,
          letterSpacing: "0.04em",
          textShadow: "0 1px 2px rgba(0,0,0,0.35)",
        }}
      >
        {meta.label}
      </span>
    </div>
  );
}

function PaymentMethodsPanel() {
  const [methods, setMethods] = useState<PaymentMethod[]>(MOCK_PAYMENT_METHODS);
  const [showAdd, setShowAdd] = useState(false);

  function setDefault(id: string) {
    setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })));
  }

  function removeMethod(id: string) {
    setMethods((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <section
      aria-labelledby="payment-methods-heading"
      style={{ display: "grid", gap: "1rem" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            id="payment-methods-heading"
            style={{ margin: 0, fontSize: "1.05rem" }}
          >
            Payment methods
          </h3>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            Add, remove, or update the cards charged for your subscription.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="app-button app-button-primary"
          style={{
            width: "auto",
            minHeight: "2.75rem",
            padding: "0.55rem 1rem",
            fontSize: "0.9rem",
          }}
        >
          + Add payment method
        </button>
      </div>

      <ul
        role="list"
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gap: "0.75rem",
        }}
      >
        {methods.map((method) => {
          const statusMeta = getPaymentStatusMeta(method.status);
          const expSoon =
            method.status === "expiring" || method.status === "expired";
          return (
            <li
              key={method.id}
              className={`payment-method-card${expSoon ? ` pm-${method.status}` : ""}`}
              style={{
                padding: "1rem 1.1rem",
                border: `1px solid ${expSoon ? statusMeta.border : "var(--border)"}`,
                borderRadius: "var(--radius-sm)",
                background: expSoon ? statusMeta.bg : "var(--surface)",
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: "1rem",
                alignItems: "center",
              }}
            >
              <CardArt method={method} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontWeight: 700 }}>
                    {CARD_BRAND_META[method.brand].label}
                  </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    •••• {method.last4}
                  </span>
                  {method.isDefault && (
                    <span
                      aria-label="Default payment method"
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        padding: "0.15rem 0.5rem",
                        borderRadius: 999,
                        background: "rgba(94, 234, 212, 0.14)",
                        border: "1px solid rgba(94, 234, 212, 0.35)",
                        color: "var(--accent)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      Default
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                    flexWrap: "wrap",
                    marginTop: "0.35rem",
                  }}
                >
                  <span style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
                    Expires {String(method.expMonth).padStart(2, "0")}/
                    {method.expYear}
                  </span>
                  {expSoon && (
                    <span
                      role={method.status === "expired" ? "alert" : "status"}
                      aria-label={statusMeta.label}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: statusMeta.color,
                      }}
                    >
                      <span aria-hidden="true">{statusMeta.icon}</span>
                      {statusMeta.label}
                      {method.status === "expiring" && (
                        <span style={{ fontWeight: 500 }}>
                          — update to avoid service interruption
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                {!method.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefault(method.id)}
                    aria-label={`Set ${CARD_BRAND_META[method.brand].label} ending ${method.last4} as default`}
                    style={{
                      ...pagerBtnStyle,
                      minHeight: "2.5rem",
                      padding: "0.45rem 0.9rem",
                    }}
                  >
                    Set default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeMethod(method.id)}
                  aria-label={`Remove ${CARD_BRAND_META[method.brand].label} ending ${method.last4}`}
                  disabled={method.isDefault}
                  style={{
                    ...pagerBtnStyle,
                    minHeight: "2.5rem",
                    padding: "0.45rem 0.9rem",
                    color: method.isDefault ? "var(--muted)" : "var(--danger)",
                    borderColor: method.isDefault
                      ? "var(--border)"
                      : "rgba(251, 113, 133, 0.35)",
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {showAdd && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-pm-title"
          style={{
            padding: "1rem 1.1rem",
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-soft)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              marginBottom: "0.75rem",
            }}
          >
            <h4 id="add-pm-title" style={{ margin: 0, fontSize: "0.98rem" }}>
              Add a new payment method
            </h4>
            <button
              type="button"
              aria-label="Cancel adding payment method"
              onClick={() => setShowAdd(false)}
              style={iconBtnStyle}
            >
              ✕
            </button>
          </div>
          <form
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
            onSubmit={(e) => {
              e.preventDefault();
              setShowAdd(false);
            }}
          >
            <div
              style={{ gridColumn: "1 / -1", display: "grid", gap: "0.35rem" }}
            >
              <label
                htmlFor="pm-number"
                style={{ fontSize: "0.88rem", fontWeight: 600 }}
              >
                Card number
              </label>
              <input
                id="pm-number"
                type="text"
                inputMode="numeric"
                placeholder="1234 5678 9012 3456"
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label
                htmlFor="pm-exp"
                style={{ fontSize: "0.88rem", fontWeight: 600 }}
              >
                Expiration
              </label>
              <input
                id="pm-exp"
                type="text"
                inputMode="numeric"
                placeholder="MM / YY"
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label
                htmlFor="pm-cvc"
                style={{ fontSize: "0.88rem", fontWeight: 600 }}
              >
                CVC
              </label>
              <input
                id="pm-cvc"
                type="text"
                inputMode="numeric"
                placeholder="123"
                style={inputStyle}
              />
            </div>
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                marginTop: "0.25rem",
              }}
            >
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                style={pagerBtnStyle}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="app-button app-button-primary"
                style={{
                  width: "auto",
                  minHeight: "2.5rem",
                  padding: "0.5rem 1.1rem",
                }}
              >
                Save card
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

// ─── Plan Comparison ─────────────────────────────────────────────────────────

type PlanId = "starter" | "growth" | "enterprise";

interface PlanFeature {
  label: string;
  values: Record<PlanId, string | boolean>;
}

interface PlanMeta {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  badge?: string;
  recommended?: boolean;
}

const PLANS: PlanMeta[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 29,
    annualPrice: 290,
    description: "For small teams getting started with attestations.",
  },
  {
    id: "growth",
    name: "Growth",
    monthlyPrice: 49,
    annualPrice: 490,
    description: "For growing businesses that need more capacity.",
    badge: "Current plan",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 99,
    annualPrice: 990,
    description: "For organizations with advanced compliance needs.",
    recommended: true,
  },
];

const PLAN_FEATURES: PlanFeature[] = [
  {
    label: "Attestations per month",
    values: { starter: "1,000", growth: "10,000", enterprise: "Unlimited" },
  },
  {
    label: "Team members",
    values: { starter: "3", growth: "10", enterprise: "Unlimited" },
  },
  {
    label: "API access",
    values: { starter: true, growth: true, enterprise: true },
  },
  {
    label: "Webhook integrations",
    values: { starter: "5", growth: "20", enterprise: "Unlimited" },
  },
  {
    label: "Audit log retention",
    values: { starter: "30 days", growth: "90 days", enterprise: "365 days" },
  },
  {
    label: "Custom branding",
    values: { starter: false, growth: true, enterprise: true },
  },
  {
    label: "Priority support",
    values: { starter: false, growth: "Email", enterprise: "24/7 Phone + Email" },
  },
  {
    label: "SSO / SAML",
    values: { starter: false, growth: false, enterprise: true },
  },
  {
    label: "Dedicated account manager",
    values: { starter: false, growth: false, enterprise: true },
  },
  {
    label: "SLA guarantee",
    values: { starter: "99.5%", growth: "99.9%", enterprise: "99.99%" },
  },
];

const CURRENT_PLAN_ID: PlanId = "growth";
const BILLING_CYCLE = "monthly";

function getPrice(plan: PlanMeta, cycle: string) {
  return cycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
}

function formatProratedImpact(from: PlanMeta, to: PlanMeta): {
  label: string;
  amount: string;
  isCredit: boolean;
} {
  const fromPrice = getPrice(from, BILLING_CYCLE);
  const toPrice = getPrice(to, BILLING_CYCLE);
  const diff = Math.abs(toPrice - fromPrice);
  const isCredit = toPrice < fromPrice;
  // Prorate for remaining ~15 days in a 30-day cycle
  const prorated = ((diff / 30) * 15).toFixed(2);
  return {
    label: isCredit
      ? `Prorated credit for remaining billing period`
      : `Prorated charge for remaining billing period`,
    amount: `$${prorated}`,
    isCredit,
  };
}

function PlanCard({
  plan,
  isCurrent,
  onSelect,
  selected,
}: {
  plan: PlanMeta;
  isCurrent: boolean;
  onSelect: (id: PlanId) => void;
  selected: PlanId | null;
}) {
  const price = getPrice(plan, BILLING_CYCLE);
  const isSelected = selected === plan.id;
  const isDowngrade =
    !isCurrent && plan.id !== CURRENT_PLAN_ID && plan.monthlyPrice < PLANS.find((p) => p.id === CURRENT_PLAN_ID)!.monthlyPrice;
  const isUpgrade =
    !isCurrent && plan.monthlyPrice > PLANS.find((p) => p.id === CURRENT_PLAN_ID)!.monthlyPrice;

  return (
    <div
      role="region"
      aria-label={`${plan.name} plan${plan.recommended ? " (recommended)" : ""}`}
      className={`plan-card${plan.recommended ? " plan-card-recommended" : ""}${isSelected ? " plan-card-selected" : ""}`}
      style={{
        display: "grid",
        gap: "1rem",
        padding: "1.25rem",
        borderRadius: "var(--radius-sm)",
        border: `2px solid ${
          plan.recommended
            ? "var(--accent)"
            : isCurrent
              ? "var(--border-strong)"
              : "var(--border)"
        }`,
        background:
          plan.recommended
            ? "rgba(94, 234, 212, 0.06)"
            : isCurrent
              ? "rgba(96, 165, 250, 0.06)"
              : "var(--surface)",
        position: "relative",
        transition: "border-color 150ms ease, box-shadow 150ms ease",
      }}
    >
      {/* Badges */}
      {plan.badge && (
        <span
          aria-label={`Current plan: ${plan.name}`}
          style={{
            position: "absolute",
            top: "-0.6rem",
            left: "1rem",
            padding: "0.2rem 0.7rem",
            borderRadius: 999,
            background: "var(--surface-strong)",
            border: "1px solid var(--border-strong)",
            color: "var(--accent)",
            fontWeight: 700,
            fontSize: "0.72rem",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {plan.badge}
        </span>
      )}
      {plan.recommended && !isCurrent && (
        <span
          aria-label="Recommended plan"
          style={{
            position: "absolute",
            top: "-0.6rem",
            right: "1rem",
            padding: "0.2rem 0.7rem",
            borderRadius: 999,
            background: "var(--accent)",
            color: "#04111f",
            fontWeight: 800,
            fontSize: "0.72rem",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Recommended
        </span>
      )}

      <div>
        <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{plan.name}</h3>
        <p
          style={{
            margin: "0.25rem 0 0",
            color: "var(--muted)",
            fontSize: "0.88rem",
            lineHeight: 1.4,
          }}
        >
          {plan.description}
        </p>
      </div>

      <div>
        <span
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            color: plan.recommended ? "var(--accent)" : "var(--text)",
          }}
        >
          ${price}
        </span>
        <span style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
          /month
        </span>
      </div>

      {/* Prorated impact when selected and different from current */}
      {isSelected && !isCurrent && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "0.6rem 0.8rem",
            borderRadius: 8,
            background: isUpgrade
              ? "rgba(251, 191, 36, 0.1)"
              : "rgba(52, 211, 153, 0.1)",
            border: `1px solid ${
              isUpgrade
                ? "rgba(251, 191, 36, 0.3)"
                : "rgba(52, 211, 153, 0.3)"
            }`,
            fontSize: "0.85rem",
            display: "grid",
            gap: "0.3rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
              {(() => {
                const impact = formatProratedImpact(
                  PLANS.find((p) => p.id === CURRENT_PLAN_ID)!,
                  plan,
                );
                return impact.label;
              })()}
            </span>
            <span
              style={{
                fontWeight: 700,
                color: isUpgrade ? "var(--warning)" : "var(--success)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {(() => {
                const impact = formatProratedImpact(
                  PLANS.find((p) => p.id === CURRENT_PLAN_ID)!,
                  plan,
                );
                return `${impact.isCredit ? "−" : "+"}${impact.amount}`;
              })()}
            </span>
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--muted)",
            }}
          >
            {isUpgrade
              ? `Upgrade charge prorated for remaining 15 days`
              : `Credit prorated for remaining 15 days`}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onSelect(plan.id)}
        disabled={isCurrent}
        aria-label={
          isCurrent
            ? `${plan.name} is your current plan`
            : isUpgrade
              ? `Upgrade to ${plan.name} plan`
              : isDowngrade
                ? `Downgrade to ${plan.name} plan`
                : `Switch to ${plan.name} plan`
        }
        style={{
          padding: "0.65rem 1rem",
          borderRadius: 8,
          background: isSelected
            ? "var(--accent)"
            : isCurrent
              ? "var(--surface-strong)"
              : "transparent",
          color:
            isSelected
              ? "#04111f"
              : isCurrent
                ? "var(--muted)"
                : "var(--text)",
          fontWeight: 700,
          fontSize: "0.9rem",
          cursor: isCurrent ? "default" : "pointer",
          border: isCurrent
            ? "1px solid var(--border)"
            : isSelected
              ? "none"
              : "1px solid var(--border)",
          transition: "all 150ms ease",
        }}
      >
        {isCurrent
          ? "Current plan"
          : isSelected
            ? "Selected"
            : isUpgrade
              ? "Upgrade"
              : isDowngrade
                ? "Downgrade"
                : "Switch"}
      </button>
    </div>
  );
}

function PlanComparisonTable({
  selectedPlan,
}: {
  selectedPlan: PlanId | null;
}) {
  const isComparing = selectedPlan != null && selectedPlan !== CURRENT_PLAN_ID;

  return (
    <section aria-labelledby="plan-comparison-heading">
      <h3
        id="plan-comparison-heading"
        style={{ margin: 0, fontSize: "1.05rem" }}
      >
        Plan comparison
      </h3>

      {/* Desktop table */}
      <div
        role="region"
        aria-label="Plan features comparison table"
        style={{ overflowX: "auto", marginTop: "1rem" }}
        className="plan-comparison-table-wrapper"
      >
        <table
          aria-label="Compare plan features across Starter, Growth, and Enterprise tiers"
          style={{
            width: "100%",
            minWidth: 640,
            borderCollapse: "separate",
            borderSpacing: 0,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          <thead>
            <tr style={{ background: "var(--surface-strong)" }}>
              <th scope="col" style={{ ...thStyle, width: "30%" }}>
                Feature
              </th>
              {PLANS.map((plan) => (
                <th
                  key={plan.id}
                  scope="col"
                  style={{
                    ...thStyle,
                    width: "23.33%",
                    color:
                      plan.id === CURRENT_PLAN_ID
                        ? "var(--accent)"
                        : plan.recommended
                          ? "var(--accent)"
                          : "var(--muted)",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>
                    {plan.name}
                  </div>
                  <div
                    style={{
                      fontWeight: 400,
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                      marginTop: "0.15rem",
                    }}
                  >
                    ${getPrice(plan, BILLING_CYCLE)}/mo
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_FEATURES.map((feature, idx) => (
              <tr
                key={feature.label}
                style={{
                  borderTop: "1px solid var(--border)",
                  background:
                    idx % 2 === 0 ? "transparent" : "var(--surface-soft)",
                }}
              >
                <th
                  scope="row"
                  style={{
                    ...tdStyle,
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    textAlign: "left",
                  }}
                >
                  {feature.label}
                </th>
                {PLANS.map((plan) => (
                  <td
                    key={plan.id}
                    style={{
                      ...tdStyle,
                      color:
                        plan.id === CURRENT_PLAN_ID
                          ? "var(--accent)"
                          : "var(--text)",
                      fontWeight:
                        plan.id === CURRENT_PLAN_ID ? 600 : 400,
                    }}
                  >
                    {typeof feature.values[plan.id] === "boolean" ? (
                      feature.values[plan.id] === true ? (
                        <span
                          aria-label={`${feature.label}: included in ${plan.name}`}
                          style={{ color: "var(--success)" }}
                        >
                          <svg
                            aria-hidden="true"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      ) : (
                        <span
                          aria-label={`${feature.label}: not included in ${plan.name}`}
                          style={{ color: "var(--muted)" }}
                        >
                          —
                        </span>
                      )
                    ) : (
                      <span style={{ fontSize: "0.92rem" }}>
                        {String(feature.values[plan.id])}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Responsive card layout (visible on narrow viewports via CSS) */}
      <div
        className="plan-comparison-cards"
        style={{
          display: "none",
          marginTop: "1rem",
          gap: "1rem",
        }}
      >
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            style={{
              padding: "1rem",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${
                plan.id === CURRENT_PLAN_ID
                  ? "var(--border-strong)"
                  : "var(--border)"
              }`,
              background: "var(--surface)",
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: "1rem",
                color:
                  plan.id === CURRENT_PLAN_ID
                    ? "var(--accent)"
                    : "var(--text)",
              }}
            >
              {plan.name}
              {plan.id === CURRENT_PLAN_ID && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                    marginLeft: "0.5rem",
                    textTransform: "uppercase",
                  }}
                >
                  (Current)
                </span>
              )}
            </h4>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                marginTop: "0.5rem",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ${getPrice(plan, BILLING_CYCLE)}
              <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--muted)" }}>
                /mo
              </span>
            </div>
            <ul
              role="list"
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0.75rem 0 0",
                display: "grid",
                gap: "0.5rem",
              }}
            >
              {PLAN_FEATURES.map((feature) => (
                <li
                  key={feature.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    fontSize: "0.85rem",
                    padding: "0.3rem 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>
                    {feature.label}
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {typeof feature.values[plan.id] === "boolean" ? (
                      feature.values[plan.id] === true ? (
                        <span style={{ color: "var(--success)" }}>✓</span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )
                    ) : (
                      String(feature.values[plan.id])
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlanComparison() {
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);

  return (
    <section
      aria-labelledby="plan-comparison-section-heading"
      style={{ display: "grid", gap: "1.5rem" }}
    >
      <div>
        <h3
          id="plan-comparison-section-heading"
          style={{ margin: 0, fontSize: "1.05rem" }}
        >
          Compare plans
        </h3>
        <p
          style={{
            margin: "0.25rem 0 0",
            color: "var(--muted)",
            fontSize: "0.9rem",
          }}
        >
          See what each plan offers and find the right fit for your team.
          Prorated charges or credits apply when switching mid-cycle.
        </p>
      </div>

      {/* Plan cards */}
      <div
        className="plan-cards-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={plan.id === CURRENT_PLAN_ID}
            onSelect={setSelectedPlan}
            selected={selectedPlan}
          />
        ))}
      </div>

      {/* Feature comparison table */}
      <PlanComparisonTable selectedPlan={selectedPlan} />

      {/* Action footer when a plan is selected */}
      {selectedPlan && selectedPlan !== CURRENT_PLAN_ID && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(94, 234, 212, 0.3)",
            background: "rgba(94, 234, 212, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "var(--accent)",
              }}
            >
              {(() => {
                const plan = PLANS.find((p) => p.id === selectedPlan)!;
                const isUpgrade =
                  plan.monthlyPrice >
                  PLANS.find((p) => p.id === CURRENT_PLAN_ID)!.monthlyPrice;
                return isUpgrade
                  ? `Ready to upgrade to ${plan.name}?`
                  : `Ready to downgrade to ${plan.name}?`;
              })()}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.2rem" }}>
              Changes will apply to your next billing cycle.{" "}
              {(() => {
                const plan = PLANS.find((p) => p.id === selectedPlan)!;
                const impact = formatProratedImpact(
                  PLANS.find((p) => p.id === CURRENT_PLAN_ID)!,
                  plan,
                );
                return `${impact.label}: ${impact.isCredit ? "−" : "+"}${impact.amount}`;
              })()}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setSelectedPlan(null)}
              style={{
                padding: "0.55rem 1rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="app-button app-button-primary"
              style={{
                width: "auto",
                minHeight: "2.75rem",
                padding: "0.55rem 1.25rem",
                fontSize: "0.9rem",
              }}
            >
              {(() => {
                const plan = PLANS.find((p) => p.id === selectedPlan)!;
                const isUpgrade =
                  plan.monthlyPrice >
                  PLANS.find((p) => p.id === CURRENT_PLAN_ID)!.monthlyPrice;
                return `Confirm ${isUpgrade ? "upgrade" : "downgrade"}`;
              })()}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function BillingPanel() {
  return (
    <div style={{ display: "grid", gap: "2rem" }}>
      <div>
        <h2>Billing</h2>
        <p style={{ color: "var(--muted)" }}>
          Manage your subscription plan, payment methods, and invoices.
        </p>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "max-content 1fr",
            gap: "0.5rem 1.5rem",
            maxWidth: 480,
            marginTop: "1.25rem",
          }}
        >
          <dt style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Plan</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>Growth</dd>
          <dt style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            Next billing date
          </dt>
          <dd style={{ margin: 0 }}>July 15, 2026</dd>
          <dt style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Amount</dt>
          <dd
            style={{
              margin: 0,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            $49.00 / month
          </dd>
        </dl>
      </div>

      <PlanComparison />

      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--border)",
          margin: 0,
          opacity: 0.5,
        }}
      />

      <PaymentMethodsPanel />

      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--border)",
          margin: 0,
          opacity: 0.5,
        }}
      />

      <InvoiceList />
    </div>
  );
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRecoveryCodes(): string[] {
  return Array.from({ length: 10 }, () => {
    const seg = () =>
      Array.from(
        { length: 4 },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
      ).join("");
    return `${seg()}-${seg()}-${seg()}`;
  });
}

interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

const MOCK_SESSIONS: ActiveSession[] = [
  {
    id: "s1",
    device: 'MacBook Pro 14"',
    browser: "Chrome 125",
    ip: "203.0.113.42",
    location: "Lagos, NG",
    lastActive: "Now",
    isCurrent: true,
  },
  {
    id: "s2",
    device: "iPhone 15 Pro",
    browser: "Safari 18",
    ip: "203.0.113.42",
    location: "Lagos, NG",
    lastActive: "2 hours ago",
    isCurrent: false,
  },
  {
    id: "s3",
    device: "Windows PC",
    browser: "Firefox 128",
    ip: "198.51.100.77",
    location: "Accra, GH",
    lastActive: "3 days ago",
    isCurrent: false,
  },
  {
    id: "s4",
    device: "Android Tablet",
    browser: "Chrome 124",
    ip: "192.0.2.150",
    location: "Nairobi, KE",
    lastActive: "2 weeks ago",
    isCurrent: false,
  },
];

function SessionRow({
  session,
  onRevoke,
}: {
  session: ActiveSession;
  onRevoke: (id: string) => void;
}) {
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = () => {
    setRevoking(true);
    setTimeout(() => {
      onRevoke(session.id);
      setRevoking(false);
    }, 400);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        borderRadius: 10,
        border: `1px solid ${session.isCurrent ? "var(--border-strong)" : "var(--border)"}`,
        background: session.isCurrent
          ? "rgba(94, 234, 212, 0.06)"
          : "transparent",
      }}
    >
      <div style={{ display: "grid", gap: "0.2rem", minWidth: 0 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          {session.device}
          {session.isCurrent ? (
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--accent)",
                border: "1px solid var(--border-strong)",
                borderRadius: 4,
                padding: "0.1rem 0.4rem",
              }}
            >
              Current
            </span>
          ) : null}
        </span>
        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
          {session.browser} · {session.ip} · {session.location}
        </span>
        <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
          Active {session.lastActive}
        </span>
      </div>
      {!session.isCurrent ? (
        <button
          type="button"
          onClick={handleRevoke}
          disabled={revoking}
          style={{
            padding: "0.35rem 0.75rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: revoking ? "var(--danger)" : "transparent",
            color: revoking ? "#fff" : "var(--danger)",
            fontWeight: 600,
            fontSize: "0.8rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {revoking ? "Revoking…" : "Revoke"}
        </button>
      ) : (
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          This device
        </span>
      )}
    </div>
  );
}

function SignOutAllButton() {
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (confirming) {
    return (
      <div
        style={{
          padding: "1rem",
          borderRadius: 12,
          border: "1px solid rgba(248, 113, 113, 0.3)",
          background: "rgba(248, 113, 113, 0.06)",
          display: "grid",
          gap: "0.75rem",
        }}
      >
        <p style={{ margin: 0, fontWeight: 700, color: "var(--danger)" }}>
          Sign out of all other sessions?
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--muted)",
            lineHeight: 1.5,
          }}
        >
          This will revoke all active sessions except your current device. You
          will need to sign back in on those devices.
        </p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => {
              setSigningOut(true);
              setTimeout(() => setConfirming(false), 800);
            }}
            disabled={signingOut}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 8,
              border: "none",
              background: signingOut ? "var(--muted)" : "var(--danger)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {signingOut ? "Signing out…" : "Yes, sign out"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={signingOut}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      style={{
        padding: "0.5rem 1rem",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--danger)",
        fontWeight: 700,
        fontSize: "0.85rem",
        cursor: "pointer",
      }}
    >
      Sign out of all other sessions
    </button>
  );
}

function SecurityPanel() {
  const registry = useDirtyRegistry();
  const [mfaMethod, setMfaMethod] = useState<MfaMethod | null>(null);
  const [sessions, setSessions] = useState(MOCK_SESSIONS);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const passwordPolicyId = useId();
  const confirmPasswordId = useId();

  const pwForm = useDirtyForm({
    storageKey: "veritasor_settings_security_draft",
    initialValues: {
      currentPassword: "",
      newPassword: "",
    },
    autoSave: false,
    persist: false,
    clearAfterSave: true,
    onSave: async (v) => {
      await new Promise((r) => setTimeout(r, 500));
      void v;
    },
  });
  const passwordPolicy = validatePassword(pwForm.values.newPassword);
  const passwordsMatch = pwForm.values.newPassword === confirmPassword;
  const showConfirmError = confirmTouched && !passwordsMatch;
  const canSubmitPassword =
    pwForm.isDirty &&
    passwordPolicy.valid &&
    passwordsMatch &&
    pwForm.saveStatus !== "saving";

  useEffect(() => {
    localStorage.removeItem("veritasor_settings_security_draft");
  }, []);

  useEffect(() => {
    registry.register("security", {
      isDirty: pwForm.isDirty,
      saveStatus: pwForm.saveStatus,
      lastSavedAt: pwForm.lastSavedAt,
      save: pwForm.save,
      reset: pwForm.reset,
    });
    return () => registry.unregister("security");
  }, [
    registry.register,
    registry.unregister,
    pwForm.isDirty,
    pwForm.saveStatus,
    pwForm.lastSavedAt,
    pwForm.save,
    pwForm.reset,
  ]);

  const handleRevoke = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  async function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConfirmTouched(true);
    if (!passwordPolicy.valid || !passwordsMatch) return;
    await pwForm.save();
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <DirtyStateBanner
        isDirty={pwForm.isDirty}
        saveStatus={pwForm.saveStatus}
        lastSavedAt={pwForm.lastSavedAt}
        onSave={pwForm.save}
        onDiscard={pwForm.reset}
        formLabel="Security"
      />
      <div>
        <h2>Security</h2>
        <p style={{ color: "var(--muted)" }}>
          Update your password and manage two-factor authentication.
        </p>
        <form
          style={{ display: "grid", gap: "1rem", maxWidth: 480 }}
          onSubmit={handlePwSubmit}
        >
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <label htmlFor="current-password" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={pwForm.values.currentPassword}
              onChange={(e) => pwForm.setField("currentPassword", e.target.value)}
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-strong)",
                color: "var(--text)",
                fontSize: "0.95rem",
              }}
            />
          </div>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <label htmlFor="new-password" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={pwForm.values.newPassword}
              onChange={(e) => pwForm.setField("newPassword", e.target.value)}
              aria-describedby={passwordPolicyId}
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-strong)",
                color: "var(--text)",
                fontSize: "0.95rem",
              }}
            />
          </div>
          <ul
            id={passwordPolicyId}
            style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--muted)", fontSize: "0.85rem" }}
            aria-label="Password requirements"
          >
            {passwordPolicy.failures.length > 0 ? (
              passwordPolicy.failures.map((failure) => (
                <li key={failure}>{failure}</li>
              ))
            ) : (
              <li>Password meets all requirements.</li>
            )}
          </ul>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <label htmlFor="confirm-new-password" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              Confirm new password
            </label>
            <input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setConfirmTouched(true);
              }}
              aria-describedby={confirmPasswordId}
              aria-invalid={showConfirmError ? "true" : undefined}
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-strong)",
                color: "var(--text)",
                fontSize: "0.95rem",
              }}
            />
            {showConfirmError ? (
              <span id={confirmPasswordId} role="alert" style={{ color: "var(--danger)", fontSize: "0.85rem" }}>
                Passwords do not match.
              </span>
            ) : (
              <span id={confirmPasswordId} style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                Confirm your new password.
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!canSubmitPassword}
            aria-busy={pwForm.saveStatus === "saving"}
            style={{
              alignSelf: "start",
              padding: "0.6rem 1.25rem",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "#04111f",
              fontWeight: 700,
              cursor: canSubmitPassword ? "pointer" : "default",
              fontSize: "0.95rem",
              opacity: canSubmitPassword ? 1 : 0.6,
              minHeight: "2.75rem",
            }}
          >
            {pwForm.saveStatus === "saving" ? "Saving…" : "Update password"}
          </button>
        </form>

      <hr style={{ margin: 0, borderColor: "var(--border)", opacity: 0.5 }} />

      <MfaMethodChooser value={mfaMethod} onChange={setMfaMethod} />

      {/* Active sessions */}
      <hr style={{ margin: 0, borderColor: "var(--border)", opacity: 0.5 }} />
      <section aria-labelledby="active-sessions-title">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3
              id="active-sessions-title"
              style={{ margin: 0, fontSize: "1.05rem" }}
            >
              Active sessions
            </h3>
            <p
              style={{
                margin: "0.15rem 0 0",
                color: "var(--muted)",
                fontSize: "0.85rem",
              }}
            >
              {sessions.length} active session{sessions.length !== 1 ? "s" : ""}
            </p>
          </div>
          {sessions.filter((s) => !s.isCurrent).length > 0 ? (
            <SignOutAllButton />
          ) : null}
        </div>
        <div style={{ display: "grid", gap: "0.5rem", maxWidth: 600 }}>
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              onRevoke={handleRevoke}
            />
          ))}
        </div>
        {sessions.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            No active sessions found.
          </p>
        ) : null}
      </section>
    </div>
    </div>
  );
}

function WebhooksPanel() {
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const mockDeliveries: WebhookDelivery[] = [
    {
      id: "wh_001",
      event: "attestation.completed",
      triggeredAt: "2026-07-28T09:30:00Z",
      status: "failed",
      attempts: [
        {
          attempt: 1,
          at: "2026-07-28T09:30:00Z",
          statusCode: null,
          error: "Connection refused",
          backoffSeconds: 60,
        },
        {
          attempt: 2,
          at: "2026-07-28T09:31:00Z",
          statusCode: 503,
          error: "Service Unavailable",
          backoffSeconds: 120,
        },
        {
          attempt: 3,
          at: "2026-07-28T09:33:00Z",
          statusCode: 500,
          error: "Internal Server Error",
        },
      ],
    },
    {
      id: "wh_002",
      event: "source.connected",
      triggeredAt: "2026-07-28T08:00:00Z",
      status: "retrying",
      attempts: [
        {
          attempt: 1,
          at: "2026-07-28T08:00:00Z",
          statusCode: 503,
          backoffSeconds: 60,
        },
        {
          attempt: 2,
          at: "2026-07-28T08:01:00Z",
          statusCode: 503,
          backoffSeconds: 180,
        },
      ],
    },
    {
      id: "wh_003",
      event: "attestation.failed",
      triggeredAt: "2026-07-27T18:45:00Z",
      status: "delivered",
      attempts: [
        {
          attempt: 1,
          at: "2026-07-27T18:45:00Z",
          statusCode: 503,
          backoffSeconds: 60,
        },
        {
          attempt: 2,
          at: "2026-07-27T18:46:00Z",
          statusCode: 200,
        },
      ],
    },
  ];

  function handleRetry(id: string) {
    setRetryingId(id);
    setTimeout(() => {
      setRetryingId(null);
      // Real app: trigger retry via API
    }, 2000);
  }

  return (
    <div>
      <h2>Webhooks</h2>
      <p style={{ color: "var(--muted)" }}>
        View webhook delivery history and retry failed attempts. Each delivery
        shows its backoff intervals and final status.
      </p>
      <div
        style={{
          marginTop: "1.5rem",
          maxWidth: 900,
          display: "grid",
          gap: "1rem",
        }}
      >
        {mockDeliveries.map((delivery) => (
          <WebhookRetryPanel
            key={delivery.id}
            delivery={delivery}
            onRetry={handleRetry}
            isRetrying={retryingId === delivery.id}
          />
        ))}
      </div>
    </div>
  );
}

function TokensPanel() {
  return (
    <div>
      <h2>Design tokens</h2>
      <p style={{ color: "var(--muted)" }}>
        Review theme changes, then export a snapshot of Veritasor design tokens as CSS custom properties.
      </p>
      <div style={{ marginTop: "1.5rem", maxWidth: 1100, display: "grid", gap: "1.5rem" }}>
        <TokensDiffViewer />
        <TokensExport />
      </div>
    </div>
  );
}

const MOCK_AUDIT_ENTRIES: AuditLogEntry[] = [
  {
    id: "1",
    timestamp: "2026-07-28T08:12:00Z",
    event: "Attestation completed",
    details: "Merkle root: 0x7f...3a",
  },
  {
    id: "2",
    timestamp: "2026-07-28T08:14:00Z",
    event: "Attestation completed",
    details: "Merkle root: 0x7f...3a",
  },
  {
    id: "3",
    timestamp: "2026-07-28T08:15:00Z",
    event: "Attestation completed",
    details: "Merkle root: 0x7f...3a",
  },
  {
    id: "4",
    timestamp: "2026-07-28T09:00:00Z",
    event: "Revenue source connected",
    details: "Provider: Stripe",
  },
  {
    id: "5",
    timestamp: "2026-07-27T14:30:00Z",
    event: "Attestation failed",
    details: "Timeout after 30s",
  },
  {
    id: "6",
    timestamp: "2026-07-27T14:31:00Z",
    event: "Attestation failed",
    details: "Timeout after 30s",
  },
  {
    id: "7",
    timestamp: "2026-07-27T14:32:00Z",
    event: "Attestation failed",
    details: "Timeout after 30s",
  },
  {
    id: "8",
    timestamp: "2026-07-27T14:33:00Z",
    event: "Attestation failed",
    details: "Timeout after 30s",
  },
  {
    id: "9",
    timestamp: "2026-07-26T10:00:00Z",
    event: "API key rotated",
  },
];

// Simulated detail data for each audit log entry.
// In production this would be fetched from the API by entry id.
const MOCK_AUDIT_DETAILS: Record<string, Partial<AuditLogEntryDetail>> = {
  "1": {
    actor: "joel@example.com",
    ip: "203.0.113.42",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    method: "POST",
    path: "/api/v1/attestations",
    statusCode: 200,
    requestHeaders: {
      "content-type": "application/json",
      "authorization": "Bearer vrt_live_••••3f9a",
      "x-request-id": "req_01j8abc123xyz",
    },
    requestPayload: {
      source: "stripe",
      period: "2026-06",
      recordCount: 1247,
    },
    responsePayload: {
      id: "att_01j8xyz",
      merkleRoot: "0x7f3a2c9b1d8e4f06a5c2b7e3d1f09a4c",
      status: "completed",
      timestamp: "2026-07-28T08:12:00Z",
      event: "Attestation completed",
      details: "Merkle root: 0x7f...3a",
      severity: "info",
    },
  },
  "2": {
    id: "2",
    timestamp: "2026-07-28T08:14:00Z",
    event: "Attestation completed",
    details: "Merkle root: 0x7f...3a",
    severity: "info",
  },
  "3": {
    id: "3",
    timestamp: "2026-07-28T08:15:00Z",
    event: "Attestation completed",
    details: "Merkle root: 0x7f...3a",
    severity: "info",
  },
  "4": {
    id: "4",
    timestamp: "2026-07-28T09:00:00Z",
    event: "Revenue source connected",
    details: "Provider: Stripe",
    severity: "info",
  },
  "5": {
    id: "5",
    timestamp: "2026-07-27T14:30:00Z",
    event: "Attestation failed",
    details: "Timeout after 30s",
    severity: "error",
  },
  "6": {
    id: "6",
    timestamp: "2026-07-27T14:31:00Z",
    event: "Attestation failed",
    details: "Timeout after 30s",
    severity: "error",
  },
  "7": {
    id: "7",
    timestamp: "2026-07-27T14:32:00Z",
    event: "Attestation failed",
    details: "Timeout after 30s",
    severity: "error",
  },
  "8": {
    id: "8",
    timestamp: "2026-07-27T14:33:00Z",
    event: "Attestation failed",
    details: "Timeout after 30s",
    severity: "error",
  },
  "9": {
    id: "9",
    timestamp: "2026-07-26T10:00:00Z",
    event: "API key rotated",
    severity: "warn",
  },
};

function AuditLogPanel() {
  const intl = { formatMessage: ({ defaultMessage }: { defaultMessage: string }) => defaultMessage };
  const handleFetchDetail = useCallback(async (id: string) => {
    // TODO: Replace with actual API call
    return MOCK_AUDIT_DETAILS[id] ?? { id };
  }, []);
  return (
    <div>
      <h2>{intl.formatMessage({ id: 'auditLog.filters.title', defaultMessage: 'Audit Log' })}</h2>
      <p style={{ color: "var(--muted)" }}>
        Recent activity for this workspace. Click any event to view full
        request/response detail. In compact density mode, identical consecutive
        events are grouped by day and collapsed into summary badges.
      </p>
      <div style={{ marginTop: "1.5rem", maxWidth: 800 }}>
        <AuditLogTimeline
          entries={MOCK_AUDIT_ENTRIES}
          onFetchDetail={handleFetchDetail}
        />
      </div>
    </div>
  );
}

type TeamRole = "owner" | "admin" | "billing" | "member";
type MemberStatus = "active" | "pending" | "disabled";
type InviteStatus = "pending" | "expired";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: MemberStatus;
  joinedAt: string;
  avatarInitials: string;
  extraPermissions?: string[];
}

interface PendingInvitation {
  id: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: InviteStatus;
}

const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  billing: "Billing",
  member: "Member",
};

const TEAM_ROLE_META: Record<
  TeamRole,
  { bg: string; border: string; color: string }
> = {
  owner: {
    bg: "rgba(139, 92, 246, 0.14)",
    border: "rgba(139, 92, 246, 0.35)",
    color: "#a78bfa",
  },
  admin: {
    bg: "rgba(96, 165, 250, 0.14)",
    border: "rgba(96, 165, 250, 0.35)",
    color: "#60a5fa",
  },
  billing: {
    bg: "rgba(251, 191, 36, 0.14)",
    border: "rgba(251, 191, 36, 0.35)",
    color: "var(--warning)",
  },
  member: {
    bg: "var(--surface-soft)",
    border: "var(--border)",
    color: "var(--muted)",
  },
};

const MEMBER_STATUS_META: Record<MemberStatus, { label: string; dot: string }> =
  {
    active: { label: "Active", dot: "var(--success)" },
    pending: { label: "Pending", dot: "var(--warning)" },
    disabled: { label: "Disabled", dot: "var(--muted)" },
  };

const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  owner: ["*"],
  admin: [
    "team.manage",
    "billing.manage",
    "sources.read",
    "sources.write",
    "attestations.read",
    "attestations.write",
    "settings.read",
    "settings.write",
    "api_keys.manage",
  ],
  billing: [
    "billing.manage",
    "billing.read",
    "invoices.read",
    "payment_methods.manage",
  ],
  member: ["sources.read", "attestations.read", "settings.read"],
};

const PERMISSION_LABELS: Record<string, string> = {
  "*": "Full access",
  "team.manage": "Manage team members",
  "billing.manage": "Manage billing",
  "billing.read": "View billing",
  "sources.read": "View revenue sources",
  "sources.write": "Edit revenue sources",
  "attestations.read": "View attestations",
  "attestations.write": "Create attestations",
  "settings.read": "View settings",
  "settings.write": "Edit settings",
  "api_keys.manage": "Manage API keys",
  "invoices.read": "View invoices",
  "payment_methods.manage": "Manage payment methods",
};

function getRoleConflicts(
  currentRole: TeamRole,
  targetRole: TeamRole,
  extraPermissions: string[] = [],
): {
  redundant: string[];
  supersededBy: string;
  resolutionPaths: { label: string; action: string }[];
} | null {
  const currentPerms = new Set(ROLE_PERMISSIONS[currentRole]);
  const targetPerms = new Set(ROLE_PERMISSIONS[targetRole]);
  const extraPerms = new Set(extraPermissions);

  if (currentPerms.has("*")) return null;
  if (targetPerms.has("*")) {
    if (
      currentRole !== "owner" &&
      (currentPerms.size > 0 || extraPerms.size > 0)
    ) {
      return {
        redundant: Array.from(new Set([...currentPerms, ...extraPerms])).filter(
          (p) => p !== "*",
        ),
        supersededBy: "Owner",
        resolutionPaths: [
          {
            label: `Keep as Owner (supersedes ${TEAM_ROLE_LABELS[currentRole]})`,
            action: "accept",
          },
          {
            label: `Revert to ${TEAM_ROLE_LABELS[currentRole]}`,
            action: "revert",
          },
        ],
      };
    }
    return null;
  }

  if (targetRole === "admin" && currentRole === "billing") {
    return {
      redundant: [
        "billing.manage",
        "billing.read",
        "invoices.read",
        "payment_methods.manage",
      ],
      supersededBy: "Admin",
      resolutionPaths: [
        { label: "Promote to Admin (keeps billing access)", action: "accept" },
        { label: "Keep as Billing only", action: "revert" },
        {
          label: "Promote & remove explicit billing grant",
          action: "strip_extras",
        },
      ],
    };
  }

  if (targetRole === "billing" && currentRole === "admin") {
    return {
      redundant: [
        "team.manage",
        "sources.write",
        "attestations.write",
        "settings.write",
        "api_keys.manage",
      ],
      supersededBy: "Billing role downgrade",
      resolutionPaths: [
        {
          label: "Downgrade to Billing (removes admin privileges)",
          action: "accept",
        },
        { label: "Keep as Admin", action: "revert" },
      ],
    };
  }

  if (targetRole === "member") {
    const extras = Array.from(extraPerms);
    const roleOverlap = Array.from(currentPerms).filter(
      (p) => !targetPerms.has(p),
    );
    if (extras.length > 0 || roleOverlap.length > 0) {
      return {
        redundant: [
          ...extras,
          ...roleOverlap.filter((p) => !targetPerms.has(p)),
        ],
        supersededBy: "Member role",
        resolutionPaths: [
          {
            label: "Demote to Member (strips extra permissions)",
            action: "accept",
          },
          {
            label: `Keep as ${TEAM_ROLE_LABELS[currentRole]}`,
            action: "revert",
          },
          {
            label: "Demote but preserve extra permissions",
            action: "keep_extras",
          },
        ],
      };
    }
  }

  return null;
}

const MOCK_TEAM: TeamMember[] = [
  {
    id: "u_001",
    name: "Joel Agboola",
    email: "joel@example.com",
    role: "owner",
    status: "active",
    joinedAt: "2025-09-12",
    avatarInitials: "JA",
  },
  {
    id: "u_002",
    name: "Sarah Chen",
    email: "sarah@example.com",
    role: "admin",
    status: "active",
    joinedAt: "2025-10-01",
    avatarInitials: "SC",
  },
  {
    id: "u_003",
    name: "Marcus Johnson",
    email: "marcus@example.com",
    role: "billing",
    status: "active",
    joinedAt: "2025-11-20",
    avatarInitials: "MJ",
    extraPermissions: ["team.manage"],
  },
  {
    id: "u_004",
    name: "Priya Patel",
    email: "priya@example.com",
    role: "member",
    status: "pending",
    joinedAt: "2026-07-25",
    avatarInitials: "PP",
  },
  {
    id: "u_005",
    name: "Tomás Rivera",
    email: "tomas@example.com",
    role: "member",
    status: "active",
    joinedAt: "2026-01-08",
    avatarInitials: "TR",
    extraPermissions: ["attestations.write", "sources.write"],
  },
  {
    id: "u_006",
    name: "Hannah Schmidt",
    email: "hannah@example.com",
    role: "member",
    status: "disabled",
    joinedAt: "2025-12-03",
    avatarInitials: "HS",
  },
  {
    id: "u_007",
    name: "David Okonkwo",
    email: "david@example.com",
    role: "member",
    status: "active",
    joinedAt: "2026-03-14",
    avatarInitials: "DO",
  },
];

const now = Date.now();
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const MOCK_INVITATIONS: PendingInvitation[] = [
  {
    id: "inv_001",
    email: "alex.wong@example.com",
    role: "admin",
    invitedBy: "Joel Agboola",
    invitedAt: new Date(now - 2 * DAY).toISOString(),
    expiresAt: new Date(now + 5 * DAY).toISOString(),
    status: "pending",
  },
  {
    id: "inv_002",
    email: "emma.davis@example.com",
    role: "member",
    invitedBy: "Sarah Chen",
    invitedAt: new Date(now - 18 * HOUR).toISOString(),
    expiresAt: new Date(now + 2 * DAY).toISOString(),
    status: "pending",
  },
  {
    id: "inv_003",
    email: "james.liu@example.com",
    role: "billing",
    invitedBy: "Joel Agboola",
    invitedAt: new Date(now - 6 * DAY).toISOString(),
    expiresAt: new Date(now + 18 * HOUR).toISOString(),
    status: "pending",
  },
  {
    id: "inv_004",
    email: "sofia.rossi@example.com",
    role: "member",
    invitedBy: "Marcus Johnson",
    invitedAt: new Date(now - 10 * DAY).toISOString(),
    expiresAt: new Date(now - 2 * HOUR).toISOString(),
    status: "expired",
  },
  {
    id: "inv_005",
    email: "daniel.kim@example.com",
    role: "member",
    invitedBy: "Sarah Chen",
    invitedAt: new Date(now - 14 * DAY).toISOString(),
    expiresAt: new Date(now - 5 * DAY).toISOString(),
    status: "expired",
  },
];

interface PendingBulkAction {
  type: "role" | "resend" | "remove";
  count: number;
  targetRole?: TeamRole;
  snapshot: TeamMember[];
  message: string;
}

function RoleChip({ role }: { role: TeamRole }) {
  const meta = TEAM_ROLE_META[role];
  return (
    <span
      aria-label={`Role: ${TEAM_ROLE_LABELS[role]}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.22rem 0.6rem",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: "0.78rem",
        letterSpacing: "0.02em",
        border: `1px solid ${meta.border}`,
        background: meta.bg,
        color: meta.color,
        whiteSpace: "nowrap",
      }}
    >
      {TEAM_ROLE_LABELS[role]}
    </span>
  );
}

function MemberAvatar({ initials }: { initials: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "linear-gradient(135deg, var(--accent), #60a5fa)",
        color: "#04111f",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: "0.82rem",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function PermissionConflictWarning({
  conflict,
  memberName,
  onResolve,
  onDismiss,
  conflictId,
}: {
  conflict: NonNullable<ReturnType<typeof getRoleConflicts>>;
  memberName: string;
  onResolve: (action: string) => void;
  onDismiss: () => void;
  conflictId: string;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      id={conflictId}
      style={{
        marginTop: "0.75rem",
        padding: "0.9rem 1rem",
        borderRadius: "var(--radius-sm)",
        background: "var(--warning-soft)",
        border: `1px solid rgba(251, 191, 36, 0.4)`,
        display: "grid",
        gap: "0.75rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
        <span
          aria-hidden="true"
          style={{
            fontSize: "1.1rem",
            flexShrink: 0,
            marginTop: "0.05rem",
            color: "var(--warning)",
          }}
        >
          ⚠
        </span>
        <div style={{ display: "grid", gap: "0.35rem", minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.92rem",
              color: "var(--text)",
            }}
          >
            Permission conflict detected for {memberName}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "0.88rem",
              color: "var(--muted)",
              lineHeight: 1.55,
            }}
          >
            {conflict.supersededBy} supersedes or overlaps with existing grants.
            The following permissions become redundant or change scope:
          </p>
          <ul
            style={{
              margin: "0.15rem 0 0",
              paddingLeft: "1.1rem",
              display: "grid",
              gap: "0.2rem",
            }}
            aria-label="Redundant permissions"
          >
            {conflict.redundant.slice(0, 5).map((p) => (
              <li
                key={p}
                style={{
                  fontSize: "0.82rem",
                  color: "var(--muted)",
                  listStyle: '"▸ "',
                }}
              >
                <span
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: "0.78rem",
                    color: "var(--warning)",
                    marginRight: "0.3rem",
                  }}
                >
                  {p}
                </span>
                {PERMISSION_LABELS[p] ?? p}
              </li>
            ))}
            {conflict.redundant.length > 5 && (
              <li
                style={{
                  fontSize: "0.82rem",
                  color: "var(--muted)",
                  listStyle: "none",
                  paddingLeft: 0,
                }}
              >
                <em>and {conflict.redundant.length - 5} more…</em>
              </li>
            )}
          </ul>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss permission conflict warning"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--muted)",
            cursor: "pointer",
            padding: "0.2rem",
            borderRadius: 6,
            fontSize: "0.95rem",
            flexShrink: 0,
            minWidth: "1.75rem",
            minHeight: "1.75rem",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>
      </div>
      <div
        role="radiogroup"
        aria-label="Resolve permission conflict"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginLeft: "1.7rem",
        }}
      >
        {conflict.resolutionPaths.map((path, i) => (
          <button
            key={path.action}
            type="button"
            role="radio"
            aria-checked={false}
            onClick={() => onResolve(path.action)}
            style={{
              minHeight: "2.5rem",
              padding: "0.45rem 0.9rem",
              borderRadius: 8,
              border:
                i === 0
                  ? "1px solid transparent"
                  : "1px solid rgba(251, 191, 36, 0.35)",
              background:
                i === 0
                  ? "linear-gradient(135deg, var(--accent), #60a5fa)"
                  : "rgba(251, 191, 36, 0.08)",
              color: i === 0 ? "#04111f" : "var(--text)",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "transform 120ms ease, box-shadow 120ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "none";
            }}
          >
            {path.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatExpiryCountdown(
  expiresAt: string,
  nowTs: number,
): {
  label: string;
  urgent: boolean;
  expired: boolean;
  icon: string;
} {
  const diff = new Date(expiresAt).getTime() - nowTs;
  if (diff <= 0) {
    const daysAgo = Math.floor(Math.abs(diff) / DAY);
    const hoursAgo = Math.floor(Math.abs(diff) / HOUR);
    return {
      label:
        daysAgo > 0
          ? `Expired ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`
          : hoursAgo > 0
            ? `Expired ${hoursAgo} hr${hoursAgo === 1 ? "" : "s"} ago`
            : "Expired moments ago",
      urgent: false,
      expired: true,
      icon: "⏱",
    };
  }
  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  if (diff < 24 * HOUR) {
    return {
      label: `Expires in ${hours} hr${hours === 1 ? "" : "s"}`,
      urgent: true,
      expired: false,
      icon: "⏰",
    };
  }
  return {
    label: `Expires in ${days} day${days === 1 ? "" : "s"} ${hours} hr${hours === 1 ? "" : "s"}`,
    urgent: diff < 3 * DAY,
    expired: false,
    icon: "⏳",
  };
}

function PendingInvitationsTable() {
  const [invitations, setInvitations] =
    useState<PendingInvitation[]>(MOCK_INVITATIONS);
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const visibleInvitations = useMemo(
    () =>
      invitations.filter((inv) =>
        expiredOnly ? inv.status === "expired" : true,
      ),
    [invitations, expiredOnly],
  );

  const pendingCount = invitations.filter((i) => i.status === "pending").length;
  const expiredCount = invitations.filter((i) => i.status === "expired").length;

  function handleResend(id: string) {
    setResendingId(id);
    setTimeout(() => {
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === id
            ? {
                ...inv,
                status: "pending",
                invitedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * DAY).toISOString(),
              }
            : inv,
        ),
      );
      setResendingId(null);
    }, 1200);
  }

  function handleRevoke(id: string) {
    setRevokingId(id);
    setTimeout(() => {
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      setRevokingId(null);
    }, 800);
  }

  return (
    <section
      aria-labelledby="pending-invites-heading"
      style={{ display: "grid", gap: "1rem" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            id="pending-invites-heading"
            style={{ margin: 0, fontSize: "1.05rem" }}
          >
            Pending invitations
          </h3>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            Outstanding workspace invitations. Expired invites can be resent.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div
            aria-live="polite"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.82rem",
              color: "var(--muted)",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "1.5rem",
                height: "1.5rem",
                padding: "0 0.45rem",
                borderRadius: 999,
                background: "rgba(251, 191, 36, 0.14)",
                color: "var(--warning)",
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {pendingCount}
            </span>
            pending
            <span style={{ opacity: 0.4 }}>·</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "1.5rem",
                height: "1.5rem",
                padding: "0 0.45rem",
                borderRadius: 999,
                background: "var(--danger-soft)",
                color: "var(--danger)",
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {expiredCount}
            </span>
            expired
          </div>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.45rem 0.8rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-strong)",
              minHeight: "2.5rem",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: expiredOnly ? "var(--danger)" : "var(--text)",
            }}
          >
            <input
              type="checkbox"
              checked={expiredOnly}
              onChange={(e) => setExpiredOnly(e.target.checked)}
              aria-label="Filter to show expired invitations only"
              style={{ width: 16, height: 16 }}
            />
            <span aria-hidden="true">◷</span>
            Expired only
          </label>
        </div>
      </div>

      <div
        role="region"
        aria-label="Pending invitations table"
        style={{ overflowX: "auto" }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 640,
            borderCollapse: "separate",
            borderSpacing: 0,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          <thead>
            <tr style={{ background: "var(--surface-strong)" }}>
              <th scope="col" style={thStyle}>
                Recipient
              </th>
              <th scope="col" style={thStyle}>
                Role
              </th>
              <th scope="col" style={thStyle}>
                Invited by
              </th>
              <th scope="col" style={thStyle}>
                Expiry
              </th>
              <th scope="col" style={{ ...thStyle, textAlign: "right" }}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleInvitations.length === 0 ? (
              <tr style={{ borderTop: "1px solid var(--border)" }}>
                <td
                  colSpan={5}
                  style={{
                    ...tdStyle,
                    padding: "2rem 1.1rem",
                    textAlign: "center",
                    color: "var(--muted)",
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{ fontSize: "1.75rem", marginBottom: "0.4rem" }}
                  >
                    📭
                  </div>
                  {expiredOnly
                    ? "No expired invitations."
                    : "No pending invitations."}
                </td>
              </tr>
            ) : (
              visibleInvitations.map((inv) => {
                const countdown = formatExpiryCountdown(inv.expiresAt, nowTs);
                const isExpired = inv.status === "expired";
                return (
                  <tr
                    key={inv.id}
                    aria-label={isExpired ? `Expired invitation for ${inv.email}` : `Pending invitation for ${inv.email}`}
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: isExpired
                        ? "repeating-linear-gradient(\n                              45deg,\n                              transparent,\n                              transparent 10px,\n                              rgba(251, 113, 133, 0.04) 10px,\n                              rgba(251, 113, 133, 0.04) 20px\n                            )"
                        : undefined,
                      opacity: isExpired ? 0.88 : 1,
                      outline: isExpired ? "1px dashed rgba(251, 113, 133, 0.25)" : undefined,
                      outlineOffset: isExpired ? "-1px" : undefined,
                    }}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: "0.15rem" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{inv.email}</span>
                          {isExpired && (
                            <span
                              aria-label="This invitation has expired"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                padding: "0.12rem 0.5rem",
                                borderRadius: 999,
                                fontSize: "0.7rem",
                                fontWeight: 800,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                background: "var(--danger-soft)",
                                border: "1px solid rgba(251, 113, 133, 0.35)",
                                color: "var(--danger)",
                              }}
                            >
                              {/* Strikethrough icon provides a non-colour cue */}
                              <span aria-hidden="true">⊘</span>
                              Expired
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            color: "var(--muted)",
                            fontSize: "0.82rem",
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, monospace",
                          }}
                        >
                          {inv.id}
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <RoleChip role={inv.role} />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: "0.1rem" }}>
                        <div style={{ fontSize: "0.92rem" }}>
                          {inv.invitedBy}
                        </div>
                        <div
                          style={{
                            color: "var(--muted)",
                            fontSize: "0.82rem",
                          }}
                        >
                          {new Date(inv.invitedAt).toLocaleDateString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                            },
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span
                        role="status"
                        aria-label={`Invitation status: ${isExpired ? "Expired" : countdown.label}`}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.45rem",
                          fontSize: "0.88rem",
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            marginTop: "0.05rem",
                            fontSize: "0.95rem",
                            flexShrink: 0,
                            color: isExpired
                              ? "var(--danger)"
                              : countdown.urgent
                                ? "var(--warning)"
                                : "var(--muted)",
                          }}
                        >
                          {isExpired ? "⏱" : countdown.icon}
                        </span>
                        <span
                          style={{
                            color: isExpired
                              ? "var(--danger)"
                              : countdown.urgent
                                ? "var(--warning)"
                                : "var(--text)",
                            fontWeight:
                              isExpired || countdown.urgent ? 700 : 500,
                          }}
                        >
                          {isExpired ? countdown.label : countdown.label}
                        </span>
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          gap: "0.4rem",
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleResend(inv.id)}
                          disabled={resendingId === inv.id}
                          aria-label={`Resend invitation to ${inv.email}`}
                          aria-busy={resendingId === inv.id}
                          style={{
                            ...iconBtnStyle,
                            minHeight: "2.25rem",
                            padding: "0.3rem 0.7rem",
                            fontSize: "0.82rem",
                            background: isExpired
                              ? "rgba(251, 191, 36, 0.12)"
                              : undefined,
                            borderColor: isExpired
                              ? "rgba(251, 191, 36, 0.35)"
                              : undefined,
                            color: isExpired ? "var(--warning)" : undefined,
                          }}
                        >
                          <span aria-hidden="true">↻</span>
                          {resendingId === inv.id ? "Sending…" : "Resend"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevoke(inv.id)}
                          disabled={revokingId === inv.id}
                          aria-label={`Revoke invitation to ${inv.email}`}
                          aria-busy={revokingId === inv.id}
                          style={{
                            ...iconBtnStyle,
                            minHeight: "2.25rem",
                            padding: "0.3rem 0.7rem",
                            fontSize: "0.82rem",
                            color: "var(--danger)",
                            borderColor: "rgba(251, 113, 133, 0.3)",
                          }}
                        >
                          <span aria-hidden="true">✕</span>
                          {revokingId === inv.id ? "Revoking…" : "Revoke"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BulkActionToolbar({
  selectedCount,
  onClear,
  onChangeRole,
  onResendInvites,
  onRemove,
}: {
  selectedCount: number;
  onClear: () => void;
  onChangeRole: (role: TeamRole) => void;
  onResendInvites: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      role="region"
      aria-label={`Bulk actions for ${selectedCount} selected member${selectedCount === 1 ? "" : "s"}`}
      aria-live="polite"
      className="bulk-action-toolbar"
      style={{
        position: "sticky",
        top: "3.5rem",
        zIndex: 50,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: "1rem",
        padding: "0.85rem 1.1rem",
        marginBottom: "1rem",
        borderRadius: "var(--radius-sm)",
        background:
          "linear-gradient(135deg, rgba(94, 234, 212, 0.12), rgba(96, 165, 250, 0.12))",
        border: "1px solid rgba(94, 234, 212, 0.3)",
        boxShadow: "0 8px 24px rgba(2, 6, 23, 0.35)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "2rem",
            height: "2rem",
            padding: "0 0.6rem",
            borderRadius: 999,
            background: "var(--accent)",
            color: "#04111f",
            fontWeight: 800,
            fontSize: "0.85rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {selectedCount}
        </span>
        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
          {selectedCount} {selectedCount === 1 ? "member" : "members"} selected
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <label htmlFor="bulk-role" className="sr-only">
          Change role
        </label>
        <select
          id="bulk-role"
          aria-label="Change role for selected members"
          onChange={(e) => onChangeRole(e.target.value as TeamRole)}
          defaultValue=""
          style={{
            ...pagerBtnStyle,
            minHeight: "2.75rem",
            paddingRight: "2rem",
            appearance: "auto",
          }}
        >
          <option value="" disabled>
            Change role…
          </option>
          <option value="admin">Admin</option>
          <option value="billing">Billing</option>
          <option value="member">Member</option>
        </select>
        <button
          type="button"
          onClick={onResendInvites}
          aria-label={`Resend invitations to ${selectedCount} selected ${selectedCount === 1 ? "member" : "members"}`}
          style={{
            ...pagerBtnStyle,
            minHeight: "2.75rem",
            padding: "0.5rem 0.95rem",
          }}
        >
          Resend invite{selectedCount > 1 ? "s" : ""}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${selectedCount} selected ${selectedCount === 1 ? "member" : "members"}`}
          style={{
            ...pagerBtnStyle,
            minHeight: "2.75rem",
            padding: "0.5rem 0.95rem",
            color: "var(--danger)",
            borderColor: "rgba(251, 113, 133, 0.35)",
          }}
        >
          Remove
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          style={iconBtnStyle}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// #245 — InviteMemberModal
// Multi-email chip input with role preselect and invitation email preview.
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVITE_ROLE_OPTIONS: { value: TeamRole; label: string; description: string }[] = [
  { value: "admin",   label: "Admin",   description: "Full access except billing and ownership transfer." },
  { value: "billing", label: "Billing", description: "Can manage payment methods and view invoices." },
  { value: "member",  label: "Member",  description: "Read access to attestations and revenue sources." },
];

interface InviteMemberModalProps {
  onClose: () => void;
  onInvite: (emails: string[], role: TeamRole) => void;
}

function InviteMemberModal({ onClose, onInvite }: InviteMemberModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [chips, setChips] = useState<{ email: string; valid: boolean }[]>([]);
  const [role, setRole] = useState<TeamRole>("member");
  const [showPreview, setShowPreview] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Focus trap — move focus into dialog on mount
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => prev?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Commit the current input value as a chip
  function commitInput(raw: string) {
    const trimmed = raw.trim().replace(/,+$/, "");
    if (!trimmed) return;
    const email = trimmed.toLowerCase();
    // Avoid duplicates
    if (chips.some((c) => c.email === email)) {
      setInputValue("");
      return;
    }
    setChips((prev) => [...prev, { email, valid: EMAIL_REGEX.test(email) }]);
    setInputValue("");
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      commitInput(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && chips.length > 0) {
      // Remove last chip on backspace when input is empty
      setChips((prev) => prev.slice(0, -1));
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    // Auto-commit when user types/pastes a comma
    if (val.includes(",")) {
      const parts = val.split(",");
      parts.slice(0, -1).forEach((part) => commitInput(part));
      setInputValue(parts[parts.length - 1]);
    } else {
      setInputValue(val);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (text.includes(",") || text.includes("\n") || text.includes(" ")) {
      e.preventDefault();
      const parts = text.split(/[,\n\s]+/);
      parts.forEach((part) => commitInput(part));
    }
  }

  function removeChip(email: string) {
    setChips((prev) => prev.filter((c) => c.email !== email));
    inputRef.current?.focus();
  }

  function handleSubmit() {
    // Commit any dangling input
    if (inputValue.trim()) commitInput(inputValue);
    setSubmitted(true);
  }

  // After submit state updates, check if we can send
  useEffect(() => {
    if (!submitted) return;
    const validEmails = chips.filter((c) => c.valid).map((c) => c.email);
    if (validEmails.length > 0) {
      onInvite(validEmails, role);
      onClose();
    }
    setSubmitted(false);
  }, [submitted, chips, role, onInvite, onClose]);

  const validCount = chips.filter((c) => c.valid).length;
  const invalidCount = chips.filter((c) => !c.valid).length;
  const hasInvalidChips = invalidCount > 0;
  const canSend = (validCount > 0 || inputValue.trim().length > 0);

  const selectedRoleMeta = INVITE_ROLE_OPTIONS.find((r) => r.value === role)!;

  // Preview email body
  const previewEmails = chips.filter((c) => c.valid).map((c) => c.email);
  const previewRecipient = previewEmails[0] ?? "colleague@example.com";

  const modalOverlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 50,
    background: "rgba(2, 6, 23, 0.72)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "1rem",
  };

  const chipBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: "0.3rem",
    padding: "0.2rem 0.4rem 0.2rem 0.65rem",
    borderRadius: 999, fontSize: "0.83rem", fontWeight: 500,
    maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  return (
    <div
      aria-hidden="true"
      onClick={onClose}
      style={modalOverlay}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520,
          maxHeight: "92dvh", overflowY: "auto",
          background: "var(--surface-strong)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-lg)",
          display: "grid",
          outline: "none",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1.1rem 1.25rem 0.75rem",
          borderBottom: "1px solid var(--border)",
        }}>
          <h2 id="invite-modal-title" style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 700 }}>
            Invite team members
          </h2>
          <button
            type="button"
            aria-label="Close invite modal"
            onClick={onClose}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 8,
              border: "1px solid var(--border)", background: "transparent",
              cursor: "pointer", color: "var(--muted)",
            }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "1rem 1.25rem", display: "grid", gap: "1.1rem" }}>

          {/* Email chip input */}
          <div>
            <label
              id="invite-emails-label"
              style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.9rem" }}
            >
              Email addresses
            </label>
            <div
              role="group"
              aria-labelledby="invite-emails-label"
              aria-describedby="invite-emails-hint"
              onClick={() => inputRef.current?.focus()}
              style={{
                display: "flex", flexWrap: "wrap", gap: "0.35rem",
                alignItems: "center",
                minHeight: "var(--density-touch-min)",
                padding: "0.4rem 0.6rem",
                borderRadius: 12,
                border: `1px solid ${hasInvalidChips ? "var(--danger)" : "var(--border)"}`,
                background: "var(--surface)",
                cursor: "text",
              }}
            >
              {chips.map(({ email, valid }) => (
                <span
                  key={email}
                  style={{
                    ...chipBase,
                    background: valid ? "rgba(94, 234, 212, 0.12)" : "var(--danger-soft)",
                    border: `1px solid ${valid ? "rgba(94,234,212,0.35)" : "rgba(251,113,133,0.4)"}`,
                    color: valid ? "var(--accent)" : "var(--danger)",
                  }}
                >
                  <span
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={email}
                  >
                    {email}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${email}`}
                    onClick={(e) => { e.stopPropagation(); removeChip(email); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, width: 16, height: 16, borderRadius: "50%",
                      border: "none", background: "transparent",
                      cursor: "pointer", color: "inherit", padding: 0,
                    }}
                  >
                    <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                type="email"
                multiple
                autoComplete="off"
                value={inputValue}
                placeholder={chips.length === 0 ? "name@company.com, another@company.com" : ""}
                aria-label="Add email address"
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onPaste={handlePaste}
                onBlur={() => { if (inputValue.trim()) commitInput(inputValue); }}
                style={{
                  flex: "1 1 160px", minWidth: 0,
                  border: "none", outline: "none",
                  background: "transparent", color: "var(--text)",
                  fontSize: "0.9rem", padding: "0.15rem 0",
                }}
              />
            </div>
            <p id="invite-emails-hint" style={{ margin: "0.3rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
              Press Enter or comma to add each address. Paste a comma-separated list to add many at once.
            </p>
            {hasInvalidChips && (
              <p role="alert" style={{ margin: "0.3rem 0 0", fontSize: "0.8rem", color: "var(--danger)" }}>
                {invalidCount} address{invalidCount > 1 ? "es are" : " is"} invalid and will be skipped.
              </p>
            )}
          </div>

          {/* Role preselect */}
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ fontWeight: 700, marginBottom: "0.5rem", fontSize: "0.9rem" }}>Role</legend>
            <div style={{ display: "grid", gap: "0.45rem" }}>
              {INVITE_ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "0.65rem",
                    padding: "0.65rem 0.85rem",
                    borderRadius: 10,
                    border: `1px solid ${role === opt.value ? "var(--border-strong)" : "var(--border)"}`,
                    background: role === opt.value ? "rgba(94, 234, 212, 0.06)" : "transparent",
                    cursor: "pointer",
                    transition: "border-color 0.12s, background 0.12s",
                  }}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    value={opt.value}
                    checked={role === opt.value}
                    onChange={() => setRole(opt.value)}
                    aria-describedby={`invite-role-desc-${opt.value}`}
                    style={{ marginTop: "0.15rem", flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ display: "block", fontWeight: 600, fontSize: "0.9rem" }}>{opt.label}</span>
                    <span id={`invite-role-desc-${opt.value}`} style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                      {opt.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Email preview toggle */}
          <div>
            <button
              type="button"
              aria-expanded={showPreview}
              aria-controls="invite-email-preview"
              onClick={() => setShowPreview((p) => !p)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--accent)", fontSize: "0.85rem", fontWeight: 600, padding: 0,
              }}
            >
              <svg
                aria-hidden="true" width="13" height="13" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: showPreview ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {showPreview ? "Hide" : "Preview"} invitation email
            </button>

            {showPreview && (
              <div
                id="invite-email-preview"
                aria-label="Invitation email preview"
                style={{
                  marginTop: "0.75rem",
                  padding: "0.85rem 1rem",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  fontSize: "0.85rem",
                  lineHeight: 1.65,
                  color: "var(--text)",
                }}
              >
                <p style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Preview · Not a real send
                </p>
                <p style={{ margin: "0 0 0.35rem" }}>
                  <strong>To:</strong>{" "}
                  <span style={{ color: "var(--muted)" }}>{previewRecipient}</span>
                </p>
                <p style={{ margin: "0 0 0.35rem" }}>
                  <strong>Subject:</strong> You've been invited to join the Veritasor workspace
                </p>
                <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0.6rem 0" }} />
                <p style={{ margin: "0 0 0.5rem" }}>Hi there,</p>
                <p style={{ margin: "0 0 0.5rem" }}>
                  You've been invited to join the Veritasor workspace as a{" "}
                  <strong>{selectedRoleMeta.label}</strong>.{" "}
                  {selectedRoleMeta.description}
                </p>
                <p style={{ margin: "0 0 0.75rem" }}>
                  Click the button below to accept your invitation and set up your account.
                </p>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.5rem 1.1rem",
                    borderRadius: 8,
                    background: "var(--accent)",
                    color: "#04111f",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                  }}
                >
                  Accept invitation
                </span>
                <p style={{ margin: "0.75rem 0 0", color: "var(--muted)", fontSize: "0.78rem" }}>
                  This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "0.9rem 1.25rem",
          borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "0.75rem",
        }}>
          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            {validCount > 0
              ? <>Sending to <strong style={{ color: "var(--text)" }}>{validCount}</strong> address{validCount !== 1 ? "es" : ""} as <strong style={{ color: "var(--text)" }}>{selectedRoleMeta.label}</strong></>
              : "Add at least one valid email address"}
          </span>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.55rem 1rem", borderRadius: 10,
                border: "1px solid var(--border)", background: "transparent",
                cursor: "pointer", color: "var(--text)", fontWeight: 600, fontSize: "0.88rem",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSend}
              onClick={handleSubmit}
              style={{
                padding: "0.55rem 1.1rem", borderRadius: 10,
                border: "1px solid transparent",
                background: canSend ? "linear-gradient(135deg, var(--accent), #60a5fa)" : "var(--surface-soft)",
                cursor: canSend ? "pointer" : "not-allowed",
                color: canSend ? "#04111f" : "var(--muted)",
                fontWeight: 700, fontSize: "0.88rem",
                opacity: canSend ? 1 : 0.6,
              }}
            >
              Send {validCount > 1 ? `${validCount} invitations` : "invitation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamPanel() {
  const [members, setMembers] = useState<TeamMember[]>(MOCK_TEAM);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [pending, setPending] = useState<PendingBulkAction | null>(null);
  const [activeConflicts, setActiveConflicts] =
    useState<
      Map<
        string,
        NonNullable<ReturnType<typeof getRoleConflicts>> & {
          _originalRole?: TeamRole;
        }
      >
    >(new Map());
  const [dismissedConflicts, setDismissedConflicts] = useState<Set<string>>(
    new Set(),
  );

  const allSelected = members.length > 0 && selected.size === members.length;
  const someSelected = selected.size > 0 && !allSelected;
  const selectedCount = selected.size;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(members.map((m) => m.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resolveConflict(
    memberId: string,
    action: string,
    targetRole: TeamRole,
    originalRole: TeamRole,
  ) {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    switch (action) {
      case "accept":
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId
              ? { ...m, role: targetRole, extraPermissions: [] }
              : m,
          ),
        );
        break;
      case "revert":
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId ? { ...m, role: originalRole } : m,
          ),
        );
        break;
      case "strip_extras":
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId
              ? { ...m, role: targetRole, extraPermissions: [] }
              : m,
          ),
        );
        break;
      case "keep_extras":
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: targetRole } : m)),
        );
        break;
    }
    setActiveConflicts((prev) => {
      const next = new Map(prev);
      next.delete(memberId);
      return next;
    });
    setDismissedConflicts((prev) => new Set(prev).add(memberId));
    setTimeout(() => {
      setDismissedConflicts((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }, 10000);
  }

  function dismissConflict(memberId: string, originalRole: TeamRole) {
    setActiveConflicts((prev) => {
      const next = new Map(prev);
      next.delete(memberId);
      return next;
    });
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: originalRole } : m)),
    );
    setDismissedConflicts((prev) => new Set(prev).add(memberId));
    setTimeout(() => {
      setDismissedConflicts((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }, 10000);
  }

  function applyBulkRole(role: TeamRole) {
    const affected = members.filter((m) => selected.has(m.id));
    setPending({
      type: "role",
      count: affected.length,
      targetRole: role,
      snapshot: affected,
      message: `Role changed to ${TEAM_ROLE_LABELS[role]} for ${affected.length} ${affected.length === 1 ? "member" : "members"}.`,
    });
    setMembers((prev) =>
      prev.map((m) => (selected.has(m.id) ? { ...m, role } : m)),
    );
    setSelected(new Set());
    scheduleUndoClear();
  }

  function applyBulkResend() {
    const affected = members.filter((m) => selected.has(m.id));
    setPending({
      type: "resend",
      count: affected.length,
      snapshot: affected,
      message: `Invitation${affected.length === 1 ? "" : "s"} resent for ${affected.length} ${affected.length === 1 ? "member" : "members"}.`,
    });
    setSelected(new Set());
    scheduleUndoClear();
  }

  function applyBulkRemove() {
    const affected = members.filter((m) => selected.has(m.id));
    setPending({
      type: "remove",
      count: affected.length,
      snapshot: affected,
      message: `Removed ${affected.length} ${affected.length === 1 ? "member" : "members"} from the workspace.`,
    });
    setMembers((prev) => prev.filter((m) => !selected.has(m.id)));
    setSelected(new Set());
    scheduleUndoClear();
  }

  function scheduleUndoClear() {
    setTimeout(() => setPending(null), 10000);
  }

  function undoPending() {
    if (!pending) return;
    if (pending.type === "role" && pending.targetRole) {
      setMembers((prev) =>
        prev.map((m) => {
          const snap = pending.snapshot.find((s) => s.id === m.id);
          return snap ? { ...m, role: snap.role } : m;
        }),
      );
    } else if (pending.type === "remove") {
      setMembers((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        pending.snapshot.forEach((s) => map.set(s.id, s));
        return Array.from(map.values()).sort(
          (a, b) =>
            MOCK_TEAM.findIndex((x) => x.id === a.id) -
            MOCK_TEAM.findIndex((x) => x.id === b.id),
        );
      });
    }
    setPending(null);
  }

  const roleOptions = useMemo(
    () => ["admin", "billing", "member"] as TeamRole[],
    [],
  );

  function handleInvite(emails: string[], role: TeamRole) {
    const newMembers: TeamMember[] = emails.map((email, i) => ({
      id: `u_invite_${Date.now()}_${i}`,
      name: email.split("@")[0],
      email,
      role,
      status: "pending" as MemberStatus,
      joinedAt: new Date().toISOString().split("T")[0],
      avatarInitials: email.slice(0, 2).toUpperCase(),
    }));
    setMembers((prev) => [...prev, ...newMembers]);
    setPending({
      type: "resend",
      count: newMembers.length,
      snapshot: newMembers,
      message: `Invitation${newMembers.length === 1 ? "" : "s"} sent to ${newMembers.length} ${newMembers.length === 1 ? "address" : "addresses"}.`,
    });
    scheduleUndoClear();
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h2>Team</h2>
          <p style={{ color: "var(--muted)" }}>
            Manage workspace members, roles, and pending invitations.
          </p>
        </div>
        <button
          type="button"
          aria-label="Invite new team members"
          onClick={() => setShowInviteModal(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            padding: "0.6rem 1.1rem", borderRadius: 10,
            border: "1px solid transparent",
            background: "linear-gradient(135deg, var(--accent), #60a5fa)",
            color: "#04111f", fontWeight: 700, fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Invite members
        </button>
      </div>

      {showInviteModal && (
        <InviteMemberModal
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInvite}
        />
      )}

      {selectedCount > 0 && (
        <BulkActionToolbar
          selectedCount={selectedCount}
          onClear={() => setSelected(new Set())}
          onChangeRole={(r) => applyBulkRole(r)}
          onResendInvites={applyBulkResend}
          onRemove={applyBulkRemove}
        />
      )}

      {pending && (
        <div
          role="status"
          aria-live="polite"
          className="undo-banner"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: "1rem",
            padding: "0.85rem 1.1rem",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-strong)",
            border: "1px solid var(--border-strong)",
          }}
        >
          <span style={{ fontSize: "0.93rem", fontWeight: 500 }}>
            {pending.message}
          </span>
          <button
            type="button"
            onClick={undoPending}
            aria-label={`Undo: ${pending.message}`}
            style={{
              ...pagerBtnStyle,
              minHeight: "2.5rem",
              padding: "0.45rem 1rem",
              color: "var(--accent)",
              borderColor: "rgba(94, 234, 212, 0.35)",
              fontWeight: 700,
            }}
          >
            Undo
          </button>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          role="table"
          aria-label="Team members"
          style={{
            width: "100%",
            minWidth: 640,
            borderCollapse: "separate",
            borderSpacing: 0,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          <thead>
            <tr style={{ background: "var(--surface-strong)" }}>
              <th scope="col" style={{ ...thStyle, width: 48 }}>
                <label className="sr-only" htmlFor="team-select-all">
                  Select all members
                </label>
                <input
                  id="team-select-all"
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label={
                    allSelected ? "Deselect all members" : "Select all members"
                  }
                  style={{ width: 18, height: 18 }}
                />
              </th>
              <th scope="col" style={thStyle}>
                Member
              </th>
              <th scope="col" style={thStyle}>
                Role
              </th>
              <th scope="col" style={thStyle}>
                Status
              </th>
              <th scope="col" style={thStyle}>
                Joined
              </th>
              <th scope="col" style={{ ...thStyle, textAlign: "right" }}>
                <span className="sr-only">Row actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSel = selected.has(m.id);
              const statusMeta = MEMBER_STATUS_META[m.status];
              return (
                <tr
                  key={m.id}
                  className="team-member-row"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <td style={{ ...tdStyle, width: 48 }}>
                    <label className="sr-only" htmlFor={`sel-${m.id}`}>
                      Select {m.name}
                    </label>
                    <input
                      id={`sel-${m.id}`}
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleOne(m.id)}
                      aria-label={
                        isSel ? `Deselect ${m.name}` : `Select ${m.name}`
                      }
                      style={{ width: 18, height: 18 }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                      }}
                    >
                      <MemberAvatar initials={m.avatarInitials} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div
                          style={{
                            color: "var(--muted)",
                            fontSize: "0.85rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <RoleChip role={m.role} />
                  </td>
                  <td style={tdStyle}>
                    <span
                      role="status"
                      aria-label={`Status: ${statusMeta.label}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontSize: "0.88rem",
                        color: "var(--text)",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: "0.5rem",
                          height: "0.5rem",
                          borderRadius: "50%",
                          background: statusMeta.dot,
                          flexShrink: 0,
                        }}
                      />
                      {statusMeta.label}
                    </span>
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      color: "var(--muted)",
                      fontSize: "0.88rem",
                    }}
                  >
                    {new Date(m.joinedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      verticalAlign: "top",
                      paddingTop: "0.85rem",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        justifyItems: "end",
                        gap: "0.4rem",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          gap: "0.4rem",
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <select
                          aria-label={`Change role for ${m.name}`}
                          aria-describedby={
                            activeConflicts.has(m.id)
                              ? `conflict-${m.id}`
                              : undefined
                          }
                          aria-invalid={activeConflicts.has(m.id)}
                          value={m.role}
                          onChange={(e) => {
                            const newRole = e.target.value as TeamRole;
                            const prevMember = members.find(
                              (x) => x.id === m.id,
                            );
                            const prevRole = prevMember?.role ?? m.role;
                            if (newRole !== prevRole) {
                              const conflict = getRoleConflicts(
                                prevRole,
                                newRole,
                                prevMember?.extraPermissions ?? [],
                              );
                              if (conflict && !dismissedConflicts.has(m.id)) {
                                setActiveConflicts((prev) => {
                                  const next = new Map(prev);
                                  next.set(m.id, {
                                    ...conflict,
                                    _originalRole: prevRole,
                                  });
                                  return next;
                                });
                              }
                            }
                            setMembers((prev) =>
                              prev.map((x) =>
                                x.id === m.id ? { ...x, role: newRole } : x,
                              ),
                            );
                          }}
                          style={{
                            ...pagerBtnStyle,
                            minHeight: "2.25rem",
                            padding: "0.25rem 1.75rem 0.25rem 0.6rem",
                            fontSize: "0.82rem",
                            appearance: "auto",
                            borderColor: activeConflicts.has(m.id)
                              ? "rgba(251, 191, 36, 0.5)"
                              : undefined,
                            boxShadow: activeConflicts.has(m.id)
                              ? "0 0 0 3px rgba(251, 191, 36, 0.15)"
                              : undefined,
                          }}
                        >
                          {(
                            [
                              "owner",
                              "admin",
                              "billing",
                              "member",
                            ] as TeamRole[]
                          ).map((r) => (
                            <option
                              key={r}
                              value={r}
                              disabled={r === "owner" && m.role !== "owner"}
                            >
                              {TEAM_ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        {m.status === "pending" && (
                          <button
                            type="button"
                            aria-label={`Resend invitation to ${m.name}`}
                            style={{
                              ...iconBtnStyle,
                              minHeight: "2.25rem",
                              padding: "0.3rem 0.6rem",
                              fontSize: "0.82rem",
                            }}
                          >
                            Resend
                          </button>
                        )}
                        {m.role !== "owner" && (
                          <button
                            type="button"
                            aria-label={`Remove ${m.name} from workspace`}
                            onClick={() => {
                              setSelected(new Set([m.id]));
                              setTimeout(() => applyBulkRemove(), 0);
                            }}
                            style={{
                              ...iconBtnStyle,
                              minHeight: "2.25rem",
                              padding: "0.3rem 0.6rem",
                              fontSize: "0.82rem",
                              color: "var(--danger)",
                              borderColor: "rgba(251, 113, 133, 0.3)",
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {activeConflicts.has(m.id) &&
                        activeConflicts.get(m.id) && (
                          <div style={{ width: "100%", maxWidth: 420 }}>
                            <PermissionConflictWarning
                              conflict={activeConflicts.get(m.id)!}
                              memberName={m.name}
                              conflictId={`conflict-${m.id}`}
                              onResolve={(action) =>
                                resolveConflict(
                                  m.id,
                                  action,
                                  m.role,
                                  (activeConflicts.get(m.id) as any)
                                    ._originalRole ?? m.role,
                                )
                              }
                              onDismiss={() =>
                                dismissConflict(
                                  m.id,
                                  (activeConflicts.get(m.id) as any)
                                    ._originalRole ?? m.role,
                                )
                              }
                            />
                          </div>
                        )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--border)",
          margin: "0.5rem 0",
          opacity: 0.6,
        }}
      />

      <PendingInvitationsTable />
    </div>
  );
}

function AppearancePanel() {
  const [workspace, setWorkspace] = useState('default-workspace')

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <h2>Appearance</h2>
        <p style={{ color: "var(--muted)" }}>
          Customise the look and feel of your dashboard.
        </p>
      </div>

      {/* ── Density ───────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gap: "1rem",
          padding: "1.25rem",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface)",
          maxWidth: 600,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Display density</h3>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: "var(--muted)",
              fontSize: "0.88rem",
            }}
          >
            Control the spacing and information density of data-heavy views.
          </p>
        </div>
        <DensityToggle workspace={workspace} />
        <p
          style={{
            margin: 0,
            color: "var(--muted)",
            fontSize: "0.82rem",
            lineHeight: 1.5,
          }}
        >
          Your preference is saved locally and synced to the cloud when you are
          signed in. Changes take effect immediately.
        </p>
      </div>
    </div>
  )
}

const PANELS: Record<TabId, () => JSX.Element> = {
  profile: ProfilePanel,
  business: BusinessProfilePanel,
  notifications: NotificationsPanel,
  appearance: AppearancePanel,
  team: TeamPanel,
  integrations: SettingsIntegrationsPanel,
  "api-keys": ApiKeysPanel,
  tokens: TokensPanel,
  billing: BillingPanel,
  security: SecurityPanel,
  "audit-log": AuditLogPanel,
  "a11y-audit": () => <A11yAuditPanel />,
};

// ─── Unsaved Changes Navigation Guard ─────────────────────────────────────────

type LeaveAction = { kind: "external" } | { kind: "tab"; target: TabId };

function leaveActionToText(action: LeaveAction): string {
  if (action.kind === "external") return "this page";
  const label = TABS.find((t) => t.id === action.target)?.label;
  return `the ${label ?? action.target} section`;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export default function Settings() {
  const location = useLocation();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Map<TabId, DirtyTabEntry>>(() => new Map());
  const register = useCallback((tab: TabId, entry: DirtyTabEntry) => {
    setEntries((current) => new Map(current).set(tab, entry));
  }, []);
  const unregister = useCallback((tab: TabId) => {
    setEntries((current) => {
      if (!current.has(tab)) return current;
      const next = new Map(current);
      next.delete(tab);
      return next;
    });
  }, []);
  const registry = useMemo<DirtyRegistryCtx>(
    () => ({ entries, register, unregister }),
    [entries, register, unregister],
  );
  const pageState = usePageDirtyState(registry);
  const blocker = useBlocker(pageState.anyDirty);
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    getTabFromHash(location.hash),
  );
  const [pendingLeave, setPendingLeave] = useState<LeaveAction | null>(null);
  const [leaveSaveError, setLeaveSaveError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const srAnnounceRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const cancelLeave = useCallback(() => {
    setPendingLeave(null);
    if (blocker.state === "blocked") blocker.reset();
    setLeaveSaveError(null);
  }, [blocker]);

  useEffect(() => {
    if (blocker.state === "blocked") {
      const nextLocation = blocker.location;
      const target = nextLocation.pathname === location.pathname
        ? getTabFromHash(nextLocation.hash)
        : null;
      setPendingLeave(
        target && target !== activeTab
          ? { kind: "tab", target }
          : { kind: "external" },
      );
      if (srAnnounceRef.current) {
        srAnnounceRef.current.textContent =
          "Warning: you have unsaved changes. A dialog is open to confirm leaving the page.";
      }
    }
  }, [blocker, location.pathname, activeTab]);

  useEffect(() => {
    if (pendingLeave !== null) {
      prevFocusRef.current = document.activeElement as HTMLElement | null;
      queueMicrotask(() => dialogRef.current?.focus());
    } else if (prevFocusRef.current) {
      const el = prevFocusRef.current;
      queueMicrotask(() => el.focus());
      prevFocusRef.current = null;
    }
  }, [pendingLeave]);

  useEffect(() => {
    if (pendingLeave === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelLeave();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pendingLeave, cancelLeave]);

  async function saveAllAndLeave(action: LeaveAction) {
    setLeaveSaveError(null);
    try {
      await pageState.saveAll();
    } catch (error) {
      setLeaveSaveError(
        error instanceof Error ? error.message : "Unable to save your changes.",
      );
      return;
    }
    setPendingLeave(null);
    if (blocker.state === "blocked") {
      blocker.proceed();
    } else if (action.kind === "tab") {
      setActiveTab(action.target);
      navigate(`/settings#${action.target}`, { replace: true });
    }
    setLeaveSaveError(null);
  }

  function discardAndLeave(action: LeaveAction) {
    pageState.discardAll();
    setPendingLeave(null);
    setLeaveSaveError(null);
    if (blocker.state === "blocked") {
      blocker.proceed();
    } else if (action.kind === "tab") {
      setActiveTab(action.target);
      navigate(`/settings#${action.target}`, { replace: true });
    }
  }

  // ── Sync tab with hash ────────────────────────────────────────────────

  useEffect(() => {
    const next = getTabFromHash(location.hash);
    if (next !== activeTab && pageState.anyDirty) {
      const was = history.state;
      history.replaceState(was, "", `#${activeTab}`);
      setPendingLeave({ kind: "tab", target: next });
      if (srAnnounceRef.current) {
        srAnnounceRef.current.textContent = `Warning: you have unsaved changes. Confirm switching to ${leaveActionToText(
          { kind: "tab", target: next },
        )}.`;
      }
    } else if (next !== activeTab) {
      setActiveTab(next);
    }
  }, [location.hash, activeTab, pageState.anyDirty]);

  useEffect(() => {
    if (!sheetOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSheetOpen(false)
        document.getElementById('settings-sheet-trigger')?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [sheetOpen])

  const selectTab = useCallback(
    (id: TabId) => {
      if (id === activeTab) return;
      if (pageState.anyDirty) {
        setPendingLeave({ kind: "tab", target: id });
        if (srAnnounceRef.current) {
          const label = TABS.find((t) => t.id === id)?.label;
          srAnnounceRef.current.textContent = `Warning: you have unsaved changes. Confirm switching to the ${label} section.`;
        }
      } else {
        setActiveTab(id);
        navigate(`/settings#${id}`, { replace: true });
      }
    },
    [activeTab, navigate, pageState.anyDirty],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      let next = currentIndex;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next = (currentIndex + 1) % TABS.length;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        next = (currentIndex - 1 + TABS.length) % TABS.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        next = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        next = TABS.length - 1;
      } else {
        return;
      }
      tabRefs.current[next]?.focus();
      selectTab(TABS[next].id);
    },
    [selectTab],
  );

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? 'Settings'
  const dirtyTabLabels: string[] = [];
  const Panel = PANELS[activeTab]

  return (
    <DirtyRegistryContext.Provider value={registry}>
      <div>
        <div
          ref={srAnnounceRef}
          role="status"
          aria-live="assertive"
          aria-atomic="true"
          tabIndex={-1}
          className="sr-only"
        />
        <h1 style={{ marginTop: 0 }}>Settings</h1>

      {/* Mobile: bottom-sheet trigger */}
      <button
        id="settings-sheet-trigger"
        type="button"
        className="settings-tab-select"
        aria-haspopup="listbox"
        aria-expanded={sheetOpen}
        onClick={() => setSheetOpen(true)}
        style={{
          width: "100%",
          padding: "0.6rem 0.8rem",
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-strong)',
          color: 'var(--text)',
          fontSize: '0.95rem',
          marginBottom: '1.5rem',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{activeLabel}</span>
        <span aria-hidden="true" style={{ fontSize: '0.8rem' }}>▼</span>
      </button>

      {/* Bottom sheet */}
      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Settings sections"
          ref={sheetRef}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          <div
            aria-hidden="true"
            onClick={() => setSheetOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
          />
          <div
            style={{
              position: 'relative',
              background: 'var(--surface)',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: '1rem 0 2rem',
              maxHeight: '70vh',
              overflowY: 'auto',
              animation: 'slideUp 0.2s ease-out',
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                background: 'var(--border)',
                borderRadius: 2,
                margin: '0 auto 1rem',
              }}
            />
            <ul role="listbox" aria-label="Settings sections" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {TABS.map((tab) => (
                <li key={tab.id} role="option" aria-selected={tab.id === activeTab}>
                  <button
                    type="button"
                    onClick={() => { selectTab(tab.id); setSheetOpen(false) }}
                    style={{
                      width: '100%',
                      padding: '0.8rem 1.2rem',
                      border: 'none',
                      background: tab.id === activeTab ? 'var(--surface-strong)' : 'transparent',
                      color: tab.id === activeTab ? 'var(--accent)' : 'var(--text)',
                      fontSize: '1rem',
                      fontWeight: tab.id === activeTab ? 600 : 400,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Desktop: tablist */}
        <div
          role="tablist"
          aria-label="Settings tabs"
          className="settings-tablist"
          style={{
            display: "flex",
            gap: "0",
            borderBottom: "2px solid var(--border)",
            marginBottom: "1.5rem",
            overflowX: "auto",
          }}
        >
          {TABS.map((tab, index) => {
            const isActive = tab.id === activeTab;
            const dirty = registry.entries.get(tab.id)?.isDirty ?? false;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                role="tab"
                id={`tab-${tab.id}`}
                aria-controls={`panel-${tab.id}`}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => selectTab(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                style={{
                  padding: "0.6rem 1.1rem",
                  background: "transparent",
                  border: "none",
                  borderBottom: isActive
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  marginBottom: -2,
                  color: isActive ? "var(--accent)" : "var(--muted)",
                  fontWeight: isActive ? 700 : 400,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.15s, border-color 0.15s",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  {tab.label}
                  {dirty && (
                    <span
                      aria-hidden="true"
                      title="Unsaved changes"
                      style={{
                        width: "0.45rem",
                        height: "0.45rem",
                        borderRadius: "50%",
                        background: "var(--warning)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {dirty && <span className="sr-only">unsaved changes</span>}
                </span>
              </button>
            );
          })}
        </div>

        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <div
              key={tab.id}
              role="tabpanel"
              id={`panel-${tab.id}`}
              aria-labelledby={`tab-${tab.id}`}
              hidden={!isActive}
              tabIndex={0}
            >
              {isActive && <Panel />}
            </div>
          );
        })}
      </div>

      {pendingLeave !== null && (
        <div
          className="modal-backdrop"
          onClick={cancelLeave}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leave-warning-title"
            aria-describedby="leave-warning-desc leave-warning-tabs"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-sm)",
              boxShadow: "0 24px 48px rgba(2, 6, 23, 0.5)",
              padding: "1.25rem 1.25rem 1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "2.25rem",
                    height: "2.25rem",
                    borderRadius: "50%",
                    background: "var(--warning-soft)",
                    border: "1px solid rgba(251, 191, 36, 0.4)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--warning)",
                    fontWeight: 800,
                    fontSize: "1rem",
                  }}
                >
                  !
                </span>
                <h2
                  id="leave-warning-title"
                  style={{ margin: 0, fontSize: "1.05rem" }}
                >
                  Leave with unsaved changes?
                </h2>
              </div>
              <button
                type="button"
                onClick={cancelLeave}
                aria-label="Close dialog, stay on page"
                title="Press Escape to dismiss"
                style={{
                  minWidth: "2.25rem",
                  minHeight: "2.25rem",
                  padding: "0.3rem",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: "var(--muted)",
                  fontSize: "1rem",
                  cursor: "pointer",
                }}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <p
              id="leave-warning-desc"
              style={{
                margin: "0 0 0.5rem",
                fontSize: "0.93rem",
                color: "var(--text)",
                lineHeight: 1.5,
              }}
            >
              You have unsaved changes. If you leave{" "}
              <strong>{leaveActionToText(pendingLeave)}</strong>, your edits{" "}
              {pendingLeave.kind === "external"
                ? "will be saved as a local draft and may be lost if you clear browser storage."
                : "will remain as a local draft."}
            </p>
            {leaveSaveError && (
              <p role="alert" style={{ color: "var(--danger)", margin: "0 0 1rem" }}>
                {leaveSaveError}
              </p>
            )}
            {dirtyTabLabels.length > 0 && (
              <ul
                id="leave-warning-tabs"
                style={{
                  margin: "0 0 1rem",
                  paddingLeft: "1.2rem",
                  fontSize: "0.88rem",
                  color: "var(--muted)",
                }}
              >
                {dirtyTabLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            )}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={cancelLeave}
                style={{
                  minHeight: "2.5rem",
                  padding: "0.5rem 1rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => discardAndLeave(pendingLeave)}
                style={{
                  minHeight: "2.5rem",
                  padding: "0.5rem 1rem",
                  borderRadius: 8,
                  border: "1px solid rgba(251, 113, 133, 0.4)",
                  background: "rgba(251, 113, 133, 0.08)",
                  color: "var(--danger)",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Discard & leave
              </button>
              <button
                type="button"
                onClick={() => saveAllAndLeave(pendingLeave)}
                style={{
                  minHeight: "2.5rem",
                  padding: "0.5rem 1.1rem",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--accent)",
                  color: "#04111f",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Save & leave
              </button>
            </div>
          </div>
        </div>
      )}
    </DirtyRegistryContext.Provider>
  )
}
