"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCloseDetailsOnOutsideClick } from "./useCloseDetailsOnOutsideClick";

interface AdminNotification {
  id: string;
  kind: "review" | "registration";
  title: string;
  detail: string;
  createdAt: string;
  href: string;
}

interface NotificationData {
  items: AdminNotification[];
  total: number;
}

const REFRESH_INTERVAL = 30_000;

function notificationDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminNotificationTray({ onNavigate }: { onNavigate?: () => void }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [notifications, setNotifications] = useState<NotificationData>({ items: [], total: 0 });
  const [failed, setFailed] = useState(false);
  useCloseDetailsOnOutsideClick(detailsRef);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Notification request failed");
      const body = await response.json() as { data: NotificationData };
      setNotifications(body.data);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  return (
    <details ref={detailsRef} className="notification-tray">
      <summary aria-label={`管理通知 ${notifications.total}件`} title="通知">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span className="notification-tray__mobile-label">通知</span>
        {notifications.total > 0 ? (
          <span className="notification-tray__badge">{notifications.total > 99 ? "99+" : notifications.total}</span>
        ) : null}
      </summary>
      <div className="notification-tray__panel">
        <div className="notification-tray__heading">
          <strong>通知</strong>
          <button type="button" onClick={() => void refresh()}>更新</button>
        </div>
        {failed ? <p className="notification-tray__message">通知を取得できませんでした。</p> : null}
        {!failed && notifications.items.length === 0 ? (
          <p className="notification-tray__message">新しい管理通知はありません。</p>
        ) : null}
        {notifications.items.length > 0 ? (
          <ul className="notification-tray__list">
            {notifications.items.map((notification) => (
              <li key={`${notification.kind}-${notification.id}`}>
                <Link href={notification.href} onClick={onNavigate}>
                  <span className={`notification-tray__kind notification-tray__kind--${notification.kind}`}>
                    {notification.kind === "review" ? "記" : "人"}
                  </span>
                  <span>
                    <strong>{notification.title}</strong>
                    <small>{notification.detail}</small>
                    <time dateTime={notification.createdAt}>{notificationDate(notification.createdAt)}</time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="notification-tray__footer">
          <Link href="/admin/reviews" onClick={onNavigate}>レビュー</Link>
          <Link href="/admin/registrations" onClick={onNavigate}>アカウント承認</Link>
        </div>
      </div>
    </details>
  );
}
