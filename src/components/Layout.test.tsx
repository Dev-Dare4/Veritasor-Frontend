import { act, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, it, expect, vi } from "vitest";
import Layout from "./Layout";
import { LocaleProvider } from "../i18n/provider";

describe("Layout - BillingBannerSlot", () => {
  it("shows the failed payment banner when a failed payment exists", () => {
    render(
      <LocaleProvider>
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      </LocaleProvider>
    );

// ─── Skip link and main landmark ─────────────────────────────────────────────

describe("Layout — skip link", () => {
  it("renders skip-to-content link", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: /skip to main content/i })).toBeInTheDocument();
  });

  it("hides the banner when dismissFailedPayment is called (simulate success/empty path)", () => {
    render(
      <LocaleProvider>
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      </LocaleProvider>
    );

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
