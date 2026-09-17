"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StoredJoinApplication } from "@/lib/directus/join-applications";
import { getApiErrorMessage } from "../apiResponse";
import { Alert, Button, Textarea } from "../ui";

const STATUS_LABEL = { pending: "確認待ち", accepted: "承認", rejected: "拒否" } as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value));
}

export function JoinApplicationReviewList({ applications }: { applications: StoredJoinApplication[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(application: StoredJoinApplication, status: "accepted" | "rejected") {
    const action = status === "accepted" ? "承認" : "拒否";
    if (!window.confirm(`「${application.displayName}」さんの参加申請を${action}し、${application.email}へ結果メールを送信しますか？`)) return;
    setProcessingId(application.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/join-applications/${application.id}/decision`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, message: messages[application.id] ?? "" }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "参加申請を更新できませんでした。"));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "参加申請を更新できませんでした。");
      router.refresh();
    } finally {
      setProcessingId(null);
    }
  }

  return <>
    {error ? <Alert tone="error">{error}</Alert> : null}
    <div className="registration-list">
      {applications.map((application) => <article className="registration-card" key={application.id}>
        <div>
          <span className={`status-badge status-badge--${application.status === "pending" ? "pending" : application.status === "accepted" ? "published" : "rejected"}`}>{STATUS_LABEL[application.status]}</span>
          <h2>{application.displayName}</h2>
          <p><strong>メール:</strong> {application.email}</p>
          <p><strong>Minecraft:</strong> {application.minecraftGamertag}</p>
          <p><strong>Discord:</strong> {application.discordUsername}</p>
          <p><strong>参加理由:</strong><br />{application.motivation}</p>
          <time dateTime={application.createdAt}>申請日時 {formatDate(application.createdAt)}</time>
          {application.decisionMessage ? <p><strong>送信したメッセージ:</strong><br />{application.decisionMessage}</p> : null}
        </div>
        {application.status === "pending" ? <div className="join-review-actions">
          <Textarea
            label="申請者へのメッセージ（任意）"
            maxLength={1_000}
            rows={4}
            value={messages[application.id] ?? ""}
            onChange={(event) => setMessages((current) => ({ ...current, [application.id]: event.target.value }))}
          />
          <div className="join-form-actions">
            <Button variant="secondary" loading={processingId === application.id} disabled={processingId !== null} onClick={() => decide(application, "rejected")}>拒否してメール送信</Button>
            <Button loading={processingId === application.id} disabled={processingId !== null} onClick={() => decide(application, "accepted")}>承認してメール送信</Button>
          </div>
        </div> : application.decidedAt ? <time dateTime={application.decidedAt}>判定日時 {formatDate(application.decidedAt)}</time> : null}
      </article>)}
    </div>
  </>;
}
