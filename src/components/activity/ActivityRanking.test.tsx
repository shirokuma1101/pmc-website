import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityRanking } from "./ActivityRanking";

describe("ActivityRanking", () => {
  it("renders ranks, member links, scores, and the scoring rules", () => {
    render(<ActivityRanking ranking={{
      since: "2026-05-26T00:00:00.000Z",
      until: "2026-08-01T00:00:00.000Z",
      entries: [
        { rank: 1, user: { id: "member-1", displayName: "Builder" }, activityExp: 42 },
        { rank: 2, user: { id: "member-2", displayName: "Miner" }, activityExp: 15 },
      ],
    }} />);

    expect(screen.getByRole("heading", { name: "活動ランキング" })).toBeInTheDocument();
    expect(screen.getByLabelText("1位")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Builder/ })).toHaveAttribute("href", "/members/member-1");
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("集計期間: 2026/5/26〜2026/7/31")).toBeInTheDocument();
    expect(screen.getByText("Article 10 · Post 5 · Like 1 Exp")).toBeInTheDocument();
  });

  it("renders an empty state when there is no recent activity", () => {
    render(<ActivityRanking ranking={{
      entries: [],
      since: "2026-06-01T00:00:00.000Z",
      until: "2026-09-01T00:00:00.000Z",
    }} />);
    expect(screen.getByText("直近3か月の活動はまだありません。")).toBeInTheDocument();
  });
});
