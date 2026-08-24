import type { UserSummary } from "@/types";

import { classNames } from "./classNames";

export interface AvatarProps {
  user: Pick<UserSummary, "displayName" | "avatarUrl">;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  eager?: boolean;
}

function initials(name: string) {
  const normalized = name.trim();
  if (!normalized) return "?";
  return Array.from(normalized).slice(0, 2).join("").toUpperCase();
}

export function Avatar({ user, size = "md", className, eager = false }: AvatarProps) {
  return (
    <span
      className={classNames("avatar", `avatar--${size}`, className)}
      role="img"
      aria-label={`${user.displayName}のプロフィール画像`}
    >
      {user.avatarUrl ? (
        <img
          className="avatar__image"
          src={user.avatarUrl}
          alt=""
          loading={eager ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="avatar__fallback" aria-hidden="true">
          {initials(user.displayName)}
        </span>
      )}
    </span>
  );
}
