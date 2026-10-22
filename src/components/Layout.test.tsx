import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { IntlProvider } from "react-intl";
import Layout from "./Layout";
import { CookieConsentProvider } from "./CookieConsentContext";
import enMessages from "../i18n/messages/en.json";

function renderLayout(initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <IntlProvider locale="en" messages={enMessages}>
        <CookieConsentProvider>
          <Layout />
        </CookieConsentProvider>
      </IntlProvider>
    </MemoryRouter>
  );
}

// ─── Skip link and main landmark ─────────────────────────────────────────────

describe("Layout — skip link", () => {
  it("renders skip-to-content link", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: /skip to main content/i })).toBeInTheDocument();
  });

  it("skip link href points to #main-content", () => {
    renderLayout();
    const link = screen.getByRole("link", { name: /skip to main content/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("#main-content");
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
