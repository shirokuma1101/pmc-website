import type { Metadata } from "next";
import { MinecraftMap } from "@/components/minecraft-map";
import { getSession } from "@/lib/auth/session";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ワールドマップ",
  description: "PostMineClanの公開Minecraftワールドを地図で閲覧できます。",
};

export default async function MapPage() {
  const session = await getSession();
  return (
    <main id="main-content" className={styles.page}>
      <MinecraftMap currentUser={session?.user ?? null} />
    </main>
  );
}
