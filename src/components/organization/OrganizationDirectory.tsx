"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Avatar, EmptyState } from "@/components/ui";
import { MinecraftSkinViewer } from "@/components/profile";
import { supporterTierLabel, supporterTierPriority } from "@/lib/organization/supporter";
import type { OrganizationGroupColor, OrganizationMember, OrganizationSection, SupporterTier } from "@/types";

import styles from "./OrganizationDirectory.module.css";

function memberSupporterTier(member: OrganizationMember): SupporterTier | undefined {
  return member.supporterTier ?? (member.highlighted ? "supporter" : undefined);
}

function GroupMember({ member, groupLabel, groupColor, onSelect }: { member: OrganizationMember; groupLabel: string; groupColor?: OrganizationGroupColor; onSelect: () => void }) {
  const supporterTier = memberSupporterTier(member);
  return (
    <button className={styles.groupMember} data-color={groupColor} data-highlighted={member.highlighted || undefined} data-supporter-tier={supporterTier} data-role={member.role} onClick={onSelect} type="button">
      <Avatar user={member} size="sm" />
      <span className={styles.groupMemberText}>
        <strong>{member.displayName}</strong>
        <small>{groupLabel}</small>
        {supporterTier ? <em className={styles.groupMemberBadge}>{supporterTierLabel(supporterTier)}</em> : null}
      </span>
    </button>
  );
}

export function OrganizationDirectory({ members, sections }: { members: OrganizationMember[]; sections: OrganizationSection[] }) {
  const [view, setView] = useState<"members" | "groups">("members");
  const [selected, setSelected] = useState<OrganizationMember | null>(null);
  const groupNames = useMemo(() => new Map(sections.flatMap((section) => section.groups.map((group) => [group.id, group.label] as const))), [sections]);
  const groupColors = useMemo(() => new Map(sections.flatMap((section) => section.groups.map((group) => [group.id, group.color] as const))), [sections]);
  const groupSections = useMemo(() => sections.map((section) => ({
    ...section,
    groups: section.groups.map((group) => ({ ...group, members: members.filter((member) => member.groupId === group.id) })),
  })).filter((section) => section.groups.length), [members, sections]);
  const profileMembers = useMemo(() => members
    .map((member, index) => ({ member, index }))
    .sort((left, right) => supporterTierPriority(memberSupporterTier(right.member)) - supporterTierPriority(memberSupporterTier(left.member)) || left.index - right.index)
    .map(({ member }) => member), [members]);
  const groupCount = groupSections.reduce((total, section) => total + section.groups.length, 0);

  return (
    <section className={styles.directory} aria-label="メンバーディレクトリ">
      <div className={styles.tabs} role="tablist" aria-label="メンバー表示の切り替え">
        <button id="members-tab" role="tab" aria-controls="members-panel" aria-selected={view === "members"} onClick={() => setView("members")} type="button">
          <span aria-hidden="true">▦</span><strong>プロフィール一覧</strong><small>{members.length}名</small>
        </button>
        <button id="groups-tab" role="tab" aria-controls="groups-panel" aria-selected={view === "groups"} onClick={() => setView("groups")} type="button">
          <span aria-hidden="true">⌘</span><strong>役割・所属</strong><small>{groupCount}グループ</small>
        </button>
      </div>

      {view === "members" ? (
        <div id="members-panel" role="tabpanel" aria-labelledby="members-tab" className={styles.panel}>
          {members.length ? <div className={styles.grid}>
            {profileMembers.map((member) => (
              <button className={styles.profileCard} data-color={groupColors.get(member.groupId ?? "")} data-highlighted={member.highlighted || undefined} data-supporter-tier={memberSupporterTier(member)} data-role={member.role} key={member.profileId} onClick={() => setSelected(member)} type="button">
                {memberSupporterTier(member) ? <span className={styles.memberBadge}>{supporterTierLabel(memberSupporterTier(member))}</span> : null}
                <header>
                  <Avatar user={member} size="lg" />
                  <div><p>{groupNames.get(member.groupId ?? "") ?? "未分類"}</p><h3>{member.displayName}</h3></div>
                </header>
                <p className={styles.bio}>{member.bio || "紹介文はまだありません。"}</p>
              </button>
            ))}
          </div> : <EmptyState title="該当するメンバーはいません" description="検索条件や役職を変更してみてください。" symbol="人" />}
        </div>
      ) : (
        <div id="groups-panel" role="tabpanel" aria-labelledby="groups-tab" className={styles.panel}>
          <div className={styles.groupBoard}>
            {groupSections.map((section) => (
              <section className={styles.groupSection} aria-labelledby={`group-section-${section.id}`} key={section.id}>
                <header className={styles.groupSectionHeader}>
                  <p>Member groups</p>
                  <h3 id={`group-section-${section.id}`}>{section.title}</h3>
                  <small>{section.description}</small>
                </header>
                <div className={styles.groupLanes}>
                  {section.groups.map((group) => (
                    <section className={styles.groupLane} aria-labelledby={`group-${group.id}`} data-color={group.color} key={group.id}>
                      <header>
                        <div><p>{group.caption}</p><h4 id={`group-${group.id}`}>{group.label}</h4></div>
                        <strong>{group.members.length}<small>名</small></strong>
                      </header>
                      <div className={styles.groupMembers}>
                        {group.members.map((member) => (
                          <GroupMember member={member} groupColor={group.color} groupLabel={group.label} key={member.profileId} onSelect={() => setSelected(member)} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
      {selected ? <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="member-detail-title">
          <button className={styles.modalClose} type="button" aria-label="詳細を閉じる" onClick={() => setSelected(null)}>×</button>
          <header className={styles.modalHeader}><Avatar user={selected} size="lg" /><div><p>{groupNames.get(selected.groupId ?? "") ?? "未分類"}</p><h2 id="member-detail-title">{selected.displayName}</h2>{memberSupporterTier(selected) ? <b className={styles.modalBadge} data-supporter-tier={memberSupporterTier(selected)}>{supporterTierLabel(memberSupporterTier(selected))}</b> : null}</div></header>
          <p className={styles.modalBio}>{selected.bio || "紹介文はまだありません。"}</p>
          {selected.xboxGamertag ? <p className={styles.modalGamertag}><span>Xbox</span>{selected.xboxGamertag}</p> : null}
          {selected.minecraftSkinUrl ? <div className={styles.modalSkin}><MinecraftSkinViewer skinUrl={selected.minecraftSkinUrl} model={selected.minecraftSkinModel} label={selected.displayName} /><small>ドラッグで回転・ホイールやピンチで拡大縮小</small></div> : null}
          {selected.userId ? <Link className={styles.modalProfileLink} href={`/members/${selected.userId}`}>プロフィールページを見る <span aria-hidden="true">→</span></Link> : <span className={styles.accountless}>プロフィールページはありません</span>}
        </section>
      </div> : null}
    </section>
  );
}
