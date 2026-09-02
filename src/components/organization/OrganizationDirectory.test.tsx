import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { OrganizationMember, OrganizationSection } from "@/types";

import { OrganizationDirectory } from "./OrganizationDirectory";

const members: OrganizationMember[] = [
  {
    profileId: "11111111-1111-4111-8111-111111111111",
    displayName: "建築メンバー",
    bio: "街づくりを担当しています。",
    role: "team_member",
    roleLabel: "チームメンバー",
    team: "建築チーム",
    xboxGamertag: "LinkedXbox",
    groupId: "33333333-3333-4333-8333-333333333333",
  },
  {
    profileId: "22222222-2222-4222-8222-222222222222",
    displayName: "運営メンバー",
    bio: "運営を担当しています。",
    role: "administrator",
    roleLabel: "管理者",
    team: "運営",
    xboxGamertag: "GuestXbox",
    groupId: "44444444-4444-4444-8444-444444444444",
    highlighted: true,
    supporterTier: "premium",
  },
];
const sections: OrganizationSection[] = [
  { id: "55555555-5555-4555-8555-555555555555", title: "運営管理", description: "運営", groups: [{ id: "44444444-4444-4444-8444-444444444444", label: "管理者", caption: "企画", color: "violet" }] },
  { id: "66666666-6666-4666-8666-666666666666", title: "チーム", description: "活動", groups: [{ id: "33333333-3333-4333-8333-333333333333", label: "建築チーム", caption: "活動チーム", color: "blue" }] },
];

afterEach(cleanup);

describe("OrganizationDirectory", () => {
  it("shows compact profile cards with their group colors", () => {
    render(<OrganizationDirectory members={members} sections={sections} />);
    expect(screen.getByRole("heading", { name: "建築メンバー" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "運営メンバー" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /建築メンバー/ })).toHaveAttribute("data-color", "blue");
    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.queryByText("Premium Supporter")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /運営メンバー/ })).toHaveAttribute("data-supporter-tier", "premium");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /建築メンバー/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("街づくりを担当しています。");
    expect(dialog).toHaveTextContent("LinkedXbox");
    expect(dialog).toHaveTextContent("プロフィールページはありません");
    expect(within(dialog).getAllByText("建築チーム", { exact: true })).toHaveLength(1);
    expect(screen.queryByText("SNS")).not.toBeInTheDocument();
    expect(screen.queryByText("好きなブロック")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "詳細を閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("places supporters first in descending tier order", () => {
    const tieredMembers: OrganizationMember[] = [
      members[0],
      { ...members[0], profileId: "77777777-7777-4777-8777-777777777777", displayName: "通常メンバー2" },
      { ...members[0], profileId: "88888888-8888-4888-8888-888888888888", displayName: "Supporterメンバー", supporterTier: "supporter", highlighted: true },
      { ...members[0], profileId: "99999999-9999-4999-8999-999999999999", displayName: "Basicメンバー", supporterTier: "basic", highlighted: true },
      { ...members[0], profileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", displayName: "Standardメンバー", supporterTier: "standard", highlighted: true },
      members[1],
    ];
    const { container } = render(<OrganizationDirectory members={tieredMembers} sections={sections} />);

    const cards = [...container.querySelectorAll<HTMLButtonElement>('button[data-role]')];
    expect(cards.map((card) => card.dataset.supporterTier ?? "none")).toEqual(["premium", "standard", "basic", "supporter", "none", "none"]);
  });

  it("switches to the roles and teams tab", () => {
    render(<OrganizationDirectory members={members} sections={sections} />);
    fireEvent.click(screen.getByRole("tab", { name: /役割・所属/ }));
    expect(screen.queryByRole("heading", { name: "役割・所属をひと目で" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "運営管理" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "チーム" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "建築チーム" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "建築チーム" }).closest("section")).toHaveAttribute("data-color", "blue");
    expect(screen.getByRole("heading", { name: "管理者" })).toBeInTheDocument();
    expect(screen.queryByText("＋")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /役割・所属/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: /建築メンバー/ }));
    expect(screen.getByRole("dialog", { name: "建築メンバー" })).toBeInTheDocument();
  });
});
