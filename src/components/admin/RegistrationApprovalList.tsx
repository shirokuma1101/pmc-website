"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PendingRegistration } from "@/lib/directus/registrations";
import { getApiErrorMessage } from "../apiResponse";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value));
}

export function RegistrationApprovalList({ registrations }: { registrations: PendingRegistration[] }) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept(registration: PendingRegistration) {
    if (!window.confirm(`「${registration.displayName}」のアカウントを承認しますか？`)) return;
    setProcessingId(registration.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/registrations/${registration.id}/accept`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "アカウントを承認できませんでした。"));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "アカウントを承認できませんでした。");
    } finally {
      setProcessingId(null);
    }
  }

  return <>{error ? <Alert tone="error">{error}</Alert> : null}<div className="registration-list">
    {registrations.map((registration) => <article className="registration-card" key={registration.id}>
      <div><span className="status-badge status-badge--pending">承認待ち</span><h2>{registration.displayName}</h2><p>{registration.email}</p><time dateTime={registration.createdAt}>申請日時 {formatDate(registration.createdAt)}</time></div>
      <Button size="sm" loading={processingId === registration.id} disabled={processingId !== null} onClick={() => accept(registration)}>承認する</Button>
    </article>)}
  </div></>;
}
