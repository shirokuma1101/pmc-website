import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  COOKIE_CONSENT_KEY,
  CookieConsent,
  CookieSettingsButton,
} from "./CookieConsent";

describe("CookieConsent", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("asks on first visit and stores necessary-only consent", async () => {
    render(<CookieConsent />);
    expect(await screen.findByRole("heading", { name: "Cookieの利用について" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "任意Cookieを許可しない" }));
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe("necessary");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Cookieの利用について" })).not.toBeInTheDocument());
  });

  it("does not ask again after a choice and can be reopened from the footer", async () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "all");
    render(<><CookieConsent /><CookieSettingsButton /></>);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Cookieの利用について" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Cookie設定" }));
    expect(await screen.findByRole("heading", { name: "Cookieの利用について" })).toBeInTheDocument();
  });
});
