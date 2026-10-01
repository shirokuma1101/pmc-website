import { act, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupportForm } from "./SupportForm";

describe("SupportForm", () => {
  afterEach(() => vi.restoreAllMocks());

  function acceptRequiredConditions(form: ReturnType<typeof within>) {
    fireEvent.click(form.getByRole("checkbox", { name: /私は18歳以上です/ }));
    fireEvent.click(form.getByRole("checkbox", { name: /利用規約/ }));
  }

  it("keeps the application button disabled until both required conditions are checked", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn />);
    const form = within(container.querySelector("form")!);
    const button = form.getByRole("button", { name: "サポーターになる" });
    expect(button).toBeDisabled();
    fireEvent.click(form.getByRole("checkbox", { name: /私は18歳以上です/ }));
    expect(button).toBeDisabled();
    fireEvent.click(form.getByRole("checkbox", { name: /利用規約/ }));
    expect(button).toBeEnabled();
    fireEvent.click(form.getByRole("checkbox", { name: /私は18歳以上です/ }));
    expect(button).toBeDisabled();
  });

  it("offers one-time Supporter badge support for 300 JPY", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn />);
    const form = within(container.querySelector("form")!);
    fireEvent.click(form.getByRole("radio", { name: /Supporter.*¥300/ }));
    acceptRequiredConditions(form);
    expect(form.getByRole("button", { name: "Supporterとして支援する" })).toBeEnabled();
    expect(form.getByRole("radio", { name: /Supporter.*¥300.*税込/ })).toBeChecked();
    expect(new FormData(container.querySelector("form")!).get("frequency")).toBe("one_time");
    expect(new FormData(container.querySelector("form")!).get("tier")).toBe("supporter");
    expect(within(form.getByRole("table")).getByText("Supporterバッジ（支援回数で変化）")).toBeInTheDocument();
    expect(within(form.getByRole("table")).getByRole("rowheader", { name: "支払い方式" }).closest("tr")).toHaveTextContent("1回のみ・自動更新なし");
    expect(form.queryByRole("spinbutton", { name: "有効月数" })).not.toBeInTheDocument();
    expect(form.queryByText(/Standard Supporter特典/)).not.toBeInTheDocument();
    expect(form.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
    expect(form.getByRole("checkbox", { name: /私は18歳以上です/ })).toBeRequired();
  });

  it("requires login for monthly supporter plans", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn={false} />);
    const form = within(container.querySelector("form")!);
    expect(form.getByRole("radio", { name: /Standard Supporter.*¥800/ })).toBeChecked();
    expect(form.getByRole("button", { name: "サポーターになる" })).toBeDisabled();
    expect(form.getByText("サポーターバッジ・特典の付与にはログインが必要です。")).toBeInTheDocument();
    expect(form.getByText(/PayPayは単発サポートでご利用いただけます/)).toBeInTheDocument();
  });

  it("shows the configured monthly prices", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn />);
    const form = within(container.querySelector("form")!);
    expect(form.getByRole("radio", { name: /Basic Supporter.*¥400/ })).toBeInTheDocument();
    expect(form.getByRole("radio", { name: /Standard Supporter.*¥800/ })).toBeInTheDocument();
    expect(form.getByRole("radio", { name: /Premium Supporter.*¥1,500/ })).toBeInTheDocument();
    expect(form.getAllByText("（税込）/ 月")).toHaveLength(3);
    const table = form.getByRole("table", { name: "サポートプランの比較と選択" });
    const badgeRow = within(table).getByRole("rowheader", { name: "プロフィールに表示されるバッジ" }).closest("tr")!;
    expect(within(badgeRow).getByText("Supporterバッジ（支援回数で変化）")).toBeInTheDocument();
    expect(within(badgeRow).getByText("Basic Supporterバッジ")).toBeInTheDocument();
    expect(within(badgeRow).getByText("Standard Supporterバッジ")).toBeInTheDocument();
    expect(within(badgeRow).getByText("Premium Supporterバッジ")).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "メンバー一覧でサポーターとして表示" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "地図の時系列比較を利用可能" })).toBeInTheDocument();
    expect(within(table).getAllByLabelText("利用可能")).toHaveLength(9);
    expect(within(table).getAllByLabelText("対象外")).toHaveLength(7);
    expect(form.queryByText("活動をそっと応援")).not.toBeInTheDocument();
  });

  it("labels future benefits as planned without presenting them as available", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn />);
    const form = within(container.querySelector("form")!);
    const table = form.getByRole("table", { name: "サポートプランの比較と選択" });
    const websiteEarlyAccess = within(table).getByRole("rowheader", { name: "Webサイト新規機能のアーリーアクセス" }).closest("tr")!;
    const botEarlyAccess = within(table).getByRole("rowheader", { name: "Discord bot新規コマンドのアーリーアクセス" }).closest("tr")!;
    const membersContent = within(table).getByRole("rowheader", { name: "会員限定コンテンツへのアクセス" }).closest("tr")!;
    const blueMap = within(table).getByRole("rowheader", { name: "BlueMap(3Dマップ)の利用" }).closest("tr")!;
    for (const row of [websiteEarlyAccess, botEarlyAccess]) {
      expect(within(row).getAllByLabelText("提供予定")).toHaveLength(3);
      expect(within(row).getAllByLabelText("対象外")).toHaveLength(1);
    }
    expect(within(membersContent).getAllByLabelText("提供予定")).toHaveLength(2);
    expect(within(membersContent).getAllByLabelText("対象外")).toHaveLength(2);
    expect(within(blueMap).getAllByLabelText("利用可能")).toHaveLength(1);
    expect(within(blueMap).getByText("✓")).toHaveClass("support-comparison__yes");
    expect(within(blueMap).getAllByLabelText("対象外")).toHaveLength(3);
    expect(form.getByText(/「提供予定」の特典は現在まだ利用できません/)).toBeInTheDocument();

    const mobile = within(container.querySelector(".support-comparison-mobile") as HTMLElement);
    expect(mobile.getByText("Webサイト新規機能のアーリーアクセス").nextElementSibling).toHaveTextContent("提供予定");
    expect(mobile.getByText("Discord bot新規コマンドのアーリーアクセス").nextElementSibling).toHaveTextContent("提供予定");
    expect(mobile.getByText("会員限定コンテンツへのアクセス").nextElementSibling).toHaveTextContent("提供予定");
    expect(mobile.getByText("BlueMap(3Dマップ)の利用").nextElementSibling).toHaveTextContent("対象外");
    fireEvent.click(mobile.getByRole("button", { name: /Basic Supporter.*¥400/ }));
    expect(mobile.getByText("会員限定コンテンツへのアクセス").nextElementSibling).toHaveTextContent("対象外");
    fireEvent.click(mobile.getByRole("button", { name: /Premium Supporter.*¥1,500/ }));
    expect(mobile.getByText("BlueMap(3Dマップ)の利用").nextElementSibling).toHaveTextContent("✓ 利用可能");
  });

  it("updates mobile plan details and checkout fields when a plan card is selected", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn />);
    const form = within(container.querySelector("form")!);
    const mobile = container.querySelector(".support-comparison-mobile")!;
    fireEvent.click(within(mobile as HTMLElement).getByRole("button", { name: /Supporter.*¥300/ }));
    expect(within(mobile as HTMLElement).getByText("1回のみ・自動更新なし")).toBeInTheDocument();
    expect(within(mobile as HTMLElement).getByText("Supporterバッジ（支援回数で変化）")).toBeInTheDocument();
    expect(within(mobile as HTMLElement).getAllByText("✓ 利用可能")).toHaveLength(2);
    expect(new FormData(container.querySelector("form")!).get("frequency")).toBe("one_time");
    expect(form.getByRole("radio", { name: /Supporter.*¥300/ })).toBeChecked();
  });

  it("blocks a monthly resubscription but allows one-time support", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn monthlyStatus="existing" />);
    const form = within(container.querySelector("form")!);
    expect(form.getByRole("button", { name: "新プランに申し込む" })).toBeDisabled();
    fireEvent.click(form.getByRole("radio", { name: /Supporter.*¥300/ }));
    acceptRequiredConditions(form);
    expect(form.getByRole("button", { name: "Supporterとして支援する" })).toBeEnabled();
  });

  it("offers a paid replacement when exactly one current plan is switchable", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn monthlyStatus="existing" currentTier="basic" />);
    const form = within(container.querySelector("form")!);
    acceptRequiredConditions(form);
    expect(form.getByRole("button", { name: "新プランに申し込む" })).toBeEnabled();
    expect(form.getByText(/旧プランは現在の支払済み期間の終了日に解約/)).toBeInTheDocument();
    expect(form.getByRole("link", { name: "マイページで現在のプランを確認" })).toHaveAttribute("href", "/me");
    fireEvent.click(form.getByRole("radio", { name: /Basic Supporter.*¥400/ }));
    expect(form.getByRole("button", { name: "新プランに申し込む" })).toBeDisabled();
  });

  it("submits a replacement through the switch endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "切替手続き中です。" } }), { status: 409 }));
    const { container } = render(<SupportForm checkoutEnabled loggedIn monthlyStatus="existing" currentTier="basic" />);
    acceptRequiredConditions(within(container.querySelector("form")!));
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(await within(container).findByText("切替手続き中です。")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/supporters/switch");
  });

  it("retains selection and shows checkout errors on the form", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { code: "SUBSCRIPTION_EXISTS", message: "既に契約があります。" } }), { status: 409 }));
    const { container } = render(<SupportForm checkoutEnabled loggedIn />);
    const form = within(container.querySelector("form")!);
    acceptRequiredConditions(form);
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(await form.findByRole("alert")).toHaveTextContent("既に契約があります。");
    expect(form.getByRole("radio", { name: /Standard Supporter.*¥800/ })).toBeChecked();
    expect(form.getByRole("button", { name: "サポーターになる" })).toBeEnabled();
  });
});
