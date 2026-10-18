import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import Layout from "./Layout";

describe("Layout - BillingBannerSlot", () => {
  it("shows the failed payment banner when a failed payment exists", () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    // The banner should be present because the default state in BillingProvider has a failed payment.
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/A recent payment failed/i)).toBeInTheDocument();
  });

  it("hides the banner when dismissFailedPayment is called (simulate success/empty path)", () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    // Banner is initially present
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();

    const dismissButton = screen.getByRole("button", { name: /Update payment method/i });
    expect(dismissButton).toBeInTheDocument();

    // Click to dismiss
    fireEvent.click(dismissButton);

    // The banner should now return null and be removed from the document
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/A recent payment failed/i)).not.toBeInTheDocument();
  });
});
