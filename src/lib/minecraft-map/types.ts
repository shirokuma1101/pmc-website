export interface MinecraftLocation {
  x: number;
  y: number;
  z: number;
}

export interface DynmapPoint {
  lat: number;
  lng: number;
}

export interface DynmapMapDefinition {
  name: string;
  title?: string;
  prefix: string;
  mapzoomin: number;
  mapzoomout: number;
  tilescale?: number;
  worldtomap: number[];
  maptoworld: number[];
  "image-format"?: string;
}

export interface DynmapWorldDefinition {
  name: string;
  title?: string;
  center?: MinecraftLocation;
  maps: DynmapMapDefinition[];
}

export interface DynmapConfiguration {
  worlds: DynmapWorldDefinition[];
}

export type MinecraftDimension = "overworld" | "nether" | "the_end";

export interface DynmapWorldSet {
  id: string;
  title: string;
  worlds: Array<{ dimension: MinecraftDimension; world: DynmapWorldDefinition }>;
}

export interface DynmapTileCoordinates {
  x: number;
  y: number;
  z: number;
}

export interface MinecraftMapSnapshot {
  id: string;
  label: string;
  createdAt: string;
  baseUrl: string;
}

export interface MinecraftMapCatalogWorld {
  id: string;
  name: string;
  currentSnapshot: string;
  snapshots: MinecraftMapSnapshot[];
}

export interface MinecraftMapCatalog {
  version: 1;
  updatedAt: string;
  worlds: MinecraftMapCatalogWorld[];
}
