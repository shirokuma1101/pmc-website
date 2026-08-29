import type {
  DynmapConfiguration,
  DynmapMapDefinition,
  DynmapWorldDefinition,
  DynmapWorldSet,
  MinecraftDimension,
} from "./types";

const DIMENSION_SUFFIXES: Array<{ suffix: string; dimension: MinecraftDimension }> = [
  { suffix: "_the_end", dimension: "the_end" },
  { suffix: "_nether", dimension: "nether" },
];

export function dynmapWorldIdentity(name: string): { setId: string; dimension: MinecraftDimension } {
  const match = DIMENSION_SUFFIXES.find(({ suffix }) => name.endsWith(suffix));
  return match
    ? { setId: name.slice(0, -match.suffix.length), dimension: match.dimension }
    : { setId: name, dimension: "overworld" };
}

export function groupDynmapWorlds(configuration: DynmapConfiguration): DynmapWorldSet[] {
  const groups = new Map<string, DynmapWorldSet>();
  for (const world of configuration.worlds) {
    const identity = dynmapWorldIdentity(world.name);
    const group = groups.get(identity.setId) ?? { id: identity.setId, title: identity.setId, worlds: [] };
    group.worlds.push({ dimension: identity.dimension, world });
    if (identity.dimension === "overworld") group.title = world.title || world.name;
    groups.set(identity.setId, group);
  }
  const order: Record<MinecraftDimension, number> = { overworld: 0, nether: 1, the_end: 2 };
  return [...groups.values()].map((group) => ({
    ...group,
    worlds: group.worlds.sort((left, right) => order[left.dimension] - order[right.dimension]),
  }));
}

function joinUrl(...parts: string[]): string {
  return parts
    .map((part, index) => index === 0 ? part.replace(/\/$/, "") : part.replace(/^\/+|\/+$/g, ""))
    .join("/");
}

export function dynmapTileUrl(
  baseUrl: string,
  worldName: string,
  tilePath: string,
): string {
  return joinUrl(baseUrl, "tiles", encodeURIComponent(worldName), tilePath);
}

export function findWorld(
  configuration: DynmapConfiguration,
  requestedWorld: string,
): DynmapWorldDefinition | undefined {
  return configuration.worlds.find((world) => world.name === requestedWorld)
    ?? configuration.worlds[0];
}

export function findMap(
  world: DynmapWorldDefinition,
  requestedMap: string,
): DynmapMapDefinition | undefined {
  return world.maps.find((map) => map.name === requestedMap)
    ?? world.maps.find((map) => map.name === "flat")
    ?? world.maps[0];
}
