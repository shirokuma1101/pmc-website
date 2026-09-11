import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SupportForm } from "./SupportForm";

describe("SupportForm", () => {
  it("offers one-time Standard Supporter benefits for 800 JPY", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn />);
    const form = within(container.querySelector("form")!);
    fireEvent.click(form.getByRole("button", { name: "1回の支援" }));
    expect(form.getByRole("button", { name: "Standard Supporterになる" })).toBeEnabled();
    expect(form.getByRole("radio", { name: /Standard Supporter.*¥800.*1か月/ })).toBeChecked();
    const quantity = form.getByRole("spinbutton", { name: "有効月数" });
    expect(quantity).toHaveAttribute("min", "1");
    expect(quantity).toHaveAttribute("max", "12");
    fireEvent.change(quantity, { target: { value: "3" } });
    expect(form.getByText(/合計 ¥2,400/)).toBeInTheDocument();
  });

  it("requires login for monthly supporter plans", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn={false} />);
    const form = within(container.querySelector("form")!);
    expect(form.getByRole("button", { name: "月額サポーター" })).toHaveAttribute("aria-pressed", "true");
    expect(form.getByRole("button", { name: "サポーターになる" })).toBeDisabled();
    expect(form.getByText("月額サポーターへの加入にはログインが必要です。")).toBeInTheDocument();
  });

  it("shows the configured monthly prices", () => {
    const { container } = render(<SupportForm checkoutEnabled loggedIn />);
    const form = within(container.querySelector("form")!);
    expect(form.getByRole("radio", { name: /Basic Supporter.*¥300/ })).toBeInTheDocument();
    expect(form.getByRole("radio", { name: /Standard Supporter.*¥800/ })).toBeInTheDocument();
    expect(form.getByRole("radio", { name: /Premium Supporter.*¥1,500/ })).toBeInTheDocument();
  });
});
