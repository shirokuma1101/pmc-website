"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";

import { getApiErrorMessage } from "@/components/apiResponse";
import { Alert, Avatar, Button, EmptyState } from "@/components/ui";
import { DEFAULT_ORGANIZATION_GROUP_COLOR, ORGANIZATION_GROUP_PALETTE } from "@/lib/organization/palette";
import { SUPPORTER_TIERS } from "@/lib/organization/supporter";
import type { OrganizationAccountOption, OrganizationGroupColor, OrganizationMember, OrganizationSection, SupporterTier } from "@/types";

import styles from "./OrganizationEditor.module.css";

interface EditorLane {
  id: string;
  title: string;
  caption: string;
  groupId: string;
  color?: OrganizationGroupColor;
}

interface EditorSection {
  id: string;
  index: string;
  title: string;
  description: string;
  lanes: EditorLane[];
}

function accountLabel(account: OrganizationAccountOption) {
  return account.displayName && account.displayName !== account.email
    ? account.displayName
    : `表示名未設定（ID: ${account.id.slice(0, 8)}）`;
}

function memberSupporterTier(member?: OrganizationMember): SupporterTier | undefined {
  return member?.supporterTier ?? (member?.highlighted ? "supporter" : undefined);
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function persist(member: OrganizationMember, avatarId?: string | null) {
  const response = await fetch(`/api/admin/organization/${member.profileId}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: member.displayName,
      bio: member.bio,
      xboxGamertag: member.xboxGamertag ?? "",
      ...(avatarId !== undefined ? { avatarId } : {}),
      userId: member.userId ?? null,
      role: member.role,
      team: member.team,
      parentId: member.parentId ?? null,
      groupId: member.groupId ?? null,
    }),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "メンバー情報の保存に失敗しました。"));
  }
  const payload = await response.json() as { data: { displayName?: string; bio?: string; xboxGamertag?: string; avatarUrl?: string } };
  return {
    displayName: payload.data.displayName ?? member.displayName,
    bio: payload.data.bio ?? member.bio,
    xboxGamertag: payload.data.xboxGamertag ?? member.xboxGamertag ?? "",
    avatarUrl: payload.data.avatarUrl,
  };
}

export function OrganizationEditor({
  members: initialMembers,
  initialSections,
  accounts: initialAccounts,
}: {
  members: OrganizationMember[];
  initialSections: OrganizationSection[];
  accounts: OrganizationAccountOption[];
}) {
  const [view, setView] = useState<"profiles" | "groups">("profiles");
  const [members, setMembers] = useState(initialMembers);
  const [accountOptions, setAccountOptions] = useState(initialAccounts);
  const [sections, setSections] = useState(initialSections);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberGroupId, setNewMemberGroupId] = useState(initialSections[0]?.groups[0]?.id ?? "");
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [creatingMember, setCreatingMember] = useState(false);
  const [newSection, setNewSection] = useState("");
  const [layoutAction, setLayoutAction] = useState<string | null>(null);
  const [layoutEditor, setLayoutEditor] = useState<{ kind: "section" | "group"; sectionId: string; groupId?: string; title: string; description: string; color?: OrganizationGroupColor } | null>(null);
  const [selectedId, setSelectedId] = useState(initialMembers[0]?.profileId ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [skinUploading, setSkinUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [supporterDraft, setSupporterDraft] = useState<SupporterTier | "none">(memberSupporterTier(initialMembers[0]) ?? "none");
  const [supporterSaving, setSupporterSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const selected = members.find((member) => member.profileId === selectedId);
  const groupNames = useMemo(() => new Map(sections.flatMap((section) => section.groups.map((group) => [group.id, group.label] as const))), [sections]);
  const groupColors = useMemo(() => new Map(sections.flatMap((section) => section.groups.map((group) => [group.id, group.color] as const))), [sections]);
  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ja");
    return members.filter((member) => {
      if (roleFilter !== "all" && member.groupId !== roleFilter) return false;
      if (!normalizedQuery) return true;
      return [member.displayName, groupNames.get(member.groupId ?? "") ?? "未分類", member.team, member.bio]
        .some((value) => value.toLocaleLowerCase("ja").includes(normalizedQuery));
    });
  }, [groupNames, members, query, roleFilter]);
  const groupSections: EditorSection[] = sections.map((section, index) => ({
    id: section.id,
    index: String(index + 1).padStart(2, "0"),
    title: section.title,
    description: section.description,
    lanes: section.groups.map((group) => ({ id: group.id, groupId: group.id, title: group.label, caption: group.caption, color: group.color })),
  }));

  function select(member: OrganizationMember) {
    setSelectedId(member.profileId);
    setSupporterDraft(memberSupporterTier(member) ?? "none");
    setMessage(null);
  }

  function updateSelected(patch: Partial<OrganizationMember>) {
    setMembers((current) => current.map((member) => member.profileId === selectedId ? { ...member, ...patch } : member));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const identity = await persist(selected);
      updateSelected(identity);
      setAccountOptions((current) => current.map((account) => {
        if (account.id === selected.userId) return { ...account, organizationMemberId: selected.profileId };
        if (account.organizationMemberId === selected.profileId) return { ...account, organizationMemberId: undefined };
        return account;
      }));
      setMessage({ tone: "success", text: "メンバー情報を保存しました。" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "メンバー情報の保存に失敗しました。" });
    } finally {
      setSaving(false);
    }
  }

  async function changeAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!selected || selected.userId || !file) return;
    setMessage(null);
    if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
      setMessage({ tone: "error", text: "JPEG、PNG、WebP形式の画像を選んでください。" });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMessage({ tone: "error", text: "画像サイズは5MB以下にしてください。" });
      return;
    }
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const upload = await fetch("/api/images", { method: "POST", credentials: "include", body: form });
      if (!upload.ok) throw new Error(await getApiErrorMessage(upload, "アイコンのアップロードに失敗しました。"));
      const uploaded = await upload.json() as { data: { id: string; url: string } };
      const identity = await persist({ ...selected, avatarUrl: uploaded.data.url }, uploaded.data.id);
      updateSelected({ ...identity, avatarUrl: uploaded.data.url });
      setMessage({ tone: "success", text: "メンバーのアイコンを更新しました。" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "アイコンの更新に失敗しました。" });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function changeMinecraftSkin(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!selected || selected.userId || !file) return;
    setSkinUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("minecraftSkin", file);
      form.append("model", selected.minecraftSkinModel ?? "classic");
      const response = await fetch(`/api/admin/organization/${selected.profileId}/minecraft-skin`, { method: "PUT", credentials: "include", body: form });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "Minecraftスキンの更新に失敗しました。"));
      updateSelected({ minecraftSkinUrl: URL.createObjectURL(file) });
      setMessage({ tone: "success", text: "Minecraftスキンを更新しました。" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Minecraftスキンの更新に失敗しました。" });
    } finally { setSkinUploading(false); }
  }

  async function removeMinecraftSkin() {
    if (!selected || selected.userId) return;
    setSkinUploading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/organization/${selected.profileId}/minecraft-skin`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "Minecraftスキンの削除に失敗しました。"));
      updateSelected({ minecraftSkinUrl: undefined, minecraftSkinModel: "classic" });
      setMessage({ tone: "success", text: "Minecraftスキンを削除しました。" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Minecraftスキンの削除に失敗しました。" });
    } finally { setSkinUploading(false); }
  }

  async function addMember(event: FormEvent) {
    event.preventDefault();
    const displayName = newMemberName.trim();
    if (!displayName) return;
    setCreatingMember(true);
    setMessage(null);
    try {
      const input = {
        displayName,
        bio: "",
        xboxGamertag: "",
        userId: newMemberUserId || null,
        role: "team_member" as const,
        team: groupNames.get(newMemberGroupId) ?? "",
        parentId: null,
        groupId: newMemberGroupId || null,
      };
      const response = await fetch("/api/admin/organization", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "メンバーの追加に失敗しました。"));
      const payload = await response.json() as { data: { id: string; displayName?: string; bio?: string; xboxGamertag?: string; avatarUrl?: string } };
      const member: OrganizationMember = {
        profileId: payload.data.id,
        ...(newMemberUserId ? { userId: newMemberUserId } : {}),
        displayName: payload.data.displayName ?? displayName,
        ...(payload.data.avatarUrl ? { avatarUrl: payload.data.avatarUrl } : {}),
        bio: payload.data.bio ?? "",
        xboxGamertag: payload.data.xboxGamertag ?? "",
        role: "team_member",
        roleLabel: "メンバー",
        team: input.team,
        ...(newMemberGroupId ? { groupId: newMemberGroupId } : {}),
      };
      setMembers((current) => [...current, member]);
      setAccountOptions((current) => current.map((account) => account.id === newMemberUserId ? { ...account, organizationMemberId: member.profileId } : account));
      setSelectedId(member.profileId);
      setSupporterDraft("none");
      setNewMemberName("");
      setNewMemberUserId("");
      setMessage({ tone: "success", text: `${displayName}さんを追加しました。` });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "メンバーの追加に失敗しました。" });
    } finally {
      setCreatingMember(false);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    const confirmed = window.confirm(`「${selected.displayName}」を公開メンバーから削除しますか？\n\nアカウントは削除されません。このメンバーを上位担当者に設定している項目は解除されます。`);
    if (!confirmed) return;
    setDeleting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/organization/${selected.profileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "メンバーの削除に失敗しました。"));

      const removedId = selected.profileId;
      const removedIndex = members.findIndex((member) => member.profileId === removedId);
      const remaining = members
        .filter((member) => member.profileId !== removedId)
        .map((member) => member.parentId === removedId ? { ...member, parentId: undefined } : member);
      const nextSelected = remaining[Math.min(removedIndex, remaining.length - 1)];
      setMembers(remaining);
      setAccountOptions((current) => current.map((account) => account.organizationMemberId === removedId ? { ...account, organizationMemberId: undefined } : account));
      setSelectedId(nextSelected?.profileId ?? "");
      setSupporterDraft(memberSupporterTier(nextSelected) ?? "none");
      setMessage({ tone: "success", text: `${selected.displayName}さんを公開メンバーから削除しました。アカウントは保持されています。` });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "メンバーの削除に失敗しました。" });
    } finally {
      setDeleting(false);
    }
  }

  async function saveSupporterTier() {
    if (!selected) return;
    const tier = supporterDraft === "none" ? null : supporterDraft;
    setSupporterSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/organization/${selected.profileId}/supporter`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "サポーター表記の変更に失敗しました。"));
      const payload = await response.json() as { data: { supporterTier?: SupporterTier | null; highlighted: boolean } };
      const effectiveTier = payload.data.supporterTier ?? undefined;
      updateSelected({ supporterTier: effectiveTier, highlighted: payload.data.highlighted });
      setSupporterDraft(effectiveTier ?? "none");
      setMessage({ tone: "success", text: "サポーター表記を保存しました。" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "サポーター表記の変更に失敗しました。" });
    } finally { setSupporterSaving(false); }
  }

  async function drop(event: DragEvent, groupId: string) {
    event.preventDefault();
    const profileId = event.dataTransfer.getData("text/profile-id");
    const previous = members.find((member) => member.profileId === profileId);
    if (!previous) return;
    const moved: OrganizationMember = {
      ...previous,
      groupId,
      team: groupNames.get(groupId) ?? "",
    };
    setMembers((current) => current.map((member) => member.profileId === profileId ? moved : member));
    setMessage(null);
    try {
      await persist(moved);
      setMessage({ tone: "success", text: `${moved.displayName}さんの役割・所属を保存しました。` });
    } catch (error) {
      setMembers((current) => current.map((member) => member.profileId === profileId ? previous : member));
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "役割・所属の保存に失敗しました。" });
    }
  }

  async function saveLayout(next: OrganizationSection[], success: string) {
    setLayoutAction("save");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/organization/layout", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sections: next }) });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "グループの保存に失敗しました。"));
      const validIds = new Set(next.flatMap((section) => section.groups.map((group) => group.id)));
      setSections(next);
      setMembers((current) => current.map((member) => member.groupId && !validIds.has(member.groupId) ? { ...member, groupId: undefined } : member));
      setMessage({ tone: "success", text: success });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "グループの保存に失敗しました。" });
    } finally { setLayoutAction(null); }
  }

  async function addSection(event: FormEvent) {
    event.preventDefault();
    const name = newSection.trim();
    if (!name) return;
    await saveLayout([...sections, { id: crypto.randomUUID(), title: name, description: "", groups: [] }], `${name}を追加しました。`);
    setNewSection("");
  }

  function editSection(section: OrganizationSection) {
    setLayoutEditor({ kind: "section", sectionId: section.id, title: section.title, description: section.description });
  }

  async function deleteSection(section: OrganizationSection) {
    if (window.confirm(`「${section.title}」と中の項目を削除しますか？メンバーは未分類になります。`)) await saveLayout(sections.filter((item) => item.id !== section.id), `${section.title}を削除しました。`);
  }

  function addGroup(section: OrganizationSection) {
    setLayoutEditor({ kind: "group", sectionId: section.id, title: "", description: "", color: DEFAULT_ORGANIZATION_GROUP_COLOR });
  }

  function editGroup(sectionId: string, groupId: string) {
    const current = sections.find((section) => section.id === sectionId)?.groups.find((group) => group.id === groupId);
    if (!current) return;
    setLayoutEditor({ kind: "group", sectionId, groupId, title: current.label, description: current.caption, color: current.color ?? DEFAULT_ORGANIZATION_GROUP_COLOR });
  }

  async function submitLayoutEditor(event: FormEvent) {
    event.preventDefault();
    if (!layoutEditor) return;
    const title = layoutEditor.title.trim();
    if (!title) return;
    let next: OrganizationSection[];
    if (layoutEditor.kind === "section") {
      next = sections.map((section) => section.id === layoutEditor.sectionId ? { ...section, title, description: layoutEditor.description.trim() } : section);
    } else {
      next = sections.map((section) => section.id !== layoutEditor.sectionId ? section : {
        ...section,
        groups: layoutEditor.groupId
          ? section.groups.map((group) => group.id === layoutEditor.groupId ? { ...group, label: title, caption: layoutEditor.description.trim(), color: layoutEditor.color ?? DEFAULT_ORGANIZATION_GROUP_COLOR } : group)
          : [...section.groups, { id: crypto.randomUUID(), label: title, caption: layoutEditor.description.trim(), color: layoutEditor.color ?? DEFAULT_ORGANIZATION_GROUP_COLOR }],
      });
    }
    await saveLayout(next, `${title}を保存しました。`);
    setLayoutEditor(null);
  }

  async function deleteGroup(sectionId: string, groupId: string, label: string) {
    if (window.confirm(`「${label}」を削除しますか？所属メンバーは未分類になります。`)) await saveLayout(sections.map((section) => section.id === sectionId ? { ...section, groups: section.groups.filter((group) => group.id !== groupId) } : section), `${label}を削除しました。`);
  }

  function profileCard(member: OrganizationMember) {
    return (
      <button aria-pressed={selectedId === member.profileId} className={`${styles.profileCard} ${selectedId === member.profileId ? styles.selected : ""}`} data-color={groupColors.get(member.groupId ?? "")} data-role={member.role} key={member.profileId} onClick={() => select(member)} type="button">
        <span className={styles.profileIdentity}><Avatar user={member} size="lg" /><span><small>{groupNames.get(member.groupId ?? "") ?? "未分類"}</small><strong>{member.displayName}</strong></span></span>
        <span className={styles.profileBio}>{member.bio || "紹介文はまだありません。"}</span>
        <span className={styles.editLabel}>詳細を編集 <span aria-hidden="true">→</span></span>
      </button>
    );
  }

  function groupMember(member: OrganizationMember) {
    return (
      <button aria-pressed={selectedId === member.profileId} className={`${styles.groupMember} ${selectedId === member.profileId ? styles.selected : ""}`} data-color={groupColors.get(member.groupId ?? "")} data-role={member.role} draggable key={member.profileId} onClick={() => select(member)} onDragStart={(event) => event.dataTransfer.setData("text/profile-id", member.profileId)} type="button">
        <Avatar user={member} size="sm" /><span><strong>{member.displayName}</strong><small>{groupNames.get(member.groupId ?? "") ?? "未分類"}</small></span><svg className={styles.dragHandle} aria-hidden="true" viewBox="0 0 24 24"><circle cx="8" cy="6" r="1.6" /><circle cx="16" cy="6" r="1.6" /><circle cx="8" cy="12" r="1.6" /><circle cx="16" cy="12" r="1.6" /><circle cx="8" cy="18" r="1.6" /><circle cx="16" cy="18" r="1.6" /></svg>
      </button>
    );
  }

  function groupLane(lane: EditorLane) {
    const laneMembers = members.filter((member) => member.groupId === lane.groupId);
    return (
      <section aria-labelledby={`editor-lane-${lane.id}`} className={styles.groupLane} data-color={lane.color} key={lane.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void drop(event, lane.groupId)}>
        <header><div><p>{lane.caption}</p><h4 id={`editor-lane-${lane.id}`}>{lane.title}</h4></div><strong>{laneMembers.length}<small>名</small></strong></header>
        <div className={styles.groupMembers}>{laneMembers.length ? laneMembers.map(groupMember) : <p>ここにドラッグ</p>}</div>
      </section>
    );
  }

  return (
    <div className={styles.editor}>
      {message ? <Alert className={styles.notice} tone={message.tone}>{message.text}</Alert> : null}

      <section className={styles.workspace} aria-label="メンバー編集">
        <div className={styles.tabs} role="tablist" aria-label="編集内容の切り替え">
          <button id="profiles-editor-tab" role="tab" aria-controls="profiles-editor-panel" aria-selected={view === "profiles"} onClick={() => setView("profiles")} type="button"><span aria-hidden="true">▦</span><strong>プロフィール一覧</strong><small>{members.length}名</small></button>
          <button id="groups-editor-tab" role="tab" aria-controls="groups-editor-panel" aria-selected={view === "groups"} onClick={() => setView("groups")} type="button"><span aria-hidden="true">⌘</span><strong>役割・所属</strong><small>ドラッグで変更</small></button>
        </div>

        {view === "profiles" ? (
          <div id="profiles-editor-panel" role="tabpanel" aria-labelledby="profiles-editor-tab" className={styles.panel}>
            <section className={styles.memberManager}>
              <header><div><p>Add member</p><h2>公開メンバーを追加</h2></div><span>アカウント連携は任意です。</span></header>
              <form onSubmit={addMember}>
                <label>表示名<input required maxLength={80} value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} placeholder="公開プロフィールに表示する名前" /></label>
                <label>初期グループ<select value={newMemberGroupId} onChange={(event) => setNewMemberGroupId(event.target.value)}><option value="">未分類</option>{sections.map((section) => <optgroup key={section.id} label={section.title}>{section.groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</optgroup>)}</select></label>
                <label>アカウント（任意）<select value={newMemberUserId} onChange={(event) => setNewMemberUserId(event.target.value)}><option value="">紐づけない</option>{accountOptions.map((account) => <option disabled={Boolean(account.organizationMemberId)} key={account.id} value={account.id}>{accountLabel(account)}{account.organizationMemberId ? "・紐づけ済み" : ""}</option>)}</select></label>
                <Button type="submit" size="sm" loading={creatingMember}>追加</Button>
              </form>
            </section>

            <div className={styles.collectionHeader}>
              <div><p>Member collection</p><h2>プロフィールを管理</h2><span>カードを選択すると、右側で公開情報を編集できます。</span></div>
              <div className={styles.filters}>
                <label><span className="sr-only">メンバーを検索</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名前・所属・紹介から検索" /></label>
                <label><span className="sr-only">グループで絞り込む</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">すべてのグループ</option>{sections.map((section) => <optgroup key={section.id} label={section.title}>{section.groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</optgroup>)}</select></label>
              </div>
            </div>
            {filteredMembers.length ? <div className={styles.profileGrid}>{filteredMembers.map(profileCard)}</div> : <EmptyState title="該当するメンバーはいません" description="検索条件や役職を変更してみてください。" symbol="人" />}
          </div>
        ) : (
          <div id="groups-editor-panel" role="tabpanel" aria-labelledby="groups-editor-tab" className={styles.panel}>
            <div className={styles.groupIntro}><div><p>Roles & teams</p><h2>役割・所属を編集</h2><span>メンバーを別のレーンへドラッグすると、その場で保存されます。</span></div><span className={styles.dragHint}>↕ ドラッグ＆ドロップ</span></div>
            <section className={styles.teamManager}>
              <header><div><p>Group settings</p><h3>グループ・項目設定</h3></div><span>すべて追加・変更・削除できます</span></header>
              <form onSubmit={addSection}><label htmlFor="new-section" className="sr-only">グループを追加</label><input id="new-section" maxLength={80} value={newSection} onChange={(event) => setNewSection(event.target.value)} placeholder="新しいグループ名（例: イベント担当）" /><Button type="submit" size="sm" loading={layoutAction === "save"}>グループを追加</Button></form>
            </section>
            {layoutEditor ? <form className={styles.layoutEditor} onSubmit={submitLayoutEditor}><header><strong>{layoutEditor.kind === "section" ? "グループを編集" : layoutEditor.groupId ? "項目を編集" : "項目を追加"}</strong><button type="button" onClick={() => setLayoutEditor(null)}>閉じる</button></header><label>名前<input autoFocus required maxLength={80} value={layoutEditor.title} onChange={(event) => setLayoutEditor({ ...layoutEditor, title: event.target.value })} /></label><label>説明・補足<input maxLength={200} value={layoutEditor.description} onChange={(event) => setLayoutEditor({ ...layoutEditor, description: event.target.value })} /></label>{layoutEditor.kind === "group" ? <fieldset className={styles.colorPalette}><legend>グループカラー</legend><div>{ORGANIZATION_GROUP_PALETTE.map((color) => <label data-color={color.key} data-selected={layoutEditor.color === color.key || undefined} key={color.key}><input className="sr-only" type="radio" name="group-color" value={color.key} checked={layoutEditor.color === color.key} onChange={() => setLayoutEditor({ ...layoutEditor, color: color.key })} /><span aria-hidden="true" />{color.label}</label>)}</div></fieldset> : null}<Button type="submit" size="sm" loading={layoutAction === "save"}>保存</Button></form> : null}
            <div className={styles.groupBoard}>
              {groupSections.map((section) => (
                <section className={styles.groupSection} aria-labelledby={`editor-section-${section.id}`} key={section.id}>
                  <header className={styles.groupSectionHeader}><span aria-hidden="true">{section.index}</span><p>Member group</p><h3 id={`editor-section-${section.id}`}>{section.title}</h3><small>{section.description || "説明なし"}</small><div className={styles.layoutActions}><button type="button" onClick={() => editSection(sections.find((item) => item.id === section.id)!)}>変更</button><button type="button" onClick={() => addGroup(sections.find((item) => item.id === section.id)!)}>項目追加</button><button type="button" onClick={() => void deleteSection(sections.find((item) => item.id === section.id)!)}>削除</button></div></header>
                  <div className={styles.groupLanes}>{section.lanes.map((lane) => <div className={styles.laneEditor} key={lane.id}>{groupLane(lane)}<div className={styles.layoutActions}><button type="button" onClick={() => editGroup(section.id, lane.id)}>変更</button><button type="button" onClick={() => void deleteGroup(section.id, lane.id, lane.title)}>削除</button></div></div>)}</div>
                </section>
              ))}
            </div>
          </div>
        )}
      </section>

      {selected ? (
        <aside className={styles.inspector} aria-label="選択中のメンバーを編集">
          <div className={styles.identity}><div className={styles.avatarEditor}><Avatar user={selected} size="lg" />{!selected.userId ? <label className={styles.avatarAction}>{avatarUploading ? "更新中…" : "アイコンを変更"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={avatarUploading} onChange={(event) => void changeAvatar(event)} /></label> : null}</div><div><span>選択中</span><h2>{selected.displayName}</h2><small>{groupNames.get(selected.groupId ?? "") ?? "未分類"}</small></div></div>
          <form onSubmit={submit}>
            <fieldset><legend>公開プロフィール</legend><label>表示名{selected.userId ? <small className={styles.linkedFieldNote}>アカウントプロフィールの表示名とアイコンが使用されます。</small> : null}<input required value={selected.displayName} maxLength={80} disabled={Boolean(selected.userId)} onChange={(event) => updateSelected({ displayName: event.target.value })} /></label><label>アカウント（任意）<select value={selected.userId ?? ""} onChange={(event) => updateSelected({ userId: event.target.value || undefined })}><option value="">紐づけない</option>{accountOptions.map((account) => <option disabled={Boolean(account.organizationMemberId && account.organizationMemberId !== selected.profileId)} key={account.id} value={account.id}>{accountLabel(account)}{account.organizationMemberId && account.organizationMemberId !== selected.profileId ? "・紐づけ済み" : ""}</option>)}</select></label><label>紹介文{selected.userId ? <small className={styles.linkedFieldNote}>アカウントプロフィールの紹介文が表示されます。変更はプロフィール設定から行ってください。</small> : null}<textarea value={selected.bio} rows={4} maxLength={2_000} disabled={Boolean(selected.userId)} onChange={(event) => updateSelected({ bio: event.target.value })} /></label><label>Xbox ゲーマータグ{selected.userId ? <small className={styles.linkedFieldNote}>アカウントプロフィールのゲーマータグが表示されます。変更はプロフィール設定から行ってください。</small> : null}<input value={selected.xboxGamertag ?? ""} maxLength={50} disabled={Boolean(selected.userId)} onChange={(event) => updateSelected({ xboxGamertag: event.target.value })} /></label></fieldset>
            <fieldset><legend>Minecraftスキン</legend>{selected.userId ? <small className={styles.linkedFieldNote}>紐づけ済みメンバーのスキンは本人のプロフィール設定から変更します。</small> : <><label>腕のモデル<select value={selected.minecraftSkinModel ?? "classic"} onChange={(event) => updateSelected({ minecraftSkinModel: event.target.value as "classic" | "slim" })}><option value="classic">Classic</option><option value="slim">Slim</option></select></label><label className={styles.avatarAction}>{skinUploading ? "更新中…" : "PNGスキンを選択"}<input className="sr-only" type="file" accept="image/png" disabled={skinUploading} onChange={(event) => void changeMinecraftSkin(event)} /></label>{selected.minecraftSkinUrl ? <button className="text-button text-danger" type="button" disabled={skinUploading} onClick={() => void removeMinecraftSkin()}>スキンを削除</button> : null}<small className={styles.linkedFieldNote}>64×64または64×32のPNGに対応しています。</small></>}</fieldset>
            <fieldset><legend>役割・所属</legend><label>表示グループ<select value={selected.groupId ?? ""} onChange={(event) => updateSelected({ groupId: event.target.value || undefined, team: groupNames.get(event.target.value) ?? "" })}><option value="">未分類</option>{sections.map((section) => <optgroup key={section.id} label={section.title}>{section.groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</optgroup>)}</select></label></fieldset>
            <Button type="submit" loading={saving} fullWidth>変更を保存</Button>
          </form>
          <section className={styles.benefitSettings}>
            <div className={styles.benefitHeading}><strong>サポーター表記</strong><span>現在は手動設定です。決済連携後は、有効な設定のうち上位のプランが表示されます。</span></div>
            <div className={styles.supporterOptions} role="radiogroup" aria-label="サポーター表記">
              <label data-selected={supporterDraft === "none" || undefined}>
                <input type="radio" name="supporter-tier" value="none" checked={supporterDraft === "none"} onChange={() => setSupporterDraft("none")} />
                <span><b>表示なし</b><small>通常のプロフィールとして表示</small></span>
              </label>
              {SUPPORTER_TIERS.map((tier) => <label data-tier={tier.key} data-selected={supporterDraft === tier.key || undefined} key={tier.key}>
                <input type="radio" name="supporter-tier" value={tier.key} checked={supporterDraft === tier.key} onChange={() => setSupporterDraft(tier.key)} />
                <span><b>{tier.label}</b><small>{tier.description}</small></span>
              </label>)}
            </div>
            <Button variant="primary" size="sm" loading={supporterSaving} onClick={() => void saveSupporterTier()}>表記を保存</Button>
          </section>
          <section className={styles.dangerZone}><div><strong>公開メンバーから削除</strong><span>アカウントと通常プロフィールは削除されません。</span></div><Button variant="danger" size="sm" loading={deleting} onClick={() => void deleteSelected()}>メンバーを削除</Button></section>
        </aside>
      ) : <Alert className={styles.emptyInspector}>メンバーを追加すると、詳細を編集できます。</Alert>}
    </div>
  );
}
