import type { OrganizationRole } from "@/types";

export const organizationRoleOptions: ReadonlyArray<readonly [OrganizationRole, string]> = [
  ["master", "マスター"],
  ["administrator", "管理者"],
  ["server_owner", "鯖主"],
  ["team_member", "チームメンバー"],
  ["trainee", "みならい"],
];

export const coreRoleGroups: ReadonlyArray<{
  role: OrganizationRole;
  label: string;
  caption: string;
}> = [
  { role: "master", label: "マスター", caption: "全体方針" },
  { role: "administrator", label: "管理者", caption: "企画・サポート" },
  { role: "server_owner", label: "鯖主", caption: "技術・サーバー管理" },
];

export function organizationRoleLabel(role: OrganizationRole) {
  return organizationRoleOptions.find(([value]) => value === role)?.[1] ?? role;
}
