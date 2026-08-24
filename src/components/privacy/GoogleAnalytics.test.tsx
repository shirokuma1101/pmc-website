import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_CONSENT_CHANGED_EVENT, COOKIE_CONSENT_KEY } from "./CookieConsent";
import { GoogleAnalytics } from "./GoogleAnalytics";

vi.mock("next/script", () => ({
  default: ({ id, src, children }: { id: string; src?: string; children?: ReactNode }) => (
    <span data-testid={id} data-src={src}>{children}</span>
  ),
}));

describe("GoogleAnalytics", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "_ga=; Max-Age=0; Path=/";
  });
  afterEach(cleanup);

  it("loads only after optional cookies are allowed", async () => {
    render(<GoogleAnalytics measurementId="G-TEST123" />);
    expect(screen.queryByTestId("google-analytics")).not.toBeInTheDocument();

    act(() => {
      localStorage.setItem(COOKIE_CONSENT_KEY, "all");
      window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: "all" }));
    });

    expect(await screen.findByTestId("google-analytics")).toHaveAttribute(
      "data-src",
      "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
    );
  });

  it("does not load for necessary-only consent and disables an active tag after revocation", async () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "all");
    render(<GoogleAnalytics measurementId="G-TEST123" />);
    expect(await screen.findByTestId("google-analytics")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: "necessary" }));
    });

    await waitFor(() => expect(screen.queryByTestId("google-analytics")).not.toBeInTheDocument());
    expect((window as unknown as Window & { [key: `ga-disable-${string}`]: boolean })["ga-disable-G-TEST123"]).toBe(true);
  });
});
