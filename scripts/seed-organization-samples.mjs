import { spawnSync } from "node:child_process";

const samples = [
  {
    id: "57000000-0000-4000-8000-000000000001",
    displayName: "サンプルマスター",
    bio: "コミュニティ全体を見守り、みんなが楽しく活動できる場所づくりを担当しています。",
    role: "master",
    team: "運営",
    parent: null,
    xboxGamertag: "PMC_Master",
  },
  {
    id: "57000000-0000-4000-8000-000000000002",
    displayName: "サンプル管理者",
    bio: "イベント企画とメンバーサポートを担当しています。",
    role: "administrator",
    team: "運営",
    parent: "57000000-0000-4000-8000-000000000001",
    xboxGamertag: "PMC_Admin",
  },
  {
    id: "57000000-0000-4000-8000-000000000003",
    displayName: "サンプル鯖主",
    bio: "サーバー管理と技術面の整備をしています。",
    role: "server_owner",
    team: "運営",
    parent: "57000000-0000-4000-8000-000000000001",
    xboxGamertag: "PMC_Server",
  },
  {
    id: "57000000-0000-4000-8000-000000000004",
    displayName: "建築サンプルA",
    bio: "街並みと公共施設を中心に建築しています。",
    role: "team_member",
    team: "建築チーム",
    parent: "57000000-0000-4000-8000-000000000002",
    xboxGamertag: "PMC_BuilderA",
  },
  {
    id: "57000000-0000-4000-8000-000000000005",
    displayName: "建築サンプルB",
    bio: "自然に溶け込む建物を作るのが好きです。",
    role: "team_member",
    team: "建築チーム",
    parent: "57000000-0000-4000-8000-000000000002",
    xboxGamertag: "PMC_BuilderB",
  },
  {
    id: "57000000-0000-4000-8000-000000000006",
    displayName: "回路サンプル",
    bio: "便利な自動装置やミニゲームの回路を研究しています。",
    role: "team_member",
    team: "レッドストーンチーム",
    parent: "57000000-0000-4000-8000-000000000003",
    xboxGamertag: "PMC_Redstone",
  },
  {
    id: "57000000-0000-4000-8000-000000000007",
    displayName: "冒険サンプル",
    bio: "新しい土地の探索と資源収集を担当しています。",
    role: "team_member",
    team: "冒険チーム",
    parent: "57000000-0000-4000-8000-000000000002",
    xboxGamertag: "PMC_Explorer",
  },
  {
    id: "57000000-0000-4000-8000-000000000008",
    displayName: "みならいサンプル",
    bio: "建築や冒険を学びながら活動しています。",
    role: "trainee",
    team: "",
    parent: "57000000-0000-4000-8000-000000000004",
    xboxGamertag: "PMC_Trainee",
  },
];

function literal(value) {
  if (value === null) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

const values = samples.map((sample) => `(
  ${literal(sample.id)}, NULL, ${literal(sample.displayName)}, ${literal(sample.bio)},
  ${literal(sample.role)}, ${literal(sample.team)}, ${literal(sample.parent)},
  ${literal(sample.xboxGamertag)}, CURRENT_TIMESTAMP
)`).join(",\n");

const sql = `
INSERT INTO organization_members (
  id, "user", display_name, bio, organization_role, organization_team,
  organization_parent, xbox_gamertag, created_at
) VALUES ${values}
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  bio = EXCLUDED.bio,
  organization_role = EXCLUDED.organization_role,
  organization_team = EXCLUDED.organization_team,
  organization_parent = EXCLUDED.organization_parent,
  xbox_gamertag = EXCLUDED.xbox_gamertag,
  updated_at = CURRENT_TIMESTAMP;
`;

const result = spawnSync("docker", [
  "compose", "-f", "docker-compose.dev.yml", "--env-file", ".env.local",
  "exec", "-T", "database", "psql", "-v", "ON_ERROR_STOP=1", "-U", "pmc_website", "-d", "pmc_website",
], { cwd: new URL("..", import.meta.url), input: sql, encoding: "utf8" });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Seeded ${samples.length} account-free organization samples.`);
