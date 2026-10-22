import { useEffect } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, beforeEach } from "vitest";
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

  it("hides the banner when dismissFailedPayment is called (simulate success/empty path)", () => {
    renderLayout(["/"]);

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
