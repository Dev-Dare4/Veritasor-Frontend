import { useEffect } from "react";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { afterEach, describe, it, expect, beforeEach, vi } from "vitest";
import Layout from "./Layout";
import { useBilling } from "./BillingContext";
import { LocaleProvider } from "../i18n/provider";

function SeedFailedPayment() {
  const { setFailedPayment } = useBilling();
  useEffect(() => {
    setFailedPayment({
      invoiceId: "INV-2026-09",
      period: "September 2026",
      amount: "$49.00",
      dueDate: "Sep 15, 2026",
    });
  }, [setFailedPayment]);
  return <div>Billing Seeded</div>;
}

function renderLayout(initialEntries: string[] = ["/dashboard"]) {
  return render(
    <LocaleProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<SeedFailedPayment />} />
            <Route path="/dashboard" element={<div>Dashboard Page</div>} />
            <Route path="/attestations" element={<div>Attestations Page</div>} />
            <Route path="/sources" element={<div>Sources Page</div>} />
            <Route path="/settings" element={<div>Settings Page</div>} />
            <Route path="/api-keys" element={<div>API Keys Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LocaleProvider>
  );
}

describe("Layout - BillingBannerSlot", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the failed payment banner when a failed payment exists", () => {
    renderLayout(["/"]);

    // The banner should be present when a failed payment is active in BillingProvider.
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/A recent payment failed/i)).toBeInTheDocument();
  });

  it("does not show the banner when there is no failed payment", () => {
    renderLayout();

    expect(screen.queryByText(/A recent payment failed/i)).not.toBeInTheDocument();
  });

  it("main element has id=main-content and tabIndex=-1", () => {
    renderLayout();
    const main = document.getElementById("main-content");
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("tabindex", "-1");
  });
});

// ─── Sidebar ─────────────────────────────────────────────────────────────────

describe("Layout — sidebar", () => {
  it("sidebar opens when hamburger is clicked", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    expect(document.getElementById("app-sidebar")).toHaveClass("app-sidebar-open");
  });

  it("sidebar closes when overlay is clicked", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    fireEvent.click(document.querySelector(".app-sidebar-overlay")!);
    expect(document.getElementById("app-sidebar")).not.toHaveClass("app-sidebar-open");
  });

  it("Escape closes the sidebar", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.getElementById("app-sidebar")).not.toHaveClass("app-sidebar-open");
  });
});

// ─── BillingBannerSlot ────────────────────────────────────────────────────────

describe("Layout — BillingBannerSlot", () => {
  it("renders no billing alert by default (no failed payment)", () => {
    renderLayout();
    // BillingContext starts with null — no alert rendered
    expect(screen.queryByText(/A recent payment failed/i)).not.toBeInTheDocument();
  });
});

describe("Layout - Sidebar Navigation & Account Menu", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders Settings and API keys links in the sidebar navigation", () => {
    renderLayout(["/dashboard"]);

    const sidebarNav = screen.getByRole("navigation", { name: /main navigation/i });
    const settingsLink = within(sidebarNav).getByRole("link", { name: /^settings$/i });
    const apiKeysLink = within(sidebarNav).getByRole("link", { name: /^api keys$/i });

    expect(settingsLink).toHaveAttribute("href", "/settings");
    expect(apiKeysLink).toHaveAttribute("href", "/api-keys");
    expect(settingsLink).not.toHaveAttribute("aria-current");
    expect(apiKeysLink).not.toHaveAttribute("aria-current");
  });

  it("marks Settings link with aria-current='page' when active at /settings", () => {
    renderLayout(["/settings"]);

    const sidebarNav = screen.getByRole("navigation", { name: /main navigation/i });
    const settingsLink = within(sidebarNav).getByRole("link", { name: /^settings$/i });
    const apiKeysLink = within(sidebarNav).getByRole("link", { name: /^api keys$/i });

    expect(settingsLink).toHaveAttribute("aria-current", "page");
    expect(settingsLink).toHaveClass("sidebar-link-active");
    expect(apiKeysLink).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Settings Page")).toBeInTheDocument();
  });

  it("marks API keys link with aria-current='page' when active at /api-keys", () => {
    renderLayout(["/api-keys"]);

    const sidebarNav = screen.getByRole("navigation", { name: /main navigation/i });
    const settingsLink = within(sidebarNav).getByRole("link", { name: /^settings$/i });
    const apiKeysLink = within(sidebarNav).getByRole("link", { name: /^api keys$/i });

    expect(apiKeysLink).toHaveAttribute("aria-current", "page");
    expect(apiKeysLink).toHaveClass("sidebar-link-active");
    expect(settingsLink).not.toHaveAttribute("aria-current");
    expect(screen.getByText("API Keys Page")).toBeInTheDocument();
  });

  it("navigates to /settings and /api-keys from sidebar links and updates aria-current", () => {
    renderLayout(["/dashboard"]);

    const sidebarNav = screen.getByRole("navigation", { name: /main navigation/i });
    const settingsLink = within(sidebarNav).getByRole("link", { name: /^settings$/i });
    const apiKeysLink = within(sidebarNav).getByRole("link", { name: /^api keys$/i });

    fireEvent.click(settingsLink);
    expect(settingsLink).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Settings Page")).toBeInTheDocument();

    fireEvent.click(apiKeysLink);
    expect(apiKeysLink).toHaveAttribute("aria-current", "page");
    expect(settingsLink).not.toHaveAttribute("aria-current");
    expect(screen.getByText("API Keys Page")).toBeInTheDocument();
  });

  it("navigates to /settings and /api-keys from the account menu and changes locale without closing the menu", () => {
    renderLayout(["/dashboard"]);

    const accountTrigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(accountTrigger);

    // Change locale inside account dropdown without dismissing the menu
    const localeTrigger = screen.getByRole("button", { name: /select language/i });
    fireEvent.click(localeTrigger);
    expect(screen.getByRole("menu", { name: /account options/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /español/i }));
    expect(screen.getByRole("menu", { name: /account options/i })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es");

    // Navigate to /api-keys via account menu
    fireEvent.click(screen.getByRole("menuitem", { name: /api keys/i }));
    expect(screen.getByText("API Keys Page")).toBeInTheDocument();
    expect(screen.queryByRole("menu", { name: /account options/i })).not.toBeInTheDocument();
  });
});

function LoginLocation() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string; search: string; hash: string } } | null)?.from;
  return <div data-testid="return-destination">{from ? `${from.pathname}${from.search}${from.hash}` : ""}</div>;
}

describe("Layout session integration", () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const renderLayout = (initialPath = "/settings?tab=security#section") =>
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/settings" element={<div>Settings page</div>} />
            </Route>
            <Route path="/login" element={<LoginLocation />} />
          </Routes>
        </MemoryRouter>
      </LocaleProvider>
    );

  it("mounts the warning and re-auth modal, and reports unavailable verification safely", () => {
    vi.useFakeTimers();
    renderLayout();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    actAdvanceTimers(25 * 60 * 1000);

    expect(screen.getByRole("heading", { name: /session is about to expire/i })).toBeInTheDocument();
    expect(screen.getByText("5:00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /extend session/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    actAdvanceTimers(25 * 60 * 1000);
    fireEvent.click(screen.getByRole("button", { name: /re-authenticate now/i }));
    expect(screen.getByRole("dialog", { name: /re-authenticate to continue/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "not-verified" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(
      "Re-authentication is unavailable here. Please sign in again."
    )).toHaveAttribute("role", "alert");
  });

  it("redirects once to login with the current path, query, and hash as return state", () => {
    vi.useFakeTimers();
    renderLayout();

    actAdvanceTimers(30 * 60 * 1000);
    expect(screen.getByTestId("return-destination")).toHaveTextContent(
      "/settings?tab=security#section"
    );
  });
});

function actAdvanceTimers(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}
