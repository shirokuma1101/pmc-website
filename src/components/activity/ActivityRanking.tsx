import Link from "next/link";
import { Avatar } from "@/components/ui";
import type { ActivityRanking as ActivityRankingData } from "@/types";

const periodFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

export function ActivityRanking({ ranking }: { ranking: ActivityRankingData }) {
  const inclusiveUntil = new Date(ranking.until);
  inclusiveUntil.setUTCDate(inclusiveUntil.getUTCDate() - 1);
  const period = `${periodFormatter.format(new Date(ranking.since))}〜${periodFormatter.format(inclusiveUntil)}`;

  return (
    <aside className="activity-ranking" aria-labelledby="activity-ranking-title">
      <div className="activity-ranking__heading">
        <div><p className="eyebrow">Activity ranking</p><h2 id="activity-ranking-title">活動ランキング</h2></div>
        <span>3か月間</span>
      </div>
      <p className="activity-ranking__period">集計期間: {period}</p>
      {ranking.entries.length ? (
        <ol className="activity-ranking__list">
          {ranking.entries.map((entry) => (
            <li key={entry.user.id}>
              <span className="activity-ranking__position" aria-label={`${entry.rank}位`}>{entry.rank}</span>
              <Link href={`/members/${entry.user.id}`}>
                <Avatar user={entry.user} size="sm" /><span>{entry.user.displayName}</span>
              </Link>
              <strong>{entry.activityExp.toLocaleString("ja-JP")} <small>Exp</small></strong>
            </li>
          ))}
        </ol>
      ) : <p className="activity-ranking__empty">直近3か月の活動はまだありません。</p>}
      <p className="activity-ranking__rules">Article 10 · Post 5 · Like 1 Exp</p>
    </aside>
  );
}
