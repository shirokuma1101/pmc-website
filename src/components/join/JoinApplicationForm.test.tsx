import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinApplicationForm } from "./JoinApplicationForm";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("JoinApplicationForm", () => {
  it("shows the completed application on the confirmation screen without sending it", () => {
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
});
