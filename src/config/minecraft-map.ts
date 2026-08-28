const tileBaseUrl = process.env.NEXT_PUBLIC_MINECRAFT_MAP_URL || "/minecraft-map";

export const minecraftMapConfig = {
  tileBaseUrl,
  configurationUrl:
    process.env.NEXT_PUBLIC_MINECRAFT_MAP_CONFIG_URL
    || `${tileBaseUrl.replace(/\/$/, "")}/up/configuration`,
  catalogUrl: `${tileBaseUrl.replace(/\/$/, "")}/catalog.json`,
  defaultWorld: process.env.NEXT_PUBLIC_MINECRAFT_DEFAULT_WORLD || "world",
  defaultMap: process.env.NEXT_PUBLIC_MINECRAFT_DEFAULT_MAP || "flat",
  projectionY: 64,
} as const;
