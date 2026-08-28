import { describe, expect, it } from "vitest";
import { dynmapTilePath, dynmapToMinecraft, minecraftToDynmap } from "./coordinates";
import type { DynmapMapDefinition } from "./types";

const flatMap: DynmapMapDefinition = {
  name: "flat",
  prefix: "flat",
  mapzoomin: 1,
  mapzoomout: 5,
  tilescale: 0,
  "image-format": "jpg",
  worldtomap: [4, 0, 0, 0, 0, -4, 0, 1, 0],
  maptoworld: [0.25, 0, 0, 0, 0, 1, 0, -0.25, 0],
};

describe("Dynmap coordinates", () => {
  it("round-trips Minecraft X/Z coordinates", () => {
    const location = { x: 128, y: 64, z: -320 };
    const point = minecraftToDynmap(location, flatMap);
    const result = dynmapToMinecraft(point, location.y, flatMap);

    expect(result.x).toBeCloseTo(location.x);
    expect(result.z).toBeCloseTo(location.z);
  });

  it("matches Dynmap HD tile file naming", () => {
    expect(dynmapTilePath({ x: 2, y: 3, z: 6 }, flatMap)).toBe("flat/0_-1/2_-3.jpg");
    expect(dynmapTilePath({ x: -1, y: 1, z: 4 }, flatMap)).toBe("flat/-1_-1/z_-2_-2.jpg");
  });
});
