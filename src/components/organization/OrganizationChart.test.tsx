import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrganizationChart } from "./OrganizationChart";
import type { OrganizationMember } from "@/types";

const member: OrganizationMember = {
  profileId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  displayName: "しろくま",
  bio: "建築が好きです。",
  role: "master",
  roleLabel: "マスター",
  team: "建築チーム",
  xboxGamertag: "ShirokumaXbox",
};

afterEach(cleanup);

describe("OrganizationChart", () => {
  it("opens the public introduction and closes it with Escape", () => {
    render(<OrganizationChart members={[member]} />);
    const card = screen.getByRole("button", { name: /しろくま/ });
    card.focus();
    fireEvent.click(card);
    expect(screen.getByRole("dialog", { name: "しろくま" })).toBeInTheDocument();
    expect(screen.getByText("建築が好きです。")).toBeInTheDocument();
    expect(screen.getByText("ShirokumaXbox")).toBeInTheDocument();
    expect(screen.queryByText("好きなブロック")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "プロフィールページを見る" })).toHaveAttribute("href", `/members/${member.userId}`);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes with the close button", () => {
    render(<OrganizationChart members={[member]} />);
    fireEvent.click(screen.getByRole("button", { name: /しろくま/ }));
    fireEvent.click(screen.getByRole("button", { name: "紹介を閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not require a linked website account", () => {
    const accountlessMember = { ...member };
    delete accountlessMember.userId;
    render(<OrganizationChart members={[accountlessMember]} />);
    fireEvent.click(screen.getByRole("button", { name: /しろくま/ }));
    expect(screen.getByRole("dialog", { name: "しろくま" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "プロフィールページを見る" })).not.toBeInTheDocument();
  });

  it("pans the chart with pointer dragging without opening a card", () => {
    render(<OrganizationChart members={[member]} />);
    const viewport = screen.getByLabelText("メンバー関係図。ドラッグまたはスワイプして移動できます。");
    Object.assign(viewport, {
      scrollLeft: 120,
      scrollTop: 80,
      setPointerCapture: () => undefined,
      hasPointerCapture: () => true,
      releasePointerCapture: () => undefined,
    });
    const pointer = (type: string, clientX: number, clientY: number) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperties(event, {
        pointerId: { value: 1 }, pointerType: { value: "touch" }, button: { value: 0 },
        clientX: { value: clientX }, clientY: { value: clientY },
      });
      fireEvent(viewport, event);
    };
    pointer("pointerdown", 100, 100);
    pointer("pointermove", 60, 70);
    pointer("pointerup", 60, 70);
    expect(viewport.scrollLeft).toBe(160);
    expect(viewport.scrollTop).toBe(110);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps member cards clickable without starting viewport panning", () => {
    render(<OrganizationChart members={[member]} />);
    const card = screen.getByRole("button", { name: /しろくま/ });
    const pointerDown = new Event("pointerdown", { bubbles: true });
    Object.defineProperties(pointerDown, {
      pointerId: { value: 1 }, pointerType: { value: "touch" }, button: { value: 0 },
      clientX: { value: 100 }, clientY: { value: 100 },
    });
    fireEvent(card, pointerDown);
    fireEvent.click(card);
    expect(screen.getByRole("dialog", { name: "しろくま" })).toBeInTheDocument();
  });
});
