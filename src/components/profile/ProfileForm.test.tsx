import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "./ProfileForm";

const routerMocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

describe("ProfileForm", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    routerMocks.push.mockReset();
    routerMocks.refresh.mockReset();
  });

  it("submits an optional Xbox gamertag", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: { id: "profile", displayName: "Player", bio: "", xboxGamertag: "ExamplePlayer" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<ProfileForm profile={{ id: "profile", displayName: "Player", bio: "" }} />);
    const gamertag = screen.getByRole("textbox", { name: "Xbox ゲーマータグ" });
    expect(gamertag).not.toBeRequired();
    fireEvent.change(gamertag, { target: { value: " ExamplePlayer " } });

    fireEvent.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request?.body).toBeInstanceOf(FormData);
    expect((request?.body as FormData).get("xboxGamertag")).toBe("ExamplePlayer");
  });
});
