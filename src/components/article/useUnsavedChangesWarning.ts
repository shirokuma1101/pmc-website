"use client";

import { useEffect, useRef } from "react";

const LEAVE_WARNING = "保存していない変更があります。このページから移動してもよろしいですか？";

export function useUnsavedChangesWarning(shouldWarn: boolean) {
  const allowNavigationRef = useRef(false);

  useEffect(() => {
    if (!shouldWarn) return;

    const temporarilyAllowNavigation = () => {
      allowNavigationRef.current = true;
      window.setTimeout(() => {
        allowNavigationRef.current = false;
      }, 0);
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
        || !(event.target instanceof Element)
      ) return;

      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

      const destination = new URL(link.href, window.location.href);
      const current = new URL(window.location.href);
      const staysOnPage = destination.origin === current.origin
        && destination.pathname === current.pathname
        && destination.search === current.search;
      if (staysOnPage) return;

      if (!window.confirm(LEAVE_WARNING)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      temporarilyAllowNavigation();
    };

    const handlePopState = () => {
      if (allowNavigationRef.current) return;
      if (window.confirm(LEAVE_WARNING)) {
        temporarilyAllowNavigation();
        return;
      }
      window.history.forward();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [shouldWarn]);
}
