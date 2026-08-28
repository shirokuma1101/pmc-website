import type {
  DynmapMapDefinition,
  DynmapPoint,
  DynmapTileCoordinates,
  MinecraftLocation,
} from "./types";

export function minecraftToDynmap(
  location: MinecraftLocation,
  map: DynmapMapDefinition,
): DynmapPoint {
  const worldToMap = map.worldtomap;
  const projectedLat = worldToMap[3] * location.x
    + worldToMap[4] * location.y
    + worldToMap[5] * location.z;
  const projectedLng = worldToMap[0] * location.x
    + worldToMap[1] * location.y
    + worldToMap[2] * location.z;
  const tileSize = 128 << (map.tilescale ?? 0);
  const scale = 1 << map.mapzoomout;

  return {
    lat: -((tileSize - projectedLat) / scale),
    lng: projectedLng / scale,
  };
}

export function dynmapToMinecraft(
  point: DynmapPoint,
  y: number,
  map: DynmapMapDefinition,
): MinecraftLocation {
  const mapToWorld = map.maptoworld;
  const tileSize = 128 << (map.tilescale ?? 0);
  const scale = 1 << map.mapzoomout;
  const projectedLat = tileSize + point.lat * scale;
  const projectedLng = point.lng * scale;

  return {
    x: mapToWorld[0] * projectedLng + mapToWorld[1] * projectedLat + mapToWorld[2] * y,
    y,
    z: mapToWorld[6] * projectedLng + mapToWorld[7] * projectedLat + mapToWorld[8] * y,
  };
}

export function dynmapTilePath(
  coordinates: DynmapTileCoordinates,
  map: DynmapMapDefinition,
): string {
  const maxZoom = map.mapzoomin + map.mapzoomout;
  const invertedZoom = maxZoom - coordinates.z;
  const zoomOutLevel = Math.max(0, invertedZoom - map.mapzoomin);
  const scale = 1 << zoomOutLevel;
  const x = scale * coordinates.x;
  const y = -(scale * coordinates.y);
  const scaledX = x >> 5;
  const scaledY = y >> 5;
  const zoomPrefix = zoomOutLevel === 0 ? "" : `${"z".repeat(zoomOutLevel)}_`;
  const format = map["image-format"] || "png";

  return `${map.prefix}/${scaledX}_${scaledY}/${zoomPrefix}${x}_${y}.${format}`;
}
