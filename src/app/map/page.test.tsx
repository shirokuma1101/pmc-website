import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/components/minecraft-map", () => ({
  MinecraftMap: ({ mapHistoryEnabled }: { mapHistoryEnabled: boolean }) => <div data-testid="map" data-history-enabled={mapHistoryEnabled} />,
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/directus/organization", () => ({ getMySupporterTier: vi.fn() }));

import { getSession } from "@/lib/auth/session";
import { getMySupporterTier } from "@/lib/directus/organization";
import MapPage from "./page";

describe("MapPage history entitlement", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.mocked(getSession).mockReset().mockResolvedValue({ accessToken: "token", user: { id: "member", isAdmin: false } } as never);
    vi.mocked(getMySupporterTier).mockReset().mockResolvedValue(null);
  });

  it("enables history for a one-time Supporter", async () => {
    vi.mocked(getMySupporterTier).mockResolvedValue("supporter");
    render(await MapPage());
    expect(screen.getByTestId("map")).toHaveAttribute("data-history-enabled", "true");
  });

  it("keeps history unavailable without a supporter entitlement", async () => {
    render(await MapPage());
    expect(screen.getByTestId("map")).toHaveAttribute("data-history-enabled", "false");
  });
});
