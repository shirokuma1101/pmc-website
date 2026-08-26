"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import type { Article, ArticleAuthorOption } from "@/types";

import { getApiErrorMessage, unwrapApiData } from "../apiResponse";
import { ArticleEditor } from "../editor/ArticleEditor";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { StatusBadge } from "../ui/StatusBadge";
import { useUnsavedChangesWarning } from "./useUnsavedChangesWarning";

type SaveIntent = "draft" | "review";
type FieldErrors = Partial<Record<"title" | "body", string>>;
type ArticleDraftSnapshot = {
  title: string;
  summary: string;
  tags: string;
  body: string;
  authorId: string;
  createdAt: string;
  publishedAt: string;
};

export interface ArticleFormProps {
  article?: Article | null;
  createEndpoint?: string;
  cancelHref?: string;
  redirectAfterSubmit?: string;
  allowPublishedEdit?: boolean;
  adminMode?: boolean;
  currentUserId?: string;
  authorOptions?: ArticleAuthorOption[];
  onSaved?: (article: Article) => void;
}

function dateTimeLocalValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ArticleForm({
  article = null,
  createEndpoint = "/api/articles",
  cancelHref = "/me",
  redirectAfterSubmit = "/me?status=pending",
  allowPublishedEdit = false,
  adminMode = false,
  currentUserId,
  authorOptions = [],
  onSaved,
}: ArticleFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [tags, setTags] = useState(article?.tags.join(", ") ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [persistedId, setPersistedId] = useState<string | null>(article?.id ?? null);
  const [savingIntent, setSavingIntent] = useState<SaveIntent | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [authorId, setAuthorId] = useState(article?.author.id ?? currentUserId ?? authorOptions[0]?.id ?? "");
  const [createdAt, setCreatedAt] = useState(dateTimeLocalValue(article?.createdAt));
  const [publishedAt, setPublishedAt] = useState(dateTimeLocalValue(article?.publishedAt));
  const [savedSnapshot, setSavedSnapshot] = useState<ArticleDraftSnapshot>({
    title: article?.title ?? "",
    summary: article?.summary ?? "",
    tags: article?.tags.join(", ") ?? "",
    body: article?.body ?? "",
    authorId: article?.author.id ?? currentUserId ?? authorOptions[0]?.id ?? "",
    createdAt: dateTimeLocalValue(article?.createdAt),
    publishedAt: dateTimeLocalValue(article?.publishedAt),
  });

  const editingPublished = article?.status === "published" && allowPublishedEdit;
  const locked = (article?.status === "pending" && !adminMode)
    || (article?.status === "published" && !allowPublishedEdit);
  const currentSnapshot: ArticleDraftSnapshot = { title, summary, tags, body, authorId, createdAt, publishedAt };
  const isDirty = !locked && Object.entries(currentSnapshot)
    .some(([field, value]) => savedSnapshot[field as keyof ArticleDraftSnapshot] !== value);
  useUnsavedChangesWarning(isDirty);

  function validate(intent: SaveIntent) {
    const nextErrors: FieldErrors = {};
    const requiresCompleteArticle = intent === "review" || editingPublished;
    if (!title.trim()) nextErrors.title = "タイトルを入力してください。";
    if (requiresCompleteArticle && !body.trim()) {
      nextErrors.body = editingPublished ? "公開記事には本文が必要です。" : "レビュー依頼には本文が必要です。";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveArticle(intent: SaveIntent) {
    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("summary", summary.trim());
    formData.append("tags", tags);
    formData.append("body", body);
    if (adminMode) {
      if (authorId) formData.append("authorId", authorId);
      if (createdAt) formData.append("createdAt", new Date(createdAt).toISOString());
      if (article?.status === "published" && publishedAt) {
        formData.append("publishedAt", new Date(publishedAt).toISOString());
      }
    }

    const endpoint = persistedId ? `/api/articles/${encodeURIComponent(persistedId)}` : createEndpoint;
    const response = await fetch(endpoint, {
      method: persistedId ? "PATCH" : "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, "記事を保存できませんでした。"));
    }

    const result: unknown = await response.json().catch(() => null);
    const savedArticle = unwrapApiData<Article>(result, "article");
    const articleId = savedArticle?.id ?? persistedId;

    if (!articleId) throw new Error("保存した記事を特定できませんでした。もう一度お試しください。");
    setPersistedId(articleId);
    setSavedSnapshot(currentSnapshot);

    if (intent === "review") {
      const submitResponse = await fetch(`/api/articles/${encodeURIComponent(articleId)}/submit`, {
        method: "POST",
        credentials: "include",
      });
      if (!submitResponse.ok) {
        throw new Error(await getApiErrorMessage(submitResponse, "レビューを依頼できませんでした。下書きは保存されています。"));
      }
    }

    return { articleId, savedArticle };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent: SaveIntent = submitter?.value === "review" ? "review" : "draft";

    setFormError(null);
    setSuccessMessage(null);
    if (!validate(intent)) return;
    setSavingIntent(intent);

    try {
      const { articleId, savedArticle } = await saveArticle(intent);
      if (savedArticle) onSaved?.(savedArticle);

      if (intent === "review") {
        router.push(redirectAfterSubmit);
        router.refresh();
        return;
      }

      setSuccessMessage(editingPublished ? "公開記事の変更を保存しました。" : "下書きを保存しました。");
      if (!article) router.push(`/article/${articleId}/edit?saved=1`);
      router.refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "記事を保存できませんでした。");
    } finally {
      setSavingIntent(null);
    }
  }

  return (
    <form className="article-form" onSubmit={handleSubmit} noValidate>
      <div className="article-form__topline">
        <div>
          <p className="eyebrow">ARTICLE EDITOR</p>
          <h1>{editingPublished ? "公開記事を編集" : article ? "記事を編集" : "新しい記事を書く"}</h1>
        </div>
        {article ? <StatusBadge status={article.status} /> : <StatusBadge status="draft" />}
      </div>

      {adminMode && article ? (
        <Alert tone="warning" title="管理モードで編集中です">
          管理者として、この記事の作成者にかかわらず内容を編集できます。
        </Alert>
      ) : null}

      {article?.status === "pending" && !adminMode ? (
        <Alert tone="info" title="レビュー中です">
          レビューが完了するまで内容を変更できません。
        </Alert>
      ) : null}
      {article?.status === "published" && !allowPublishedEdit ? (
        <Alert tone="info" title="公開済みの記事です">
          MVPでは公開後の編集を停止しています。
        </Alert>
      ) : null}
      {editingPublished ? (
        <Alert tone="warning" title="公開中の記事を編集しています">
          保存した変更は、すぐに公開ページへ反映されます。
        </Alert>
      ) : null}
      {article?.status === "rejected" ? (
        <Alert tone="warning" title="記事が差し戻されました">
          内容を見直して、もう一度レビューを依頼できます。
          {article.reviewComment ? <p className="article-form__review-comment">コメント：{article.reviewComment}</p> : null}
        </Alert>
      ) : null}

      <fieldset className="article-form__fieldset" disabled={locked || savingIntent !== null}>
        <legend className="sr-only">記事の内容</legend>
        {adminMode ? (
          <details className="content-admin-fields" open>
            <summary>管理者モード</summary>
            <div className="content-admin-fields__grid">
              <label className="field">
                <span className="field__label">著者</span>
                <select className="input" value={authorId} required onChange={(event) => setAuthorId(event.target.value)}>
                  {authorOptions.map((author) => <option key={author.id} value={author.id}>{author.displayName}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field__label">作成日時</span>
                <input className="input" type="datetime-local" value={createdAt} onChange={(event) => setCreatedAt(event.target.value)} />
                <span className="field__hint">新規記事で未指定の場合は現在日時になります。</span>
              </label>
              {article?.status === "published" ? (
                <label className="field">
                  <span className="field__label">公開日時</span>
                  <input className="input" type="datetime-local" value={publishedAt} required onChange={(event) => setPublishedAt(event.target.value)} />
                  <span className="field__hint">公開ページや記事一覧に表示される日時です。</span>
                </label>
              ) : null}
            </div>
          </details>
        ) : null}
        <Input
          label="タイトル"
          name="title"
          value={title}
          maxLength={120}
          placeholder="読者に伝わるタイトル"
          hint={`${title.length} / 120文字`}
          error={errors.title}
          autoComplete="off"
          onChange={(event) => { setTitle(event.target.value); setErrors((current) => ({ ...current, title: undefined })); }}
        />

        <Input
          label="タグ"
          name="tags"
          value={tags}
          maxLength={320}
          placeholder="Minecraft, 建築, イベント"
          hint="カンマ区切りで10個まで設定できます（1タグ30文字以内）。"
          autoComplete="off"
          onChange={(event) => setTags(event.target.value)}
        />

        <label className="field">
          <span className="field__label">概要（任意）</span>
          <textarea
            className="input"
            name="summary"
            value={summary}
            rows={3}
            maxLength={500}
            placeholder="記事の要点を簡潔に入力してください"
            onChange={(event) => setSummary(event.target.value)}
          />
          <span className="field__hint">未入力の場合は本文の先頭から自動生成します。{summary.length} / 500文字</span>
        </label>

        <ArticleEditor
          value={body}
          onChange={(nextBody) => { setBody(nextBody); setErrors((current) => ({ ...current, body: undefined })); }}
          error={errors.body}
          disabled={locked || savingIntent !== null}
        />
      </fieldset>

      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {successMessage ? <Alert tone="success">{successMessage}</Alert> : null}

      <div className="article-form__actions">
        <Link className="button button--ghost button--md" href={cancelHref}>戻る</Link>
        {!locked ? (
          <div className="article-form__submit-group">
            {editingPublished ? (
              <Button
                type="submit"
                name="intent"
                value="draft"
                loading={savingIntent === "draft"}
                disabled={savingIntent !== null}
              >
                変更を保存
              </Button>
            ) : (
              <>
                <Button
                  type="submit"
                  name="intent"
                  value="draft"
                  variant="secondary"
                  loading={savingIntent === "draft"}
                  disabled={savingIntent !== null}
                >
                  下書き保存
                </Button>
                <Button
                  type="submit"
                  name="intent"
                  value="review"
                  loading={savingIntent === "review"}
                  disabled={savingIntent !== null}
                >
                  レビューを依頼
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </form>
  );
}
