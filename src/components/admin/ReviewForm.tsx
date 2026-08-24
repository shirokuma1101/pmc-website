"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import type { ReviewAction } from "@/types";

import { getApiErrorMessage } from "../apiResponse";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";

type ReviewIntent = Extract<ReviewAction, "approved" | "rejected">;

export interface ReviewFormProps {
  articleId: string;
  articleTitle?: string;
  endpoint?: string;
  redirectTo?: string;
  initialComment?: string;
  onReviewed?: (action: ReviewIntent) => void;
}

export function ReviewForm({
  articleId,
  articleTitle,
  endpoint = `/api/admin/reviews/${encodeURIComponent(articleId)}`,
  redirectTo = "/admin/reviews",
  initialComment = "",
  onReviewed,
}: ReviewFormProps) {
  const router = useRouter();
  const [comment, setComment] = useState(initialComment);
  const [submitting, setSubmitting] = useState<ReviewIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action: ReviewIntent = submitter?.value === "rejected" ? "rejected" : "approved";
    setError(null);
    setCommentError(null);

    if (action === "rejected" && !comment.trim()) {
      setCommentError("差し戻す理由を入力してください。");
      return;
    }

    const label = articleTitle ? `「${articleTitle}」` : "この記事";
    const confirmation = action === "approved"
      ? `${label}を公開しますか？`
      : `${label}を著者へ差し戻しますか？`;
    if (!window.confirm(confirmation)) return;

    setSubmitting(action);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, comment: comment.trim() }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "レビュー結果を保存できませんでした。"));

      onReviewed?.(action);
      router.push(redirectTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "レビュー結果を保存できませんでした。");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate>
      <div className="review-form__heading">
        <p className="eyebrow">REVIEW DECISION</p>
        <h2>レビュー結果</h2>
        <p>承認するとすぐに公開されます。差し戻す場合は、著者が修正しやすいコメントを残してください。</p>
      </div>

      <Textarea
        label="著者へのコメント"
        name="comment"
        value={comment}
        rows={6}
        maxLength={1000}
        hint={`${comment.length} / 1000文字。差し戻し時は必須です。`}
        error={commentError}
        disabled={submitting !== null}
        onChange={(event) => { setComment(event.target.value); setCommentError(null); }}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="review-form__actions">
        <Button
          type="submit"
          name="action"
          value="rejected"
          variant="danger"
          loading={submitting === "rejected"}
          disabled={submitting !== null}
        >
          差し戻す
        </Button>
        <Button
          type="submit"
          name="action"
          value="approved"
          loading={submitting === "approved"}
          disabled={submitting !== null}
        >
          承認して公開
        </Button>
      </div>
    </form>
  );
}
