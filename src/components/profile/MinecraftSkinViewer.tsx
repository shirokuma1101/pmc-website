"use client";

import { useEffect, useRef } from "react";
import type { MinecraftSkinModel } from "@/types";

export function MinecraftSkinViewer({ skinUrl, model = "classic", label }: { skinUrl: string; model?: MinecraftSkinModel; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};
    void import("skinview3d").then(({ SkinViewer, WalkingAnimation }) => {
      if (disposed) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const viewer = new SkinViewer({ canvas, width: 260, height: 340, skin: skinUrl, model: model === "classic" ? "default" : "slim" });
      viewer.controls.enablePan = false;
      viewer.controls.enableZoom = true;
      viewer.zoom = 0.82;
      viewer.autoRotate = !reducedMotion;
      viewer.autoRotateSpeed = 0.5;
      viewer.animation = reducedMotion ? null : new WalkingAnimation();
      cleanup = () => viewer.dispose();
    });
    return () => { disposed = true; cleanup(); };
  }, [model, skinUrl]);
  return <canvas ref={canvasRef} className="minecraft-skin-viewer" role="img" aria-label={`${label}のMinecraftスキン。ドラッグで回転、ホイールまたはピンチで拡大縮小できます。`} />;
}
