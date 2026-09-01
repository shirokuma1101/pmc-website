"use client";

import "leaflet/dist/leaflet.css";

import type { LatLng, LayerGroup, LeafletMouseEvent, Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { minecraftMapConfig } from "@/config/minecraft-map";
import {
  dynmapTilePath,
  dynmapToMinecraft,
  minecraftToDynmap,
} from "@/lib/minecraft-map/coordinates";
import { dynmapTileUrl, dynmapWorldIdentity, findMap, findWorld, groupDynmapWorlds } from "@/lib/minecraft-map/dynmap";
import type {
  DynmapConfiguration,
  DynmapMapDefinition,
  MinecraftMapCatalog,
  MinecraftLocation,
} from "@/lib/minecraft-map/types";
import type { MinecraftMapMarker } from "@/lib/minecraft-map/markers";
import type { MinecraftMapPath, MinecraftMapPathKind, MinecraftMapPathPoint } from "@/lib/minecraft-map/paths";
import type { SessionUser } from "@/types";
import styles from "./MinecraftMap.module.css";
import { MapTimeline } from "./MapTimeline";

interface MapPosition {
  x: number;
  z: number;
  zoom: number;
}

function finiteQueryValue(search: URLSearchParams, key: string, fallback: number): number {
  const rawValue = search.get(key);
  if (rawValue === null || rawValue.trim() === "") return fallback;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

function initialPosition(): MapPosition {
  const search = new URLSearchParams(window.location.search);
  return {
    x: finiteQueryValue(search, "x", 0),
    z: finiteQueryValue(search, "z", 0),
    zoom: finiteQueryValue(search, "zoom", 3),
  };
}

function mapLabel(map: DynmapMapDefinition): string {
  if (map.name === "flat") return "平面";
  if (map.name === "surface") return "3D 地表";
  if (map.name === "cave") return "洞窟";
  if (map.name === "nether") return "3D ネザー";
  if (map.name === "the_end") return "3D エンド";
  return map.title || map.name;
}

function selectableMaps(world: { maps: DynmapMapDefinition[] }): DynmapMapDefinition[] {
  return world.maps.filter((map) => map.name !== "cave");
}

function selectableMap(world: { maps: DynmapMapDefinition[] }, requestedMap: string) {
  const maps = selectableMaps(world);
  return maps.find((map) => map.name === requestedMap)
    ?? maps.find((map) => map.name === "flat")
    ?? maps[0];
}

interface MarkerDraft {
  id?: string;
  name: string;
  description: string;
  x: number;
  y: string;
  z: number;
  icon: string;
  color: string;
  imageId: string | null;
  imageUrl?: string;
  relatedType: "post" | "article" | null;
  relatedId: string | null;
}

interface MarkerMediaOption {
  key: string;
  imageId: string;
  imageUrl: string;
  relatedType: "post" | "article";
  relatedId: string;
  label: string;
  href: string;
}

interface PathDraft {
  id?: string;
  name: string;
  description: string;
  kind: MinecraftMapPathKind;
  color: string;
  weight: number;
  dashed: boolean;
  points: MinecraftMapPathPoint[];
}

const MARKER_ICONS = [
  { value: "place", label: "地点", symbol: "●" },
  { value: "home", label: "拠点", symbol: "⌂" },
  { value: "build", label: "建築", symbol: "◆" },
  { value: "resource", label: "資源", symbol: "✦" },
];

const PATH_KINDS: Array<{ value: MinecraftMapPathKind; label: string; color: string }> = [
  { value: "road", label: "道路", color: "#d97706" },
  { value: "railway", label: "線路", color: "#334155" },
  { value: "other", label: "その他", color: "#2563eb" },
];

function pathKindLabel(kind: MinecraftMapPathKind) {
  return PATH_KINDS.find((candidate) => candidate.value === kind)?.label ?? "その他";
}

function emptyPathDraft(kind: MinecraftMapPathKind = "road"): PathDraft {
  const definition = PATH_KINDS.find((candidate) => candidate.value === kind) ?? PATH_KINDS[0];
  return { name: "", description: "", kind, color: definition.color, weight: kind === "railway" ? 5 : 4, dashed: kind === "railway", points: [] };
}

function markerSymbol(icon: string) {
  return MARKER_ICONS.find((candidate) => candidate.value === icon)?.symbol ?? "●";
}

export function MinecraftMap({ currentUser }: { currentUser: SessionUser | null }) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const draftMarkerRef = useRef<LeafletMarker | null>(null);
  const pathLayerRef = useRef<LayerGroup | null>(null);
  const draftPathLayerRef = useRef<LayerGroup | null>(null);
  const currentLocationRef = useRef<MinecraftLocation>({ x: 0, y: 64, z: 0 });
  const [configuration, setConfiguration] = useState<DynmapConfiguration | null>(null);
  const [catalog, setCatalog] = useState<MinecraftMapCatalog | null | undefined>(undefined);
  const [logicalWorldId, setLogicalWorldId] = useState(minecraftMapConfig.defaultWorld);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [activeTileBaseUrl, setActiveTileBaseUrl] = useState(minecraftMapConfig.tileBaseUrl);
  const [worldName, setWorldName] = useState(minecraftMapConfig.defaultWorld);
  const [mapName, setMapName] = useState(minecraftMapConfig.defaultMap);
  const [coordinates, setCoordinates] = useState({ x: 0, z: 0 });
  const [error, setError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<MinecraftMapMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<MinecraftMapMarker | null>(null);
  const [markerDraft, setMarkerDraft] = useState<MarkerDraft | null>(null);
  const [markerMessage, setMarkerMessage] = useState<string | null>(null);
  const [savingMarker, setSavingMarker] = useState(false);
  const [markerLayerVersion, setMarkerLayerVersion] = useState(0);
  const [markersVisible, setMarkersVisible] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [authorFilter, setAuthorFilter] = useState("all");
  const [iconFilter, setIconFilter] = useState("all");
  const [mediaOptions, setMediaOptions] = useState<MarkerMediaOption[]>([]);
  const [markerImageFile, setMarkerImageFile] = useState<File | null>(null);
  const markerDraftRef = useRef<MarkerDraft | null>(null);
  const [paths, setPaths] = useState<MinecraftMapPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<MinecraftMapPath | null>(null);
  const [pathDraft, setPathDraft] = useState<PathDraft | null>(null);
  const [pathMessage, setPathMessage] = useState<string | null>(null);
  const [savingPath, setSavingPath] = useState(false);
  const [pathsVisible, setPathsVisible] = useState(true);
  const [pathKindFilter, setPathKindFilter] = useState("all");
  const [pathAuthorFilter, setPathAuthorFilter] = useState("all");
  const pathDraftRef = useRef<PathDraft | null>(null);

  useEffect(() => {
    markerDraftRef.current = markerDraft;
  }, [markerDraft]);

  useEffect(() => {
    pathDraftRef.current = pathDraft;
  }, [pathDraft]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/map-markers?world=${encodeURIComponent(logicalWorldId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("マーカーを取得できませんでした。");
        return response.json() as Promise<{ data: MinecraftMapMarker[] }>;
      })
      .then((payload) => setMarkers(payload.data))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setMarkerMessage(cause instanceof Error ? cause.message : "マーカーを取得できませんでした。");
      });
    return () => controller.abort();
  }, [logicalWorldId]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/map-paths?world=${encodeURIComponent(logicalWorldId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("道路・線路を取得できませんでした。");
        return response.json() as Promise<{ data: MinecraftMapPath[] }>;
      })
      .then((payload) => setPaths(payload.data))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setPathMessage(cause instanceof Error ? cause.message : "道路・線路を取得できませんでした。");
      });
    return () => controller.abort();
  }, [logicalWorldId]);

  useEffect(() => {
    if (!currentUser) return;
    const controller = new AbortController();
    fetch("/api/map-markers/media-options", { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ data: MarkerMediaOption[] }> : { data: [] })
      .then((payload) => setMediaOptions(payload.data))
      .catch(() => undefined);
    return () => controller.abort();
  }, [currentUser]);

  const markerAuthors = useMemo(() => Array.from(
    new Map(markers.map((marker) => [marker.author.id, marker.author])).values(),
  ).sort((left, right) => left.displayName.localeCompare(right.displayName, "ja")), [markers]);
  const visibleMarkers = useMemo(() => markersVisible ? markers.filter((marker) => (
    (authorFilter === "all" || marker.author.id === authorFilter)
    && (iconFilter === "all" || marker.icon === iconFilter)
  )) : [], [authorFilter, iconFilter, markers, markersVisible]);
  const pathAuthors = useMemo(() => Array.from(
    new Map(paths.map((path) => [path.author.id, path.author])).values(),
  ).sort((left, right) => left.displayName.localeCompare(right.displayName, "ja")), [paths]);
  const visiblePaths = useMemo(() => pathsVisible ? paths.filter((path) => (
    (pathAuthorFilter === "all" || path.author.id === pathAuthorFilter)
    && (pathKindFilter === "all" || path.kind === pathKindFilter)
  )) : [], [pathAuthorFilter, pathKindFilter, paths, pathsVisible]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(minecraftMapConfig.catalogUrl, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`地図一覧の取得に失敗しました (${response.status})`);
        const data = await response.json() as MinecraftMapCatalog;
        if (!Array.isArray(data.worlds) || data.worlds.length === 0) return null;
        const search = new URLSearchParams(window.location.search);
        const requestedWorld = search.get("world") || minecraftMapConfig.defaultWorld;
        const world = data.worlds.find((candidate) => candidate.id === requestedWorld) ?? data.worlds[0]!;
        const requestedSnapshot = search.get("snapshot");
        const snapshot = world.snapshots.find((candidate) => candidate.id === requestedSnapshot)
          ?? world.snapshots.find((candidate) => candidate.id === world.currentSnapshot)
          ?? world.snapshots.at(-1);
        setLogicalWorldId(world.id);
        setSnapshotId(snapshot?.id ?? null);
        return data;
      })
      .then((data) => setCatalog(data))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "地図一覧を読み込めませんでした。");
          setCatalog(null);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (catalog === undefined) return;
    const controller = new AbortController();

    async function loadConfiguration() {
      try {
        const catalogWorld = catalog?.worlds.find((candidate) => candidate.id === logicalWorldId);
        const snapshot = catalogWorld?.snapshots.find((candidate) => candidate.id === snapshotId)
          ?? catalogWorld?.snapshots.find((candidate) => candidate.id === catalogWorld.currentSnapshot)
          ?? catalogWorld?.snapshots.at(-1);
        const tileBaseUrl = snapshot?.baseUrl ?? minecraftMapConfig.tileBaseUrl;
        const configurationUrl = snapshot
          ? `${tileBaseUrl.replace(/\/$/, "")}/standalone/dynmap_config.json`
          : minecraftMapConfig.configurationUrl;
        const response = await fetch(configurationUrl, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`地図設定の取得に失敗しました (${response.status})`);
        const data = await response.json() as DynmapConfiguration;
        if (!Array.isArray(data.worlds) || data.worlds.length === 0) {
          throw new Error("利用できるワールドがありません。");
        }
        const search = new URLSearchParams(window.location.search);
        const requestedWorld = snapshot ? minecraftMapConfig.defaultWorld : search.get("world") || minecraftMapConfig.defaultWorld;
        const requestedSetId = dynmapWorldIdentity(requestedWorld).setId;
        const requestedSet = groupDynmapWorlds(data).find((candidate) => candidate.id === requestedSetId);
        const world = requestedSet?.worlds.find((entry) => entry.dimension === "overworld")?.world
          ?? findWorld(data, requestedSetId);
        if (!world) throw new Error("利用できるワールドがありません。");
        const requestedMap = search.get("map") || minecraftMapConfig.defaultMap;
        const selectedMap = selectableMap(world, requestedMap);
        if (!selectedMap) throw new Error("利用できる地図レイヤーがありません。");
        setWorldName(world.name);
        setMapName(selectedMap.name);
        setActiveTileBaseUrl(tileBaseUrl);
        setConfiguration(data);
        setError(null);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "地図を読み込めませんでした。");
        }
      }
    }

    void loadConfiguration();
    return () => controller.abort();
  }, [catalog, logicalWorldId, snapshotId]);

  useEffect(() => {
    if (!configuration || !mapElementRef.current) return;
    const world = findWorld(configuration, worldName);
    if (!world) return;
    const selectedMap = findMap(world, mapName);
    if (!selectedMap) return;
    const activeWorld = world;
    const activeMap = selectedMap;
    let disposed = false;
    let createdMap: LeafletMap | null = null;

    void import("leaflet").then(({ default: L }) => {
      if (disposed || !mapElementRef.current) return;
      leafletMapRef.current?.remove();

      const maxZoom = activeMap.mapzoomin + activeMap.mapzoomout;
      const position = initialPosition();
      const initialLocation = currentLocationRef.current.x || currentLocationRef.current.z
        ? currentLocationRef.current
        : { x: position.x, y: minecraftMapConfig.projectionY, z: position.z };
      const projectedCenter = minecraftToDynmap(initialLocation, activeMap);
      const leafletMap = L.map(mapElementRef.current, {
        crs: L.CRS.Simple,
        minZoom: 0,
        maxZoom,
        zoomControl: true,
        attributionControl: true,
      });
      leafletMap.attributionControl.setPrefix(false);

      const tileLayer = L.tileLayer("", {
        tileSize: 128 << (activeMap.tilescale ?? 0),
        minZoom: 0,
        maxZoom,
        maxNativeZoom: activeMap.mapzoomout,
        zoomReverse: true,
        noWrap: true,
        attribution: "Minecraft map rendered by Dynmap",
        errorTileUrl: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
      });
      tileLayer.getTileUrl = (tileCoordinates) => dynmapTileUrl(
        activeTileBaseUrl,
        activeWorld.name,
        dynmapTilePath(tileCoordinates, activeMap),
      );
      tileLayer.addTo(leafletMap);
      pathLayerRef.current = L.layerGroup().addTo(leafletMap);
      draftPathLayerRef.current = L.layerGroup().addTo(leafletMap);
      markerLayerRef.current = L.layerGroup().addTo(leafletMap);
      setMarkerLayerVersion((version) => version + 1);
      leafletMap.setView(
        [projectedCenter.lat, projectedCenter.lng],
        Math.min(maxZoom, Math.max(0, position.zoom)),
      );

      function updatePosition(point: LatLng, updateUrl: boolean) {
        const location = dynmapToMinecraft(
          point,
          minecraftMapConfig.projectionY,
          activeMap,
        );
        currentLocationRef.current = location;
        setCoordinates({ x: Math.round(location.x), z: Math.round(location.z) });

        if (updateUrl) {
          const url = new URL(window.location.href);
          url.searchParams.set("world", logicalWorldId);
          if (snapshotId) url.searchParams.set("snapshot", snapshotId);
          else url.searchParams.delete("snapshot");
          url.searchParams.set("map", activeMap.name);
          url.searchParams.set("x", String(Math.round(location.x)));
          url.searchParams.set("z", String(Math.round(location.z)));
          url.searchParams.set("zoom", String(leafletMap.getZoom()));
          window.history.replaceState(null, "", url);
        }
      }

      updatePosition(leafletMap.getCenter(), true);
      leafletMap.on("mousemove", (event: LeafletMouseEvent) => updatePosition(event.latlng, false));
      leafletMap.on("mouseout", () => updatePosition(leafletMap.getCenter(), false));
      leafletMap.on("moveend zoomend", () => updatePosition(leafletMap.getCenter(), true));
      leafletMap.on("click", (event: LeafletMouseEvent) => {
        const currentDraft = pathDraftRef.current;
        if (!currentDraft) return;
        const location = dynmapToMinecraft(event.latlng, minecraftMapConfig.projectionY, activeMap);
        setPathDraft({
          ...currentDraft,
          points: [...currentDraft.points, { x: Math.round(location.x), z: Math.round(location.z) }],
        });
      });
      leafletMap.on("contextmenu", (event: LeafletMouseEvent) => {
        if (pathDraftRef.current) return;
        if (!currentUser) {
          setMarkerMessage("マーカーを追加するにはログインしてください。");
          return;
        }
        const location = dynmapToMinecraft(event.latlng, minecraftMapConfig.projectionY, activeMap);
        setSelectedMarker(null);
        const currentDraft = markerDraftRef.current;
        setMarkerDraft(currentDraft ? {
          ...currentDraft, x: Math.round(location.x), z: Math.round(location.z),
        } : {
          name: "", description: "", x: Math.round(location.x), y: "", z: Math.round(location.z), icon: "place", color: "#d15d36",
          imageId: null, relatedType: null, relatedId: null,
        });
      });
      leafletMapRef.current = leafletMap;
      createdMap = leafletMap;
    });

    return () => {
      disposed = true;
      createdMap?.remove();
      markerLayerRef.current = null;
      pathLayerRef.current = null;
      draftPathLayerRef.current = null;
      draftMarkerRef.current = null;
      if (leafletMapRef.current === createdMap) leafletMapRef.current = null;
    };
  }, [activeTileBaseUrl, configuration, worldName, mapName, currentUser, logicalWorldId, snapshotId]);

  useEffect(() => {
    if (!configuration || !pathLayerRef.current) return;
    const world = findWorld(configuration, worldName);
    const selectedMap = world ? findMap(world, mapName) : undefined;
    if (!selectedMap) return;
    let disposed = false;
    void import("leaflet").then(({ default: L }) => {
      if (disposed || !pathLayerRef.current) return;
      pathLayerRef.current.clearLayers();
      for (const path of visiblePaths) {
        const line = L.polyline(path.points.map((point) => {
          const projected = minecraftToDynmap({ ...point, y: minecraftMapConfig.projectionY }, selectedMap);
          return [projected.lat, projected.lng] as [number, number];
        }), {
          color: path.color,
          weight: path.weight,
          dashArray: path.dashed ? "10 8" : undefined,
          opacity: 0.9,
        });
        line.bindTooltip(path.name, { sticky: true, direction: "top" });
        line.on("click", () => {
          setMarkerDraft(null);
          setSelectedMarker(null);
          setPathDraft(null);
          setSelectedPath(path);
        });
        line.addTo(pathLayerRef.current);
      }
    });
    return () => { disposed = true; };
  }, [configuration, mapName, markerLayerVersion, visiblePaths, worldName]);

  useEffect(() => {
    if (!configuration || !draftPathLayerRef.current) return;
    const world = findWorld(configuration, worldName);
    const selectedMap = world ? findMap(world, mapName) : undefined;
    if (!selectedMap) return;
    let disposed = false;
    void import("leaflet").then(({ default: L }) => {
      if (disposed || !draftPathLayerRef.current) return;
      draftPathLayerRef.current.clearLayers();
      if (!pathDraft) return;
      const projectedPoints = pathDraft.points.map((point) => {
        const projected = minecraftToDynmap({ ...point, y: minecraftMapConfig.projectionY }, selectedMap);
        return [projected.lat, projected.lng] as [number, number];
      });
      if (projectedPoints.length > 1) {
        L.polyline(projectedPoints, {
          color: pathDraft.color,
          weight: pathDraft.weight,
          dashArray: pathDraft.dashed ? "10 8" : undefined,
          opacity: 0.95,
        }).addTo(draftPathLayerRef.current);
      }
      projectedPoints.forEach((point, index) => {
        const handle = L.marker(point, {
          draggable: true,
          icon: L.divIcon({ className: styles.pathVertexIcon, html: `<span>${index + 1}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
          title: `頂点 ${index + 1}`,
          zIndexOffset: 1200,
        });
        handle.on("drag", () => {
          const latestDraft = pathDraftRef.current;
          if (!latestDraft) return;
          const location = dynmapToMinecraft(handle.getLatLng(), minecraftMapConfig.projectionY, selectedMap);
          const points = latestDraft.points.map((candidate, candidateIndex) => candidateIndex === index
            ? { x: Math.round(location.x), z: Math.round(location.z) }
            : candidate);
          setPathDraft({ ...latestDraft, points });
        });
        handle.on("contextmenu", () => {
          const latestDraft = pathDraftRef.current;
          if (!latestDraft) return;
          setPathDraft({ ...latestDraft, points: latestDraft.points.filter((_, candidateIndex) => candidateIndex !== index) });
        });
        handle.addTo(draftPathLayerRef.current!);
      });
    });
    return () => { disposed = true; };
  }, [configuration, mapName, markerLayerVersion, pathDraft, worldName]);

  useEffect(() => {
    if (!configuration || !markerLayerRef.current) return;
    const world = findWorld(configuration, worldName);
    const selectedMap = world ? findMap(world, mapName) : undefined;
    if (!selectedMap) return;
    let disposed = false;
    void import("leaflet").then(({ default: L }) => {
      if (disposed || !markerLayerRef.current) return;
      markerLayerRef.current.clearLayers();
      for (const marker of visibleMarkers) {
        const projected = minecraftToDynmap({ x: marker.x, y: marker.y ?? minecraftMapConfig.projectionY, z: marker.z }, selectedMap);
        const markerVisual = document.createElement("div");
        markerVisual.className = styles.markerVisual;
        const markerLabel = document.createElement("span");
        markerLabel.className = styles.markerLabel;
        markerLabel.textContent = marker.name;
        const markerPin = document.createElement("span");
        markerPin.className = styles.markerPin;
        markerPin.style.setProperty("--marker-color", marker.color);
        markerPin.textContent = markerSymbol(marker.icon);
        markerVisual.append(markerLabel, markerPin);
        const leafletMarker = L.marker([projected.lat, projected.lng], {
          icon: L.divIcon({
            className: styles.markerIcon,
            html: markerVisual,
            iconSize: [30, 36], iconAnchor: [15, 34],
          }),
          title: marker.name,
        });
        if (marker.imageUrl) {
          const preview = document.createElement("div");
          preview.className = styles.markerHoverPreview;
          const previewImage = document.createElement("img");
          previewImage.src = marker.imageUrl;
          previewImage.alt = "";
          previewImage.loading = "lazy";
          const previewName = document.createElement("strong");
          previewName.textContent = marker.name;
          preview.append(previewImage, previewName);
          leafletMarker.bindTooltip(preview, {
            className: styles.markerImageTooltip,
            direction: "top",
            offset: [0, -36],
            opacity: 1,
          });
        }
        leafletMarker.on("click", () => {
          setMarkerDraft(null);
          setSelectedMarker(marker);
        });
        leafletMarker.addTo(markerLayerRef.current);
      }
    });
    return () => { disposed = true; };
  }, [configuration, mapName, markerLayerVersion, visibleMarkers, worldName]);

  useEffect(() => {
    const leafletMap = leafletMapRef.current;
    if (!configuration || !leafletMap) return;
    draftMarkerRef.current?.remove();
    draftMarkerRef.current = null;
    if (!markerDraft) return;
    const world = findWorld(configuration, worldName);
    const selectedMap = world ? findMap(world, mapName) : undefined;
    if (!selectedMap) return;
    let disposed = false;
    void import("leaflet").then(({ default: L }) => {
      if (disposed || !leafletMapRef.current || !markerDraftRef.current) return;
      const activeDraft = markerDraftRef.current;
      const projected = minecraftToDynmap({
        x: activeDraft.x,
        y: activeDraft.y === "" ? minecraftMapConfig.projectionY : Number(activeDraft.y),
        z: activeDraft.z,
      }, selectedMap);
      const visual = document.createElement("div");
      visual.className = styles.draftMarkerVisual;
      const label = document.createElement("span");
      label.className = styles.draftMarkerLabel;
      label.textContent = activeDraft.name.trim() || "配置予定";
      const pin = document.createElement("span");
      pin.className = styles.draftMarkerPin;
      pin.style.setProperty("--marker-color", activeDraft.color);
      pin.textContent = markerSymbol(activeDraft.icon);
      visual.append(label, pin);
      const previewMarker = L.marker([projected.lat, projected.lng], {
        icon: L.divIcon({ className: styles.draftMarkerIcon, html: visual, iconSize: [36, 42], iconAnchor: [18, 40] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(leafletMap);
      draftMarkerRef.current = previewMarker;
    });
    return () => {
      disposed = true;
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
    };
  }, [configuration, mapName, markerDraft, markerLayerVersion, worldName]);

  function editMarker(marker: MinecraftMapMarker) {
    setMarkerDraft({
      id: marker.id, name: marker.name, description: marker.description, x: marker.x,
      y: marker.y === null ? "" : String(marker.y), z: marker.z, icon: marker.icon,
      color: marker.color,
      imageId: marker.imageId, ...(marker.imageUrl ? { imageUrl: marker.imageUrl } : {}),
      relatedType: marker.relatedType, relatedId: marker.relatedId,
    });
    setSelectedMarker(null);
    setMarkerImageFile(null);
  }

  async function saveMarker(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!markerDraft) return;
    setSavingMarker(true);
    setMarkerMessage(null);
    try {
      let imageId = markerDraft.imageId;
      if (markerImageFile) {
        const form = new FormData();
        form.append("image", markerImageFile);
        const uploadResponse = await fetch("/api/images", { method: "POST", body: form });
        const uploadPayload = await uploadResponse.json().catch(() => null) as { data?: { id: string; url: string }; error?: { message?: string } } | null;
        if (!uploadResponse.ok || !uploadPayload?.data) throw new Error(uploadPayload?.error?.message || "画像をアップロードできませんでした。");
        imageId = uploadPayload.data.id;
      }
      const response = await fetch(markerDraft.id ? `/api/map-markers/${markerDraft.id}` : "/api/map-markers", {
        method: markerDraft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: markerDraft.name, description: markerDraft.description, world: logicalWorldId,
          x: markerDraft.x, y: markerDraft.y === "" ? null : Number(markerDraft.y), z: markerDraft.z,
          icon: markerDraft.icon, color: markerDraft.color,
          imageId,
          relatedType: markerImageFile ? null : markerDraft.relatedType,
          relatedId: markerImageFile ? null : markerDraft.relatedId,
        }),
      });
      const payload = await response.json().catch(() => null) as { data?: MinecraftMapMarker; error?: { message?: string } } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error?.message || "マーカーを保存できませんでした。");
      setMarkers((current) => markerDraft.id
        ? current.map((marker) => marker.id === payload.data!.id ? payload.data! : marker)
        : [...current, payload.data!]);
      setMarkerDraft(null);
      setMarkerImageFile(null);
      setSelectedMarker(payload.data);
    } catch (cause) {
      setMarkerMessage(cause instanceof Error ? cause.message : "マーカーを保存できませんでした。");
    } finally {
      setSavingMarker(false);
    }
  }

  async function removeMarker(marker: MinecraftMapMarker) {
    if (!window.confirm(`「${marker.name}」を削除しますか？`)) return;
    const response = await fetch(`/api/map-markers/${marker.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMarkerMessage("マーカーを削除できませんでした。");
      return;
    }
    setMarkers((current) => current.filter((candidate) => candidate.id !== marker.id));
    setSelectedMarker(null);
  }

  function startPath(kind: MinecraftMapPathKind = "road") {
    setMarkerDraft(null);
    setSelectedMarker(null);
    setSelectedPath(null);
    setPathMessage(null);
    setPathDraft(emptyPathDraft(kind));
  }

  function editPath(path: MinecraftMapPath) {
    setSelectedPath(null);
    setMarkerDraft(null);
    setPathDraft({
      id: path.id,
      name: path.name,
      description: path.description,
      kind: path.kind,
      color: path.color,
      weight: path.weight,
      dashed: path.dashed,
      points: path.points.map((point) => ({ ...point })),
    });
  }

  async function savePath(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pathDraft || pathDraft.points.length < 2) {
      setPathMessage("地図をクリックして頂点を2つ以上追加してください。");
      return;
    }
    setSavingPath(true);
    setPathMessage(null);
    try {
      const response = await fetch(pathDraft.id ? `/api/map-paths/${pathDraft.id}` : "/api/map-paths", {
        method: pathDraft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pathDraft.name,
          description: pathDraft.description,
          world: logicalWorldId,
          kind: pathDraft.kind,
          color: pathDraft.color,
          weight: pathDraft.weight,
          dashed: pathDraft.dashed,
          points: pathDraft.points,
        }),
      });
      const payload = await response.json().catch(() => null) as { data?: MinecraftMapPath; error?: { message?: string } } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error?.message || "道路・線路を保存できませんでした。");
      setPaths((current) => pathDraft.id
        ? current.map((path) => path.id === payload.data!.id ? payload.data! : path)
        : [...current, payload.data!]);
      setPathDraft(null);
      setSelectedPath(payload.data);
    } catch (cause) {
      setPathMessage(cause instanceof Error ? cause.message : "道路・線路を保存できませんでした。");
    } finally {
      setSavingPath(false);
    }
  }

  async function removePath(path: MinecraftMapPath) {
    if (!window.confirm(`「${path.name}」を削除しますか？`)) return;
    const response = await fetch(`/api/map-paths/${path.id}`, { method: "DELETE" });
    if (!response.ok) {
      setPathMessage("道路・線路を削除できませんでした。");
      return;
    }
    setPaths((current) => current.filter((candidate) => candidate.id !== path.id));
    setSelectedPath(null);
  }

  const selectedWorld = configuration ? findWorld(configuration, worldName) : undefined;
  const worldSets = useMemo(() => configuration ? groupDynmapWorlds(configuration) : [], [configuration]);
  const selectedWorldSetId = dynmapWorldIdentity(worldName).setId;
  const catalogWorld = catalog?.worlds.find((candidate) => candidate.id === logicalWorldId);
  const snapshots = catalogWorld?.snapshots ?? [];

  function changeActiveWorld(nextWorld: string) {
    if (!configuration) return;
    const world = findWorld(configuration, nextWorld);
    if (!world) return;
    const nextMap = selectableMap(world, mapName);
    setWorldName(world.name);
    setMapName(nextMap?.name || world.maps[0]?.name || "flat");
    setSelectedMarker(null);
    setMarkerDraft(null);
    setSelectedPath(null);
    setPathDraft(null);
  }

  function changeWorldSet(nextSetId: string) {
    if (catalog) {
      const nextWorld = catalog.worlds.find((candidate) => candidate.id === nextSetId);
      if (!nextWorld) return;
      setLogicalWorldId(nextWorld.id);
      setSnapshotId(nextWorld.currentSnapshot || nextWorld.snapshots.at(-1)?.id || null);
      setConfiguration(null);
      setSelectedMarker(null);
      setMarkerDraft(null);
      setSelectedPath(null);
      setPathDraft(null);
      return;
    }
    const worldSet = worldSets.find((candidate) => candidate.id === nextSetId);
    if (!worldSet) return;
    changeActiveWorld(
      worldSet.worlds.find((entry) => entry.dimension === "overworld")?.world.name
      ?? worldSet.worlds[0]?.world.name
      ?? nextSetId,
    );
  }

  return (
    <section className={styles.shell} aria-label="Minecraftワールドマップ">
      <div className={`${styles.mapFrame} ${timelineOpen ? styles.timelineVisible : ""}`}>
        <div ref={mapElementRef} className={styles.map} />
        <aside className={styles.toolbar} aria-label="地図の表示設定">
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.panelEyebrow}>Minecraft World Map</p>
              <h1>ワールドマップ</h1>
            </div>
            <button
              className={styles.panelToggle}
              type="button"
              aria-expanded={controlsOpen}
              aria-controls="minecraft-map-controls"
              onClick={() => setControlsOpen((open) => !open)}
            >
              {controlsOpen ? "閉じる" : "地図設定"}
            </button>
          </div>
          <div className={styles.panelStatus}>
            <p className={styles.coordinates} aria-live="polite">
              X {coordinates.x.toLocaleString()} / Z {coordinates.z.toLocaleString()}
            </p>
            <p className={styles.hint}>
              ドラッグで移動、ホイールまたはボタンで拡大縮小できます。{pathDraft ? "地図をクリックして頂点を追加し、番号をドラッグして位置を調整します。" : currentUser ? "右クリックまたは長押しでマーカーを追加できます。" : "マーカーなどはログインすると追加できます。"}
            </p>
          </div>
          {controlsOpen ? (
            <div id="minecraft-map-controls" className={styles.panelContent}>
              <div className={styles.selectors}>
          <label className={styles.field}>
            ワールドマップ
            <select
              value={catalog ? logicalWorldId : selectedWorldSetId}
              disabled={!configuration}
              onChange={(event) => changeWorldSet(event.target.value)}
            >
              {(catalog ? catalog.worlds : worldSets).map((worldSet) => (
                <option key={worldSet.id} value={worldSet.id}>{"name" in worldSet ? worldSet.name : worldSet.title}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            表示
            <select
              value={mapName}
              disabled={!selectedWorld}
              onChange={(event) => setMapName(event.target.value)}
            >
              {selectableMaps(selectedWorld || { maps: [] }).map((map) => (
                <option key={map.name} value={map.name}>{mapLabel(map)}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            マーカー作成者
            <select value={authorFilter} disabled={!markersVisible} onChange={(event) => setAuthorFilter(event.target.value)}>
              <option value="all">すべて</option>
              {markerAuthors.map((author) => <option key={author.id} value={author.id}>{author.displayName}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            マーカー種類
            <select value={iconFilter} disabled={!markersVisible} onChange={(event) => setIconFilter(event.target.value)}>
              <option value="all">すべて</option>
              {MARKER_ICONS.map((icon) => <option key={icon.value} value={icon.value}>{icon.symbol} {icon.label}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            路線作成者
            <select value={pathAuthorFilter} disabled={!pathsVisible} onChange={(event) => setPathAuthorFilter(event.target.value)}>
              <option value="all">すべて</option>
              {pathAuthors.map((author) => <option key={author.id} value={author.id}>{author.displayName}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            路線種類
            <select value={pathKindFilter} disabled={!pathsVisible} onChange={(event) => setPathKindFilter(event.target.value)}>
              <option value="all">すべて</option>
              {PATH_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </select>
          </label>
              </div>
              <div className={styles.toolbarMeta}>
          <label className={styles.visibilityToggle}>
            <input
              type="checkbox"
              checked={markersVisible}
              onChange={(event) => {
                setMarkersVisible(event.target.checked);
                if (!event.target.checked) setSelectedMarker(null);
              }}
            />
            マーカーを表示
          </label>
          <label className={styles.visibilityToggle}>
            <input
              type="checkbox"
              checked={pathsVisible}
              onChange={(event) => {
                setPathsVisible(event.target.checked);
                if (!event.target.checked) setSelectedPath(null);
              }}
            />
            道路・線路を表示
          </label>
          <p className={styles.markerCount}>{visibleMarkers.length} / {markers.length} 件表示</p>
          <p className={styles.markerCount}>{visiblePaths.length} / {paths.length} 路線表示</p>
          {(authorFilter !== "all" || iconFilter !== "all" || pathAuthorFilter !== "all" || pathKindFilter !== "all") ? (
            <button className={styles.clearFilters} type="button" onClick={() => { setAuthorFilter("all"); setIconFilter("all"); setPathAuthorFilter("all"); setPathKindFilter("all"); }}>
              絞り込みを解除
            </button>
          ) : null}
          {currentUser ? (
            <button className={styles.drawPathButton} type="button" onClick={() => pathDraft ? setPathDraft(null) : startPath()}>
              {pathDraft ? "描画を終了" : "＋ 道路・線路を描く"}
            </button>
          ) : null}
              </div>
            </div>
          ) : null}
        </aside>
        {!configuration && !error ? <p className={styles.status}>地図を読み込んでいます…</p> : null}
        {error ? <p className={styles.status}>{error}</p> : null}
        {selectedMarker ? (
          <aside className={styles.markerCard} aria-label="マーカー詳細">
            <button className={styles.closeButton} type="button" onClick={() => setSelectedMarker(null)} aria-label="閉じる">×</button>
            {selectedMarker.imageUrl ? <img className={styles.markerImage} src={selectedMarker.imageUrl} alt="" /> : null}
            <p className={styles.markerKind}>{markerSymbol(selectedMarker.icon)} マーカー</p>
            <h2>{selectedMarker.name}</h2>
            {selectedMarker.description ? <p>{selectedMarker.description}</p> : null}
            <p className={styles.markerMeta}>X {Math.round(selectedMarker.x)} / Z {Math.round(selectedMarker.z)} · {selectedMarker.author.displayName}</p>
            {selectedMarker.relatedHref ? <a className={styles.contentLink} href={selectedMarker.relatedHref}>{selectedMarker.relatedTitle || `関連する${selectedMarker.relatedType === "article" ? "記事" : "投稿"}`} →</a> : null}
            {currentUser && (currentUser.isAdmin || currentUser.id === selectedMarker.author.id) ? (
              <div className={styles.markerActions}>
                <button type="button" onClick={() => editMarker(selectedMarker)}>編集</button>
                <button type="button" className={styles.dangerButton} onClick={() => void removeMarker(selectedMarker)}>削除</button>
              </div>
            ) : null}
          </aside>
        ) : null}
        {selectedPath ? (
          <aside className={styles.pathCard} aria-label="道路・線路の詳細">
            <button className={styles.closeButton} type="button" onClick={() => setSelectedPath(null)} aria-label="閉じる">×</button>
            <p className={styles.markerKind}>{pathKindLabel(selectedPath.kind)}</p>
            <h2>{selectedPath.name}</h2>
            {selectedPath.description ? <p>{selectedPath.description}</p> : null}
            <p className={styles.markerMeta}>{selectedPath.points.length} 頂点 · {selectedPath.author.displayName}</p>
            <span className={styles.pathSample} style={{ backgroundColor: selectedPath.color, height: selectedPath.weight }} />
            {currentUser && (currentUser.isAdmin || currentUser.id === selectedPath.author.id) ? (
              <div className={styles.markerActions}>
                <button type="button" onClick={() => editPath(selectedPath)}>編集</button>
                <button type="button" className={styles.dangerButton} onClick={() => void removePath(selectedPath)}>削除</button>
              </div>
            ) : null}
          </aside>
        ) : null}
        {markerDraft ? (
          <form className={styles.markerForm} onSubmit={saveMarker}>
            <div className={styles.formHeading}>
              <h2>{markerDraft.id ? "マーカーを編集" : "マーカーを追加"}</h2>
              <button className={styles.closeButton} type="button" onClick={() => setMarkerDraft(null)} aria-label="閉じる">×</button>
            </div>
            <label>名前<input required maxLength={80} value={markerDraft.name} onChange={(event) => setMarkerDraft({ ...markerDraft, name: event.target.value })} /></label>
            <label>種類<select value={markerDraft.icon} onChange={(event) => setMarkerDraft({ ...markerDraft, icon: event.target.value })}>{MARKER_ICONS.map((icon) => <option key={icon.value} value={icon.value}>{icon.symbol} {icon.label}</option>)}</select></label>
            <label>色<span className={styles.colorField}><input type="color" value={markerDraft.color} onChange={(event) => setMarkerDraft({ ...markerDraft, color: event.target.value })} /><input pattern="#[0-9a-fA-F]{6}" maxLength={7} value={markerDraft.color} onChange={(event) => setMarkerDraft({ ...markerDraft, color: event.target.value })} /></span></label>
            <label>説明<textarea maxLength={1000} rows={3} value={markerDraft.description} onChange={(event) => setMarkerDraft({ ...markerDraft, description: event.target.value })} /></label>
            <fieldset className={styles.imageFields}>
              <legend>カード画像</legend>
              {markerDraft.imageUrl ? <img src={markerDraft.imageUrl} alt="選択中の画像" /> : null}
              {markerImageFile ? <p>選択中: {markerImageFile.name}</p> : null}
              <label>投稿・記事から選択
                <select value={markerDraft.relatedType && markerDraft.relatedId && markerDraft.imageId ? `${markerDraft.relatedType}:${markerDraft.relatedId}:${markerDraft.imageId}` : ""} onChange={(event) => {
                  const option = mediaOptions.find((candidate) => candidate.key === event.target.value);
                  setMarkerImageFile(null);
                  setMarkerDraft(option ? { ...markerDraft, imageId: option.imageId, imageUrl: option.imageUrl, relatedType: option.relatedType, relatedId: option.relatedId } : { ...markerDraft, imageId: null, imageUrl: undefined, relatedType: null, relatedId: null });
                }}>
                  <option value="">選択しない</option>
                  {mediaOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </label>
              <label>または新しい画像をアップロード
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setMarkerImageFile(file);
                  if (file) setMarkerDraft({ ...markerDraft, imageId: null, imageUrl: undefined, relatedType: null, relatedId: null });
                }} />
              </label>
              {(markerDraft.imageId || markerImageFile) ? <button type="button" className={styles.removeImage} onClick={() => { setMarkerImageFile(null); setMarkerDraft({ ...markerDraft, imageId: null, imageUrl: undefined, relatedType: null, relatedId: null }); }}>画像を外す</button> : null}
            </fieldset>
            <div className={styles.coordinateFields}>
              <label>X<input type="number" required value={markerDraft.x} onChange={(event) => setMarkerDraft({ ...markerDraft, x: Number(event.target.value) })} /></label>
              <label>Y（任意）<input type="number" value={markerDraft.y} onChange={(event) => setMarkerDraft({ ...markerDraft, y: event.target.value })} /></label>
              <label>Z<input type="number" required value={markerDraft.z} onChange={(event) => setMarkerDraft({ ...markerDraft, z: Number(event.target.value) })} /></label>
            </div>
            <button className={styles.saveButton} disabled={savingMarker}>{savingMarker ? "保存中…" : "保存"}</button>
          </form>
        ) : null}
        {pathDraft ? (
          <form className={styles.pathForm} onSubmit={savePath}>
            <div className={styles.formHeading}>
              <div>
                <h2>{pathDraft.id ? "道路・線路を編集" : "道路・線路を描く"}</h2>
                <p className={styles.formGuide}>地図をクリックして頂点を追加。番号をドラッグして移動できます。</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={() => setPathDraft(null)} aria-label="閉じる">×</button>
            </div>
            <label>名前<input required maxLength={80} value={pathDraft.name} onChange={(event) => setPathDraft({ ...pathDraft, name: event.target.value })} /></label>
            <label>種類<select value={pathDraft.kind} onChange={(event) => {
              const kind = event.target.value as MinecraftMapPathKind;
              const definition = PATH_KINDS.find((candidate) => candidate.value === kind)!;
              setPathDraft({ ...pathDraft, kind, color: definition.color, dashed: kind === "railway" });
            }}>{PATH_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
            <label>色<span className={styles.colorField}><input type="color" value={pathDraft.color} onChange={(event) => setPathDraft({ ...pathDraft, color: event.target.value })} /><input pattern="#[0-9a-fA-F]{6}" maxLength={7} value={pathDraft.color} onChange={(event) => setPathDraft({ ...pathDraft, color: event.target.value })} /></span></label>
            <label>線の太さ <span className={styles.rangeValue}>{pathDraft.weight}px</span><input type="range" min="1" max="12" value={pathDraft.weight} onChange={(event) => setPathDraft({ ...pathDraft, weight: Number(event.target.value) })} /></label>
            <label className={styles.inlineToggle}><input type="checkbox" checked={pathDraft.dashed} onChange={(event) => setPathDraft({ ...pathDraft, dashed: event.target.checked })} /> 破線で表示</label>
            <label>説明<textarea maxLength={1000} rows={2} value={pathDraft.description} onChange={(event) => setPathDraft({ ...pathDraft, description: event.target.value })} /></label>
            <div className={styles.pathPointHeading}>
              <strong>頂点（{pathDraft.points.length}）</strong>
              <button type="button" disabled={pathDraft.points.length === 0} onClick={() => setPathDraft({ ...pathDraft, points: pathDraft.points.slice(0, -1) })}>1つ戻す</button>
            </div>
            <ol className={styles.pathPointList}>
              {pathDraft.points.map((point, index) => (
                <li key={index}>
                  <span>{index + 1}</span>
                  <input aria-label={`頂点${index + 1} X`} type="number" value={point.x} onChange={(event) => setPathDraft({ ...pathDraft, points: pathDraft.points.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, x: Number(event.target.value) } : candidate) })} />
                  <input aria-label={`頂点${index + 1} Z`} type="number" value={point.z} onChange={(event) => setPathDraft({ ...pathDraft, points: pathDraft.points.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, z: Number(event.target.value) } : candidate) })} />
                  <button type="button" aria-label={`頂点${index + 1}を削除`} onClick={() => setPathDraft({ ...pathDraft, points: pathDraft.points.filter((_, candidateIndex) => candidateIndex !== index) })}>×</button>
                </li>
              ))}
            </ol>
            <button className={styles.saveButton} disabled={savingPath || pathDraft.points.length < 2}>{savingPath ? "保存中…" : "道路・線路を保存"}</button>
          </form>
        ) : null}
        {markerMessage ? <p className={styles.markerMessage}>{markerMessage} <button type="button" onClick={() => setMarkerMessage(null)}>閉じる</button></p> : null}
        {pathMessage ? <p className={styles.markerMessage}>{pathMessage} <button type="button" onClick={() => setPathMessage(null)}>閉じる</button></p> : null}
        <div className={styles.timelineOverlay}>
          {timelineOpen ? (
            <MapTimeline
              snapshots={snapshots}
              selectedId={snapshotId}
              onClose={() => setTimelineOpen(false)}
              onSelect={(nextSnapshotId) => {
                setSnapshotId(nextSnapshotId);
                setConfiguration(null);
                const url = new URL(window.location.href);
                url.searchParams.set("world", logicalWorldId);
                url.searchParams.set("snapshot", nextSnapshotId);
                window.history.replaceState(null, "", url);
              }}
            />
          ) : (
            <button className={styles.timelineOpen} type="button" aria-expanded="false" onClick={() => setTimelineOpen(true)}>
              ◷ 地図のタイムライン
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
