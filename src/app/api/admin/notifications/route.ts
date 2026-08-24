import { dataResponse, withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import { getPendingArticles } from "@/lib/directus/articles";
import { getPendingRegistrations } from "@/lib/directus/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return withRouteErrors(async () => {
    const session = await requireAdminSession();
    const [articles, registrations] = await Promise.all([
      getPendingArticles(session.accessToken, { page: 1, limit: 10 }),
      getPendingRegistrations(session.accessToken),
    ]);

    const items = [
      ...articles.data.map((article) => ({
        id: article.id,
        kind: "review" as const,
        title: "記事のレビュー依頼",
        detail: `${article.author.displayName}「${article.title}」`,
        createdAt: article.updatedAt ?? article.createdAt,
        href: `/admin/reviews/${article.id}`,
      })),
      ...registrations.map((registration) => ({
        id: registration.id,
        kind: "registration" as const,
        title: "アカウント承認依頼",
        detail: registration.displayName,
        createdAt: registration.createdAt,
        href: "/admin/registrations",
      })),
    ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

    return dataResponse({
      items: items.slice(0, 12),
      total: (articles.pagination.total ?? articles.data.length) + registrations.length,
    }, 200, {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    });
  });
}
