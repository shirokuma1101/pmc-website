import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrganizationAccountOption, OrganizationMember } from "@/types";

import { OrganizationEditor } from "./OrganizationEditor";

const manager: OrganizationMember = {
  profileId: "11111111-1111-4111-8111-111111111111",
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  displayName: "運営メンバー",
  bio: "運営を担当しています。",
  role: "administrator",
  roleLabel: "管理者",
  team: "運営",
  xboxGamertag: "ManagerXbox",
  groupId: "44444444-4444-4444-8444-444444444444",
};

const builder: OrganizationMember = {
  profileId: "22222222-2222-4222-8222-222222222222",
  displayName: "建築メンバー",
  bio: "街づくりを担当しています。",
  role: "team_member",
  roleLabel: "チームメンバー",
  team: "建築チーム",
  parentId: manager.profileId,
  xboxGamertag: "BuilderXbox",
  groupId: "33333333-3333-4333-8333-333333333333",
};

const accounts: OrganizationAccountOption[] = [{
  id: manager.userId!,
  displayName: "運営アカウント",
  email: "manager@example.com",
  organizationMemberId: manager.profileId,
}];
const sections = [
  { id: "55555555-5555-4555-8555-555555555555", title: "運営・担当", description: "運営", groups: [{ id: "44444444-4444-4444-8444-444444444444", label: "管理者", caption: "企画", color: "violet" as const }] },
  { id: "66666666-6666-4666-8666-666666666666", title: "チーム", description: "活動", groups: [{ id: "33333333-3333-4333-8333-333333333333", label: "建築チーム", caption: "活動チーム", color: "blue" as const }] },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OrganizationEditor", () => {
  it("separates profile editing from roles and teams editing", () => {
    render(<OrganizationEditor members={[manager, builder]} initialSections={sections} accounts={accounts} />);

    expect(screen.getByRole("tab", { name: /プロフィール一覧/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "プロフィールを管理" })).toBeInTheDocument();
    const inspector = screen.getByRole("complementary", { name: "選択中のメンバーを編集" });
    expect(within(inspector).getByDisplayValue("運営メンバー")).toBeDisabled();
    expect(within(inspector).getByDisplayValue("運営を担当しています。")).toBeDisabled();
    expect(within(inspector).getByDisplayValue("ManagerXbox")).toBeDisabled();
    expect(screen.getByText(/表示名とアイコンが使用されます/)).toBeInTheDocument();
    expect(screen.getAllByText(/変更はプロフィール設定から行ってください/)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /建築メンバー.*詳細を編集/ }));
    expect(within(inspector).getByRole("textbox", { name: "表示名" })).toBeEnabled();
    expect(within(inspector).getByRole("textbox", { name: "紹介文" })).toBeEnabled();
    expect(within(inspector).getByRole("textbox", { name: "Xbox ゲーマータグ" })).toBeEnabled();
    expect(within(inspector).queryByRole("group", { name: "リンク" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /役割・所属/ }));

    expect(screen.getByRole("heading", { name: "役割・所属を編集" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "運営・担当" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "チーム" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "建築チーム" })).toBeInTheDocument();
    expect(screen.queryByText("manager@example.com")).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("region", { name: "運営・担当" })).getAllByRole("button", { name: "変更" })[0]);
    expect(screen.getByRole("textbox", { name: "名前" })).toHaveValue("運営・担当");
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    fireEvent.click(within(screen.getByRole("region", { name: "運営・担当" })).getByRole("button", { name: "項目追加" }));
    expect(screen.getByRole("textbox", { name: "名前" })).toHaveValue("");
  });

  it("deletes only the public member and clears local parent references", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<OrganizationEditor members={[manager, builder]} initialSections={sections} accounts={accounts} />);

    fireEvent.click(screen.getByRole("button", { name: "メンバーを削除" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/organization/${manager.profileId}`,
      { method: "DELETE", credentials: "include" },
    ));
    expect(screen.queryByRole("button", { name: /運営メンバー.*詳細を編集/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "建築メンバー" })).toBeInTheDocument();
    expect(screen.queryByText("上位メンバー")).not.toBeInTheDocument();
    expect(screen.getByText(/アカウントは保持されています/)).toBeInTheDocument();
  });

  it("adds and deletes arbitrary sections", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<OrganizationEditor members={[manager, builder]} initialSections={sections} accounts={accounts} />);
    fireEvent.click(screen.getByRole("tab", { name: /役割・所属/ }));

    fireEvent.change(screen.getByRole("textbox", { name: "グループを追加" }), { target: { value: "イベント担当" } });
    fireEvent.click(screen.getByRole("button", { name: "グループを追加" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "イベント担当" })).toBeInTheDocument());

    fireEvent.click(within(screen.getByRole("region", { name: "運営・担当" })).getAllByRole("button", { name: "削除" })[0]);
    await waitFor(() => expect(screen.queryByRole("region", { name: "運営・担当" })).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("saves a group color selected from the theme palette", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<OrganizationEditor members={[manager, builder]} initialSections={sections} accounts={accounts} />);
    fireEvent.click(screen.getByRole("tab", { name: /役割・所属/ }));

    const section = screen.getByRole("region", { name: "運営・担当" });
    fireEvent.click(within(section).getAllByRole("button", { name: "変更" })[1]);
    expect(screen.getByRole("radio", { name: "バイオレット" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: "ブルー" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "ティール" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "ゴールド" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "スレート" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "グループカラー" })).getAllByRole("radio")).toHaveLength(7);
    fireEvent.click(screen.getByRole("radio", { name: "プラム" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/organization/layout",
      expect.objectContaining({ body: expect.stringContaining('"color":"plum"') }),
    ));
  });

  it("manually selects a supporter tier", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { supporterTier: "basic", highlighted: true } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<OrganizationEditor members={[manager]} initialSections={sections} accounts={accounts} />);

    fireEvent.click(screen.getByRole("radio", { name: /^Basic / }));
    fireEvent.click(screen.getByRole("button", { name: "表記を保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/organization/${manager.profileId}/supporter`,
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ tier: "basic" }) }),
    ));
    expect(screen.getByRole("radio", { name: /^Basic / })).toBeChecked();
    expect(screen.getByText("サポーター表記を保存しました。")).toBeInTheDocument();
  });
});
