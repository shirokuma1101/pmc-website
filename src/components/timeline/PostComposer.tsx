"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import type { Post, PostAuthorOption, UserSummary } from "@/types";

import { getApiErrorMessage, unwrapApiData } from "../apiResponse";
import { Alert } from "../ui/Alert";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";

const MAX_CONTENT_LENGTH = 500;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface PostComposerProps {
  currentUser: UserSummary;
  endpoint?: string;
  onCreated?: (post: Post) => void;
  isAdmin?: boolean;
  authorOptions?: PostAuthorOption[];
}

export function PostComposer({
  currentUser,
  endpoint = "/api/posts",
  onCreated,
  isAdmin = false,
  authorOptions = [],
}: PostComposerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [authorId, setAuthorId] = useState(currentUser.id);
  const [createdAt, setCreatedAt] = useState("");

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function clearPreviews() {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    setPreviewUrls([]);
  }

  function handleImages(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setError(null);

    if (selected.length + images.length > MAX_IMAGES) {
      setError(`画像は${MAX_IMAGES}枚まで添付できます。`);
      event.target.value = "";
      return;
    }

    const unsupported = selected.find((file) => !ACCEPTED_IMAGE_TYPES.includes(file.type));
    if (unsupported) {
      setError("JPEG、PNG、WebP、GIF形式の画像を選んでください。");
      event.target.value = "";
      return;
    }

    const oversized = selected.find((file) => file.size > MAX_IMAGE_BYTES);
    if (oversized) {
      setError("画像1枚あたりのサイズは5MB以下にしてください。");
      event.target.value = "";
      return;
    }

    const urls = selected.map((image) => URL.createObjectURL(image));
    previewUrlsRef.current = [...previewUrlsRef.current, ...urls];
    setPreviewUrls(previewUrlsRef.current);
    setImages((current) => [...current, ...selected]);
    event.target.value = "";
  }

  function removeImage(index: number) {
    const removedUrl = previewUrlsRef.current[index];
    if (removedUrl) URL.revokeObjectURL(removedUrl);
    previewUrlsRef.current = previewUrlsRef.current.filter((_, imageIndex) => imageIndex !== index);
    setPreviewUrls(previewUrlsRef.current);
    setImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const normalizedContent = content.trim();
    if (!normalizedContent) {
      setError("活動内容を入力してください。");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("content", normalizedContent);
      images.forEach((image) => formData.append("images", image));
      if (isAdmin && adminMode) {
        formData.append("authorId", authorId);
        if (createdAt) formData.append("createdAt", new Date(createdAt).toISOString());
      }

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "投稿できませんでした。"));
      }

      const result: unknown = await response.json().catch(() => null);
      const createdPost = unwrapApiData<Post>(result, "post");

      setContent("");
      setImages([]);
      clearPreviews();
      if (inputRef.current) inputRef.current.value = "";
      setSuccess(true);
      setCreatedAt("");
      if (createdPost) onCreated?.(createdPost);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "投稿できませんでした。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="post-composer" aria-labelledby="post-composer-title">
      <div className="post-composer__heading">
        <Avatar user={currentUser} size="md" eager />
        <div>
          <h2 id="post-composer-title">今なにしてる？</h2>
          <p>{currentUser.displayName}さんの活動を記録</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <label className="sr-only" htmlFor="post-content">
          活動内容
        </label>
        <textarea
          className="post-composer__textarea"
          id="post-content"
          name="content"
          value={content}
          maxLength={MAX_CONTENT_LENGTH}
          rows={4}
          placeholder="今日取り組んだこと、考えたことを残しましょう。"
          disabled={submitting}
          onChange={(event) => {
            setContent(event.target.value);
            setSuccess(false);
          }}
        />

        {isAdmin ? (
          <details className="post-admin-fields" open={adminMode} onToggle={(event) => setAdminMode(event.currentTarget.open)}>
            <summary>管理者モード</summary>
            <div className="post-admin-fields__grid">
              <label className="field">
                <span className="field__label">投稿者</span>
                <select className="input" value={authorId} disabled={submitting} onChange={(event) => setAuthorId(event.target.value)}>
                  {authorOptions.map((author) => <option key={author.id} value={author.id}>{author.displayName}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field__label">投稿日時</span>
                <input className="input" type="datetime-local" value={createdAt} disabled={submitting} onChange={(event) => setCreatedAt(event.target.value)} />
                <span className="field__hint">未指定の場合は現在日時になります。</span>
              </label>
            </div>
          </details>
        ) : null}

        {previewUrls.length > 0 ? (
          <ul className="image-preview-grid" aria-label="添付する画像">
            {previewUrls.map((url, index) => (
              <li className="image-preview" key={`${images[index]?.name}-${index}`}>
                <img src={url} alt={`添付画像 ${index + 1} のプレビュー`} />
                <button
                  type="button"
                  className="image-preview__remove"
                  onClick={() => removeImage(index)}
                  disabled={submitting}
                  aria-label={`添付画像 ${index + 1} を削除`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <Alert tone="error">{error}</Alert> : null}
        {success ? <Alert tone="success">投稿しました。</Alert> : null}

        <div className="post-composer__actions">
          <div className="post-composer__tools">
            <label className="file-button" htmlFor="post-images">
              <span aria-hidden="true">＋</span> 画像を追加
            </label>
            <input
              ref={inputRef}
              className="sr-only"
              id="post-images"
              type="file"
              name="images"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              multiple
              disabled={submitting || images.length >= MAX_IMAGES}
              onChange={handleImages}
            />
            <span className="post-composer__counter" aria-live="polite">
              {content.length} / {MAX_CONTENT_LENGTH}
            </span>
          </div>
          <Button type="submit" loading={submitting} disabled={!content.trim()}>
            投稿する
          </Button>
        </div>
      </form>
    </section>
  );
}
