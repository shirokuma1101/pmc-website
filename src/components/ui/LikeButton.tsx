"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface LikeButtonProps {
  endpoint: string;
  initialCount: number;
  initialLiked: boolean;
  canLike: boolean;
}

export function LikeButton({ endpoint, initialCount, initialLiked, canLike }: LikeButtonProps) {
  const pathname = usePathname();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!canLike) {
    return (
      <Link className="like-button" href={`/login?next=${encodeURIComponent(pathname)}`} title="ログインしていいね">
        <span aria-hidden="true">♡</span><span>{count}</span>
      </Link>
    );
  }

  async function toggle() {
    if (busy) return;
    const nextLiked = !liked;
    setBusy(true);
    setError(false);
    setLiked(nextLiked);
    setCount((current) => Math.max(0, current + (nextLiked ? 1 : -1)));
    try {
      const response = await fetch(endpoint, {
        method: nextLiked ? "POST" : "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error();
      const payload = await response.json() as { data?: { liked?: boolean; likeCount?: number } };
      setLiked(payload.data?.liked ?? nextLiked);
      setCount(payload.data?.likeCount ?? count);
    } catch {
      setLiked(liked);
      setCount(count);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`like-button${liked ? " like-button--active" : ""}`}
      type="button"
      aria-label={liked ? "いいねを取り消す" : "いいねする"}
      aria-pressed={liked}
      title={error ? "更新できませんでした" : undefined}
      disabled={busy}
      onClick={toggle}
    >
      <span aria-hidden="true">{liked ? "♥" : "♡"}</span><span>{count}</span>
    </button>
  );
}
