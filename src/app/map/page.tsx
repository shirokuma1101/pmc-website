import type { Metadata } from "next";
import { MinecraftMap } from "@/components/minecraft-map";
import { getSession } from "@/lib/auth/session";
import { getMySupporterTier } from "@/lib/directus/organization";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ワールドマップ",
  description: "PostMineClanの公開Minecraftワールドを地図で閲覧できます。",
};

export default async function MapPage() {
  const session = await getSession();
  const supporterTier = session ? await getMySupporterTier(session.accessToken).catch(() => null) : null;
  const mapHistoryEnabled = Boolean(session?.user.isAdmin || supporterTier === "basic" || supporterTier === "standard" || supporterTier === "premium");
  return (
    <main id="main-content" className={styles.page}>
      <MinecraftMap currentUser={session?.user ?? null} mapHistoryEnabled={mapHistoryEnabled} />
    </main>
  );
}
