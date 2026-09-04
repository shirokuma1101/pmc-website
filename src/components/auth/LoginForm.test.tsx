import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

const routerMocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));
vi.mock("./TurnstileWidget", () => ({
  TurnstileWidget: ({ onTokenChange }: { onTokenChange: (token: string) => void }) => (
    <button type="button" onClick={() => onTokenChange("test-token")}>セキュリティ確認を完了</button>
  ),
}));

describe("LoginForm", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    routerMocks.push.mockReset();
    routerMocks.refresh.mockReset();
  });

  it("shows only email and password before authentication", () => {
    render(<LoginForm />);

    expect(screen.getByRole("textbox", { name: /メールアドレス/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/パスワード/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "認証コード" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeDisabled();
  });

  it("moves 2FA users to the dedicated code screen and submits the OTP", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { requiresOtp: true } }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { user: { id: "user" } } }), { status: 200 }));
    render(<LoginForm />);
    fireEvent.change(screen.getByRole("textbox", { name: /メールアドレス/ }), { target: { value: "member@example.com" } });
    fireEvent.change(screen.getByLabelText(/パスワード/), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "セキュリティ確認を完了" }));
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByRole("heading", { name: "認証コードを入力" })).toBeInTheDocument();
    const otp = screen.getByRole("textbox", { name: "認証コード" });
    fireEvent.change(otp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "セキュリティ確認を完了" }));
    fireEvent.click(screen.getByRole("button", { name: "認証してログイン" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      email: "member@example.com",
      password: "password",
      otp: "123456",
    });
  });
});
