import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SupportForm } from "./SupportForm";

describe("SupportForm", () => {
  it("offers one-time Supporter badge support for 300 JPY", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn />);
    const form = within(container.querySelector("form")!);
    fireEvent.click(form.getByRole("button", { name: "1回の支援" }));
    expect(form.getByRole("button", { name: "Supporterとして支援する" })).toBeEnabled();
    expect(form.getByRole("radio", { name: /^Supporter.*¥300.*Supporterバッジのみ/ })).toBeChecked();
    expect(form.getByText(/Supporterバッジのみ/)).toBeInTheDocument();
    expect(form.queryByRole("spinbutton", { name: "有効月数" })).not.toBeInTheDocument();
    expect(form.queryByText(/Standard Supporter特典/)).not.toBeInTheDocument();
  });

  it("requires login for monthly supporter plans", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn={false} />);
    const form = within(container.querySelector("form")!);
    expect(form.getByRole("button", { name: "月額サポーター" })).toHaveAttribute("aria-pressed", "true");
    expect(form.getByRole("button", { name: "サポーターになる" })).toBeDisabled();
    expect(form.getByText("月額サポーターへの加入にはログインが必要です。")).toBeInTheDocument();
    expect(form.getByText(/PayPayをご希望の場合は、1回支援をご利用ください/)).toBeInTheDocument();
  });

  it("shows the configured monthly prices", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn />);
    const form = within(container.querySelector("form")!);
    expect(form.getByRole("radio", { name: /Basic Supporter.*¥400/ })).toBeInTheDocument();
    expect(form.getByRole("radio", { name: /Standard Supporter.*¥800/ })).toBeInTheDocument();
    expect(form.getByRole("radio", { name: /Premium Supporter.*¥1,500/ })).toBeInTheDocument();
    expect(form.getByText("Basic Supporterバッジ（非表示設定可）")).toBeInTheDocument();
    expect(form.getByText("Standard Supporterバッジ（非表示設定可）")).toBeInTheDocument();
    expect(form.getByText("Premium Supporterバッジ（非表示設定可）")).toBeInTheDocument();
    expect(form.getAllByText("地図の時系列比較を利用可能")).toHaveLength(3);
    expect(form.queryByText("活動をそっと応援")).not.toBeInTheDocument();
  });
});
