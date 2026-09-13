import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({ default: () => null }));

import { TurnstileWidget } from "./TurnstileWidget";

describe("TurnstileWidget", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  });

  it("provides Cloudflare's dummy token for the local development test key", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
    const onTokenChange = vi.fn();

    render(<TurnstileWidget action="login" onTokenChange={onTokenChange} />);

    expect(screen.getByText("ローカル開発用のセキュリティ確認を使用中です。")).toBeInTheDocument();
    await waitFor(() => expect(onTokenChange).toHaveBeenCalledWith("XXXX.DUMMY.TOKEN.XXXX"));
  });
});
