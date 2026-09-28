import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CommercialTransactionsPage from "./page";

describe("CommercialTransactionsPage", () => {
  it("shows the operator and confirmed supporter terms", () => {
    render(<CommercialTransactionsPage />);
    expect(screen.getByRole("heading", { name: "特定商取引法に基づく表記" })).toBeInTheDocument();
    expect(screen.getByText("販売事業者")).toBeInTheDocument();
    expect(screen.getByText("所在地")).toBeInTheDocument();
    expect(screen.getByText("電話番号")).toBeInTheDocument();
    expect(screen.getByText("表示額以外に当方から請求する費用はありません。")).toBeInTheDocument();
    expect(screen.getByText(/Stripeで有効化されている方法のうち/)).toBeInTheDocument();
    expect(screen.getByText(/単発サポート：300円（税込）。月額：Basic 400円（税込）、Standard 800円（税込）、Premium 1,500円（税込）。/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "お問い合わせフォーム" })).toHaveAttribute("href", "/contact");
  });
});
