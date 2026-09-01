"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { OrganizationMember } from "@/types";
import { Avatar } from "@/components/ui";
import styles from "./OrganizationChart.module.css";

export function OrganizationChart({ members }: { members: OrganizationMember[] }) {
  const [selected, setSelected] = useState<OrganizationMember | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef({ pointerId: -1, x: 0, y: 0, left: 0, top: 0, moved: false });
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [selected]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const center = () => {
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = 0;
    };
    const frame = requestAnimationFrame(center);
    window.addEventListener("resize", center);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", center);
    };
  }, []);

  function close() {
    setSelected(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as Element).closest("button, a")) return;
    const viewport = event.currentTarget;
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
      moved: false,
    };
    suppressClickRef.current = false;
    viewport.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (pan.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pan.x;
    const deltaY = event.clientY - pan.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) pan.moved = true;
    event.currentTarget.scrollLeft = pan.left - deltaX;
    event.currentTarget.scrollTop = pan.top - deltaY;
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (panRef.current.pointerId !== event.pointerId) return;
    suppressClickRef.current = panRef.current.moved;
    panRef.current.pointerId = -1;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  }

  function navigateChart(event: ReactKeyboardEvent<HTMLDivElement>) {
    const viewport = event.currentTarget;
    const distance = event.shiftKey ? 240 : 72;
    if (event.key === "Home") {
      event.preventDefault();
      resetPosition();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      viewport.scrollLeft += event.key === "ArrowLeft" ? -distance : distance;
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      viewport.scrollTop += event.key === "ArrowUp" ? -distance : distance;
    }
  }

  const teams = [...new Set(members.filter((member) => member.role === "team_member").map((member) => member.team || "未所属"))];
  const masters = members.filter((member) => member.role === "master");
  const leaders = members.filter((member) => member.role === "administrator" || member.role === "server_owner");
  const trainees = members.filter((member) => member.role === "trainee");

  function resetPosition() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const left = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    if (typeof viewport.scrollTo === "function") viewport.scrollTo({ top: 0, left, behavior: "smooth" });
    else { viewport.scrollLeft = left; viewport.scrollTop = 0; }
  }

  function cards(groupMembers: OrganizationMember[], showTeam = true) {
    return groupMembers.map((member) => <button className={styles.card} data-role={member.role} type="button" key={member.profileId} onClick={(event) => {
      openerRef.current = event.currentTarget;
      setSelected(member);
    }}>
      <Avatar user={member} size="md" />
      <span className={styles.cardBody}>
        <strong>{member.displayName}</strong>
        <span className={styles.cardMeta}><small>{member.roleLabel}</small>{showTeam && member.team ? <small>{member.team}</small> : null}</span>
      </span>
    </button>);
  }

  function levelTitle(index: string, title: string, count: number) {
    return <div className={styles.levelTitle}><span>{index}</span><h2>{title}</h2><small>{count}名</small></div>;
  }

  return <>
    <div className={styles.toolbar}>
      <div className={styles.summary} aria-label={`メンバー${members.length}名、チーム${teams.length}組`}>
        <span><strong>{members.length}</strong> MEMBERS</span>
        <i aria-hidden="true" />
        <span><strong>{teams.length}</strong> TEAMS</span>
      </div>
      <div className={styles.controls}><span id="organization-chart-help"><b aria-hidden="true">✥</b> 役割レベル順 · ドラッグ／矢印キーで移動</span><button type="button" onClick={resetPosition}>中央に戻す</button></div>
    </div>
    <div
      ref={viewportRef}
      className={`${styles.viewport} ${dragging ? styles.dragging : ""}`}
      aria-label="メンバー関係図。ドラッグまたはスワイプして移動できます。"
      aria-describedby="organization-chart-help"
      role="region"
      tabIndex={0}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onKeyDown={navigateChart}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
      }}
    >
      <div className={styles.chart}>
        {masters.length ? <section className={`${styles.level} ${styles.masterLevel}`}>{levelTitle("01", "マスター", masters.length)}<div className={styles.members}>{cards(masters)}</div></section> : null}
        {leaders.length ? <section className={`${styles.level} ${styles.leaderLevel}`}>{levelTitle("02", "管理者・鯖主", leaders.length)}<div className={styles.members}>{cards(leaders)}</div></section> : null}
        {teams.length ? <section className={`${styles.level} ${styles.teamLevel}`}>{levelTitle("03", "チーム", members.filter((member) => member.role === "team_member").length)}<div className={styles.teamRow}>
          {teams.map((team) => { const teamMembers = members.filter((member) => member.role === "team_member" && (member.team || "未所属") === team); return <section className={styles.team} key={team}><header><span className={styles.teamMark} aria-hidden="true">◆</span><h3>{team}</h3><small>{teamMembers.length}名</small></header><div className={styles.teamMembers}>{cards(teamMembers, false)}</div></section>; })}
        </div></section> : null}
        {trainees.length ? <section className={`${styles.level} ${styles.traineeLevel}`}>{levelTitle("04", "みならい", trainees.length)}<div className={styles.members}>{cards(trainees)}</div></section> : null}
      </div>
    </div>
    {selected ? <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section ref={dialogRef} className={styles.dialog} data-role={selected.role} role="dialog" aria-modal="true" aria-labelledby="member-dialog-title">
        <button ref={closeRef} className={styles.close} type="button" onClick={close} aria-label="紹介を閉じる">×</button>
        <header className={styles.dialogHeader}><Avatar user={selected} size="lg" eager /><div><p>{selected.roleLabel}</p><h2 id="member-dialog-title">{selected.displayName}</h2><span>{selected.team || "所属なし"}</span></div></header>
        <p className={styles.bio}>{selected.bio || "自己紹介はまだありません。"}</p>
        {selected.xboxGamertag ? <p className={styles.gamertag}><span>Xbox</span>{selected.xboxGamertag}</p> : null}
        {selected.userId ? <Link className={styles.profileLink} href={`/members/${selected.userId}`}>プロフィールページを見る</Link> : null}
      </section>
    </div> : null}
  </>;
}
