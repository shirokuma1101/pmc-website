import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DonationForm } from "./DonationForm";

describe("DonationForm", () => {
  it("shows the allowed donation amounts and keeps checkout disabled", () => {
    render(<DonationForm />);

    expect(screen.getByRole("radio", { name: "¥1,000" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "¥2,500" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "¥3,000" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Stripeで寄付する" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("決済機能を準備しています");
  });

  it("accepts a bounded custom amount for a one-time donation", () => {
    const { container } = render(<DonationForm />);
    const form = within(container);

    fireEvent.click(form.getByRole("radio", { name: "任意の金額" }));
    const customAmount = form.getByRole("spinbutton", { name: "任意の寄付金額" });
    fireEvent.change(customAmount, { target: { value: "2500" } });

    expect(customAmount).toBeEnabled();
    expect(customAmount).toHaveValue(2500);
    expect(customAmount).toHaveAttribute("min", "300");
    expect(customAmount).toHaveAttribute("max", "10000");
    expect(form.getByRole("radio", { name: "任意の金額" })).toBeChecked();
  });

  it("switches to a fixed monthly donation", () => {
    const { container } = render(<DonationForm />);
    const form = within(container);

    fireEvent.click(form.getByRole("button", { name: "毎月の寄付" }));

    expect(form.getByRole("button", { name: "毎月の寄付" })).toHaveAttribute("aria-pressed", "true");
    expect(form.getByRole("group", { name: "寄付の頻度" })).toBeInTheDocument();
    expect(form.getByText("毎月、選択した金額で活動を支援します")).toBeInTheDocument();
    expect(form.getByRole("button", { name: "毎月の寄付を始める" })).toBeDisabled();
    expect(container.querySelector('input[name="frequency"]')).toHaveValue("monthly");
  });
});
