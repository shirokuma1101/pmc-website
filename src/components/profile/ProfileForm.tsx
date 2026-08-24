"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { Profile } from "@/types";

import { getApiErrorMessage, unwrapApiData } from "../apiResponse";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface ProfileFormProps {
  profile: Profile;
  endpoint?: string;
  redirectTo?: string;
  onSaved?: (profile: Profile) => void;
}

export function ProfileForm({
  profile,
  endpoint = "/api/profile",
  redirectTo = "/me",
  onSaved,
}: ProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarObjectUrlRef = useRef<string | null>(null);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatarUrl ?? null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => () => {
    if (avatarObjectUrlRef.current) URL.revokeObjectURL(avatarObjectUrlRef.current);
  }, []);

  function replaceAvatarPreview(file: File | null, fallback: string | null) {
    if (avatarObjectUrlRef.current) URL.revokeObjectURL(avatarObjectUrlRef.current);
    avatarObjectUrlRef.current = file ? URL.createObjectURL(file) : null;
    setAvatarPreview(avatarObjectUrlRef.current ?? fallback);
  }

  function handleAvatar(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setError(null);
    if (!selected) return;

    if (!ACCEPTED_AVATAR_TYPES.includes(selected.type)) {
      setError("JPEG、PNG、WebP形式の画像を選んでください。");
      event.target.value = "";
      return;
    }
    if (selected.size > MAX_AVATAR_BYTES) {
      setError("画像サイズは5MB以下にしてください。");
      event.target.value = "";
      return;
    }

    replaceAvatarPreview(selected, null);
    setAvatar(selected);
    setRemoveAvatar(false);
  }

  function clearAvatar() {
    replaceAvatarPreview(null, null);
    setAvatar(null);
    setRemoveAvatar(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(null);
    setSuccess(false);

    const normalizedName = displayName.trim();
    if (!normalizedName) {
      setFieldError("表示名を入力してください。");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("displayName", normalizedName);
      formData.append("bio", bio.trim());
      if (avatar) formData.append("avatar", avatar);
      if (removeAvatar) formData.append("removeAvatar", "true");

      const response = await fetch(endpoint, {
        method: "PATCH",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "プロフィールを更新できませんでした。"));

      const result: unknown = await response.json().catch(() => null);
      const updatedProfile = unwrapApiData<Profile>(result, "profile");
      if (updatedProfile) onSaved?.(updatedProfile);
      setSuccess(true);
      router.push(redirectTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "プロフィールを更新できませんでした。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="profile-form" onSubmit={handleSubmit} noValidate>
      <div className="profile-form__avatar-field">
        <p className="field__label">プロフィール画像</p>
        <div className="profile-form__avatar-row">
          <label className="profile-avatar-picker" htmlFor="profile-avatar">
            {avatarPreview ? (
              <img src={avatarPreview} alt="プロフィール画像のプレビュー" />
            ) : (
              <span aria-hidden="true">{Array.from(displayName.trim() || "?").slice(0, 2).join("")}</span>
            )}
            <span className="profile-avatar-picker__overlay">変更</span>
          </label>
          <div>
            <label className="file-button" htmlFor="profile-avatar">画像を選択</label>
            {avatarPreview ? (
              <button className="text-button text-danger" type="button" onClick={clearAvatar}>画像を外す</button>
            ) : null}
            <p className="field__hint">JPEG、PNG、WebP・5MBまで</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          className="sr-only"
          id="profile-avatar"
          type="file"
          accept={ACCEPTED_AVATAR_TYPES.join(",")}
          onChange={handleAvatar}
        />
      </div>

      <Input
        label="表示名"
        name="displayName"
        value={displayName}
        maxLength={50}
        required
        hint={`${displayName.length} / 50文字`}
        error={fieldError}
        autoComplete="name"
        disabled={submitting}
        onChange={(event) => { setDisplayName(event.target.value); setFieldError(null); }}
      />
      <Textarea
        label="自己紹介"
        name="bio"
        value={bio}
        maxLength={300}
        rows={6}
        hint={`${bio.length} / 300文字。公開プロフィールに表示されます。`}
        disabled={submitting}
        onChange={(event) => setBio(event.target.value)}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">プロフィールを更新しました。</Alert> : null}
      <div className="profile-form__actions">
        <Button type="submit" loading={submitting}>変更を保存</Button>
      </div>
    </form>
  );
}
