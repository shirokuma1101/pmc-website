"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import type { Post, PostAuthorOption } from "@/types";

import { getApiErrorMessage, unwrapApiData } from "../apiResponse";
import { Alert } from "../ui/Alert";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { LikeButton } from "../ui/LikeButton";

type PostImage = string | { id?: string; url: string; alt?: string | null };

export interface PostCardProps {
  post: Post;
  currentUserId?: string | null;
  canManage?: boolean;
  onUpdated?: (post: Post) => void;
  onDeleted?: (postId: string) => void;
  adminMode?: boolean;
  authorOptions?: PostAuthorOption[];
}

function dateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function imageDetails(image: PostImage, index: number) {
  if (typeof image === "string") {
    return { url: image, alt: `投稿画像 ${index + 1}` };
  }
  return { url: image.url, alt: image.alt || `投稿画像 ${index + 1}` };
}

export function PostCard({
  post,
  currentUserId = null,
  canManage,
  onUpdated,
  onDeleted,
  adminMode = false,
  authorOptions = [],
}: PostCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorId, setAuthorId] = useState(post.author.id);
  const [createdAt, setCreatedAt] = useState(dateTimeLocalValue(post.createdAt));
  const owner = canManage ?? currentUserId === post.author.id;
  const images = (post.images ?? []) as PostImage[];

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      setError("活動内容を入力してください。");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: normalizedContent,
          ...(adminMode ? { authorId, createdAt: new Date(createdAt).toISOString() } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "投稿を更新できませんでした。"));
      }
      const result: unknown = await response.json().catch(() => null);
      const updatedPost = unwrapApiData<Post>(result, "post");
      setEditing(false);
      if (updatedPost) onUpdated?.(updatedPost);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "投稿を更新できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("この投稿を削除しますか？ この操作は取り消せません。")) return;
    setError(null);
    setDeleting(true);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "投稿を削除できませんでした。"));
      }
      onDeleted?.(post.id);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "投稿を削除できませんでした。");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="post-card" aria-labelledby={`post-author-${post.id}`}>
      <div className="post-card__rail" aria-hidden="true">
        <span />
      </div>
      <div className="post-card__body">
        <header className="post-card__header">
          <Link className="post-card__author" href={`/members/${post.author.id}`}>
            <Avatar user={post.author} size="md" />
            <span>
              <strong id={`post-author-${post.id}`}>{post.author.displayName}</strong>
              <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
            </span>
          </Link>
          {owner && !editing ? (
            <div className="post-card__owner-actions" aria-label="投稿の操作">
              <button type="button" onClick={() => { setEditing(true); setError(null); }}>
                編集
              </button>
              <button className="text-danger" type="button" onClick={handleDelete} disabled={deleting}>
                {deleting ? "削除中…" : "削除"}
              </button>
            </div>
          ) : null}
        </header>

        {editing ? (
          <form className="post-card__edit" onSubmit={handleUpdate}>
            <label className="sr-only" htmlFor={`edit-post-${post.id}`}>活動内容を編集</label>
            <textarea
              id={`edit-post-${post.id}`}
              className="textarea"
              value={content}
              maxLength={500}
              rows={4}
              autoFocus
              disabled={saving}
              onChange={(event) => setContent(event.target.value)}
            />
            {adminMode ? (
              <div className="content-admin-fields__grid">
                <label className="field">
                  <span className="field__label">投稿者</span>
                  <select className="input" value={authorId} disabled={saving} onChange={(event) => setAuthorId(event.target.value)}>
                    {authorOptions.map((author) => <option key={author.id} value={author.id}>{author.displayName}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">投稿日時</span>
                  <input className="input" type="datetime-local" required value={createdAt} disabled={saving} onChange={(event) => setCreatedAt(event.target.value)} />
                </label>
              </div>
            ) : null}
            {error ? <Alert tone="error">{error}</Alert> : null}
            <div className="post-card__edit-actions">
              <Button type="submit" size="sm" loading={saving}>変更を保存</Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setContent(post.content);
                  setAuthorId(post.author.id);
                  setCreatedAt(dateTimeLocalValue(post.createdAt));
                  setEditing(false);
                  setError(null);
                }}
              >
                キャンセル
              </Button>
            </div>
          </form>
        ) : (
          <>
            {post.content ? <p className="post-card__content">{post.content}</p> : null}
            {images.length > 0 ? (
              <div className={`post-card__images post-card__images--${Math.min(images.length, 4)}`}>
                {images.map((image, index) => {
                  const details = imageDetails(image, index);
                  return <img key={typeof image === "string" ? image : image.id ?? image.url} src={details.url} alt={details.alt} loading="lazy" />;
                })}
              </div>
            ) : null}
            {post.updatedAt && post.updatedAt !== post.createdAt ? (
              <p className="post-card__edited">編集済み</p>
            ) : null}
            <div className="post-card__reactions">
              <LikeButton
                endpoint={`/api/posts/${post.id}/like`}
                initialCount={post.likeCount}
                initialLiked={post.likedByMe}
                canLike={post.canLike}
              />
            </div>
            {error ? <Alert tone="error">{error}</Alert> : null}
          </>
        )}
      </div>
    </article>
  );
}
