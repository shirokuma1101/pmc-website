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
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Minecraft World Map</p>
        <h1>ワールドマップ</h1>
        <p className={styles.description}>
          公開ワールドの地形を平面図・3D表示で探索できます。
        </p>
      </header>
      <MinecraftMap currentUser={session?.user ?? null} />
    </main>
  );
}
