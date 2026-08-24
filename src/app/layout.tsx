import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/layout";
import { CookieConsent, GoogleAnalytics } from "@/components/privacy";
import { getSession } from "@/lib/auth/session";
import { getPublicAppUrl } from "@/lib/config";
import "./globals.css";

export const dynamic = "force-dynamic";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
});

const notoSerifJp = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  display: "swap",
});

const themeInitializer = `(function(){try{var s=localStorage.getItem("pmc-theme");var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  title: {
    default: "PostMineClan — 好きなものが創れる世界",
    template: "%s | PostMineClan",
  },
  description: "小さな活動と、まとまった思考を仲間と残す活動記録サイト。",
  applicationName: "PostMineClan",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "PostMineClan",
    images: [{ url: "/pmc-logo.png", width: 1600, height: 1600, alt: "PostMineClan" }],
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  return (
    <html
      lang="ja"
      className={`${notoSansJp.variable} ${notoSerifJp.variable}`}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body>
        <div className="site-frame">
          <SiteHeader currentUser={session?.user ?? null} isAdmin={session?.user.isAdmin ?? false} />
          <div className="site-content">{children}</div>
          <SiteFooter />
          <CookieConsent />
          <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} />
        </div>
      </body>
    </html>
  );
}
