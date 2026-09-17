import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinApplicationForm } from "./JoinApplicationForm";

vi.mock("@/components/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({ onTokenChange }: { onTokenChange: (token: string) => void }) => (
    <button type="button" onClick={() => onTokenChange("test-token")}>セキュリティ確認</button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("JoinApplicationForm", () => {
  it("shows the completed application on the confirmation screen", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(<JoinApplicationForm />);

    fireEvent.change(screen.getByRole("textbox", { name: /表示名/ }), { target: { value: "しろくま" } });
    fireEvent.change(screen.getByRole("textbox", { name: /メールアドレス/ }), { target: { value: "join@example.com" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Minecraftゲーマータグ/ }), { target: { value: "PostMinePlayer" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Discordユーザー名/ }), { target: { value: "postmine_user" } });
    fireEvent.change(screen.getByRole("textbox", { name: /参加したい理由/ }), { target: { value: "建築イベントに参加したいです。" } });
    for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "入力内容を確認" }));

    expect(screen.getByRole("heading", { name: "申請内容の確認" })).toBeInTheDocument();
    expect(screen.getByText("join@example.com")).toBeInTheDocument();
    expect(screen.getByText("PostMinePlayer")).toBeInTheDocument();
    expect(screen.queryByText("送信機能は準備中です")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "申請を送信" })).toBeDisabled();
  });

  it("returns to the form while preserving entered values", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(<JoinApplicationForm />);

    const displayName = screen.getByRole("textbox", { name: /表示名/ });
    fireEvent.change(displayName, { target: { value: "しろくま" } });
    fireEvent.change(screen.getByRole("textbox", { name: /メールアドレス/ }), { target: { value: "join@example.com" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Minecraftゲーマータグ/ }), { target: { value: "PostMinePlayer" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Discordユーザー名/ }), { target: { value: "postmine_user" } });
    fireEvent.change(screen.getByRole("textbox", { name: /参加したい理由/ }), { target: { value: "参加したいです。" } });
    for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "入力内容を確認" }));
    fireEvent.click(screen.getByRole("button", { name: "入力内容を修正" }));

    expect(screen.getByRole("textbox", { name: /表示名/ })).toHaveValue("しろくま");
  });

  it("submits the confirmed application and shows completion", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ data: { submitted: true } }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    ));
    render(<JoinApplicationForm />);

    fireEvent.change(screen.getByRole("textbox", { name: /表示名/ }), { target: { value: "しろくま" } });
    fireEvent.change(screen.getByRole("textbox", { name: /メールアドレス/ }), { target: { value: "join@example.com" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Minecraftゲーマータグ/ }), { target: { value: "PostMinePlayer" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Discordユーザー名/ }), { target: { value: "postmine_user" } });
    fireEvent.change(screen.getByRole("textbox", { name: /参加したい理由/ }), { target: { value: "参加したいです。" } });
    for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "入力内容を確認" }));
    fireEvent.click(screen.getByRole("button", { name: "セキュリティ確認" }));
    fireEvent.click(screen.getByRole("button", { name: "申請を送信" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "参加申請を受け付けました" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/join", expect.objectContaining({ method: "POST" }));
  });
});
