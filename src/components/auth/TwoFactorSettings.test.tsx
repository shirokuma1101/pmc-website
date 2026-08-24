import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TwoFactorSettings } from "./TwoFactorSettings";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const fetchMock = vi.fn<typeof fetch>();

describe("TwoFactorSettings", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the generated secret server-bound when enabling TFA", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          secret: "JBSWY3DPEHPK3PXP",
          qrDataUrl: "data:image/png;base64,cXItY29kZQ==",
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<TwoFactorSettings enabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "設定を開始" }));
    fireEvent.change(screen.getByLabelText(/現在のパスワード/), {
      target: { value: "current-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    await screen.findByText("JBSWY3DPEHPK3PXP");
    fireEvent.change(screen.getByLabelText(/6桁の認証コード/), {
      target: { value: "012345" },
    });
    fireEvent.click(screen.getByRole("button", { name: "2段階認証を有効にする" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/auth/tfa/enable");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ otp: "012345" });
  });

  it("requires and sends both the password and OTP when disabling TFA", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<TwoFactorSettings enabled />);
    fireEvent.click(screen.getByRole("button", { name: "2段階認証を無効にする" }));
    fireEvent.change(screen.getByLabelText(/現在のパスワード/), {
      target: { value: "current-password" },
    });
    fireEvent.change(screen.getByLabelText(/6桁の認証コード/), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: "無効にする" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/auth/tfa/disable");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      password: "current-password",
      otp: "654321",
    });
  });
});
