import { describe, expect, it } from "vitest";
import { dynmapWorldIdentity, groupDynmapWorlds } from "./dynmap";
import type { DynmapWorldDefinition } from "./types";

const world = (name: string, title?: string): DynmapWorldDefinition => ({ name, title, maps: [] });

describe("Dynmap world grouping", () => {
  it("separates a map set from its dimensions", () => {
    expect(dynmapWorldIdentity("season7_nether")).toEqual({ setId: "season7", dimension: "nether" });
    expect(dynmapWorldIdentity("season7_the_end")).toEqual({ setId: "season7", dimension: "the_end" });
    expect(dynmapWorldIdentity("season7")).toEqual({ setId: "season7", dimension: "overworld" });
  });

  it("groups multiple map sets and orders their dimensions", () => {
    const groups = groupDynmapWorlds({ worlds: [
      world("season6_nether"), world("season7", "Season 7"), world("season6", "Season 6"), world("season6_the_end"),
    ] });
    expect(groups.map((group) => group.title)).toEqual(["Season 6", "Season 7"]);
    expect(groups[0]?.worlds.map((entry) => entry.dimension)).toEqual(["overworld", "nether", "the_end"]);
  });
});
