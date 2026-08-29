import styles from "./MinecraftMap.module.css";
import type { MinecraftMapSnapshot } from "@/lib/minecraft-map/types";

interface MapTimelineProps {
  snapshots: MinecraftMapSnapshot[];
  selectedId: string | null;
  onSelect: (snapshotId: string) => void;
  onClose: () => void;
}

function snapshotLabel(snapshot: MinecraftMapSnapshot) {
  if (snapshot.label) return snapshot.label;
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.createdAt));
}

export function MapTimeline({ snapshots, selectedId, onSelect, onClose }: MapTimelineProps) {
  const selectedIndex = Math.max(0, snapshots.findIndex((snapshot) => snapshot.id === selectedId));
  const selected = snapshots[selectedIndex];
  const latestIndex = Math.max(0, snapshots.length - 1);
  const disabled = snapshots.length < 2;
  return (
    <section className={styles.mapTimeline} aria-label="地図の履歴">
      <div className={styles.timelineHeading}>
        <div>
          <p className={styles.timelineEyebrow}>Map history</p>
          <h2>地図のタイムライン</h2>
        </div>
        <div className={styles.timelineHeaderActions}>
          <output className={styles.timelineCurrent} aria-live="polite">
            <span>{selectedIndex === latestIndex ? "現在" : "過去"}</span>
            {selected ? snapshotLabel(selected) : "最新の地図"}
          </output>
          <button className={styles.timelineClose} type="button" onClick={onClose} aria-label="タイムラインを閉じる">×</button>
        </div>
      </div>

      <div className={styles.timelineControls}>
        <button type="button" disabled={disabled || selectedIndex === 0} onClick={() => onSelect(snapshots[selectedIndex - 1]!.id)} aria-label="前の地図へ移動">‹</button>
        <div className={styles.timelineTrack}>
          <input
            type="range"
            min="0"
            max={latestIndex}
            value={selectedIndex}
            disabled={disabled}
            onChange={(event) => onSelect(snapshots[Number(event.target.value)]!.id)}
            aria-label="地図の日時"
          />
          <div className={styles.timelineLabels} aria-hidden="true">
            <span>過去</span>
            <span className={styles.timelineLatest}>最新</span>
          </div>
        </div>
        <button type="button" disabled={disabled || selectedIndex === latestIndex} onClick={() => onSelect(snapshots[selectedIndex + 1]!.id)} aria-label="次の地図へ移動">›</button>
        <button type="button" className={styles.latestButton} disabled={disabled || selectedIndex === latestIndex} onClick={() => onSelect(snapshots[latestIndex]!.id)}>最新へ戻る</button>
      </div>
      <p className={styles.timelineHint}>{disabled ? "履歴データが追加されると、撮影日時を選んで過去の地図へ切り替えられます。" : `${snapshots.length}件の地図履歴から選択できます。`}</p>
    </section>
  );
}
