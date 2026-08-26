"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

export function useCloseDetailsOnOutsideClick(ref: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const details = ref.current;
      if (!details?.open || !(event.target instanceof Node) || details.contains(event.target)) return;
      details.open = false;
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [ref]);
}
