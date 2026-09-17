import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JoinApplicationReviewList } from "./JoinApplicationReviewList";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const application = {
  id: "7e06c851-552d-45e7-8d3e-a8f07636213c",
  displayName: "てすとさん",
  email: "join@example.com",
  minecraftGamertag: "TestPlayer",
  discordUsername: "test_user",
  motivation: "参加したいです。",
  status: "pending" as const,
  decisionMessage: null,
  createdAt: "2026-09-17T09:00:00.000Z",
  decidedAt: null,
};

describe("JoinApplicationReviewList", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("uses the standard confirmation popup before sending a decision", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { decided: true } }), { status: 200 }));
    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<JoinApplicationReviewList applications={[application]} />);

    fireEvent.click(screen.getByRole("button", { name: "承認してメール送信" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining("join@example.comへ結果メールを送信"));

    confirmMock.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "承認してメール送信" }));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(application.id), expect.objectContaining({ method: "POST" }));
  });
});
