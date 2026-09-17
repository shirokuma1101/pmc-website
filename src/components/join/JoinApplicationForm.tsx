"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { Alert, Button, Input, Textarea } from "@/components/ui";

interface JoinApplication {
  displayName: string;
  email: string;
  minecraftGamertag: string;
  discordUsername: string;
  motivation: string;
}

const EMPTY_APPLICATION: JoinApplication = {
  displayName: "",
  email: "",
  minecraftGamertag: "",
  discordUsername: "",
  motivation: "",
};

export function JoinApplicationForm() {
  const [application, setApplication] = useState(EMPTY_APPLICATION);
  const [confirming, setConfirming] = useState(false);

  function update<K extends keyof JoinApplication>(key: K, value: JoinApplication[K]) {
    setApplication((current) => ({ ...current, [key]: value }));
  }

  function showConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirming(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (confirming) {
    return (
      <section className="join-form-card" aria-labelledby="join-confirmation-title">
        <div className="join-form-card__heading">
          <p className="eyebrow">Confirm</p>
          <h2 id="join-confirmation-title">申請内容の確認</h2>
          <p>以下の内容で間違いがないか確認してください。この画面ではまだ送信されません。</p>
        </div>
        <dl className="join-confirmation">
          <div><dt>表示名</dt><dd>{application.displayName}</dd></div>
          <div><dt>メールアドレス</dt><dd>{application.email}</dd></div>
          <div><dt>Minecraftゲーマータグ</dt><dd>{application.minecraftGamertag}</dd></div>
          <div><dt>Discordユーザー名</dt><dd>{application.discordUsername}</dd></div>
          <div className="join-confirmation__wide"><dt>参加したい理由・やってみたいこと</dt><dd>{application.motivation}</dd></div>
        </dl>
        <Alert tone="info" title="送信機能は準備中です">
          Resendとの接続と申請保存機能を実装するまでは、申請を確定できません。
        </Alert>
        <div className="join-form-actions">
          <Button variant="secondary" onClick={() => setConfirming(false)}>入力内容を修正</Button>
          <Button disabled>申請を送信</Button>
        </div>
      </section>
    );
  }

  return (
    <form className="join-form-card" onSubmit={showConfirmation}>
      <div className="join-form-card__heading">
        <p className="eyebrow">Application</p>
        <h2>参加申請フォーム</h2>
        <p><span aria-hidden="true">*</span> 必須項目を入力し、確認画面へ進んでください。</p>
      </div>

      <fieldset className="join-form-section">
        <legend>あなたについて</legend>
        <div className="join-form-grid">
          <Input
            label="表示名"
            name="displayName"
            value={application.displayName}
            maxLength={50}
            autoComplete="name"
            hint="サイトやDiscordで呼ばれたい名前"
            required
            onChange={(event) => update("displayName", event.target.value)}
          />
          <Input
            label="メールアドレス"
            name="email"
            type="email"
            value={application.email}
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            hint="受付完了と参加可否の連絡に使用します"
            required
            onChange={(event) => update("email", event.target.value)}
          />
          <Input
            label="Minecraftゲーマータグ"
            name="minecraftGamertag"
            value={application.minecraftGamertag}
            maxLength={32}
            autoComplete="off"
            required
            onChange={(event) => update("minecraftGamertag", event.target.value)}
          />
          <Input
            label="Discordユーザー名"
            name="discordUsername"
            value={application.discordUsername}
            maxLength={64}
            autoComplete="off"
            hint="例: postmine_user"
            required
            onChange={(event) => update("discordUsername", event.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="join-form-section">
        <legend>参加について</legend>
        <Textarea
          label="参加したい理由・やってみたいこと"
          name="motivation"
          value={application.motivation}
          maxLength={1000}
          rows={7}
          hint={`${application.motivation.length}/1000文字`}
          required
          onChange={(event) => update("motivation", event.target.value)}
        />
      </fieldset>

      <fieldset className="join-form-section join-form-consents">
        <legend>確認事項</legend>
        <label className="join-checkbox">
          <input type="checkbox" name="ageRequirement" required />
          <span>15歳以上で、義務教育を修了しています。</span>
        </label>
        <label className="join-checkbox">
          <input type="checkbox" name="minecraftRequirement" required />
          <span>Minecraft統合版で外部サーバーへ接続できる環境があります。</span>
        </label>
        <label className="join-checkbox">
          <input type="checkbox" name="policyConsent" required />
          <span>
            <Link href="/terms" target="_blank">利用規約</Link>と
            <Link href="/privacy" target="_blank">プライバシーポリシー</Link>を確認し、同意します。
          </span>
        </label>
      </fieldset>

      <Alert tone="info">
        入力内容は確認画面へ進んでも外部へ送信されません。送信機能は次の実装段階で追加します。
      </Alert>
      <div className="join-form-actions">
        <Button type="submit" size="lg">入力内容を確認</Button>
      </div>
    </form>
  );
}
