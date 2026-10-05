import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/components/minecraft-map", () => ({
  MinecraftMap: ({ mapHistoryEnabled, blueMapEnabled }: { mapHistoryEnabled: boolean; blueMapEnabled: boolean }) => <div data-testid="map" data-history-enabled={mapHistoryEnabled} data-bluemap-enabled={blueMapEnabled} />,
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
    expect(screen.getByTestId("map")).toHaveAttribute("data-bluemap-enabled", "false");
  });

  it("enables BlueMap for Premium Supporters but not Standard Supporters", async () => {
    vi.mocked(getMySupporterTier).mockResolvedValue("standard");
    render(await MapPage());
    expect(screen.getByTestId("map")).toHaveAttribute("data-bluemap-enabled", "false");
    cleanup();

    vi.mocked(getMySupporterTier).mockResolvedValue("premium");
    render(await MapPage());
    expect(screen.getByTestId("map")).toHaveAttribute("data-bluemap-enabled", "true");
  });

  it("enables BlueMap for administrators without a Premium subscription", async () => {
    vi.mocked(getSession).mockResolvedValue({ accessToken: "admin-token", user: { id: "admin", isAdmin: true } } as never);
    vi.mocked(getMySupporterTier).mockResolvedValue(null);
    render(await MapPage());
    expect(screen.getByTestId("map")).toHaveAttribute("data-bluemap-enabled", "true");
  });
});
