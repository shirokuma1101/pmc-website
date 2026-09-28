import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({ default: () => null }));

import { TurnstileWidget } from "./TurnstileWidget";

describe("TurnstileWidget", () => {
  afterEach(() => {
    cleanup();
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("provides Cloudflare's dummy token for the local development test key", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
    const onTokenChange = vi.fn();

    render(<TurnstileWidget action="login" onTokenChange={onTokenChange} />);

    expect(screen.getByText("ローカル開発用のセキュリティ確認を使用中です。")).toBeInTheDocument();
    await waitFor(() => expect(onTokenChange).toHaveBeenCalledWith("XXXX.DUMMY.TOKEN.XXXX"));
  });

  it("does not use the dummy token for a public deployment URL", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
    process.env.NEXT_PUBLIC_APP_URL = "https://pmc.example.com";
    const onTokenChange = vi.fn();

    render(<TurnstileWidget action="login" onTokenChange={onTokenChange} />);

    expect(screen.queryByText("ローカル開発用のセキュリティ確認を使用中です。")).not.toBeInTheDocument();
    expect(onTokenChange).not.toHaveBeenCalledWith("XXXX.DUMMY.TOKEN.XXXX");
  });
});
