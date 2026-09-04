// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const snapshot = readFileSync(new URL("../../../directus/schema/snapshot.yaml", import.meta.url), "utf8");

describe("Directus profile validation snapshot", () => {
  it("wraps the role operator in its field name, as required by generateJoi", () => {
    const field = snapshot.match(/  - collection: profiles\r?\n    field: organization_role\r?\n[\s\S]*?(?=\r?\n  - collection:|$)/)?.[0];
    expect(field).toBeDefined();
    expect(field).toMatch(/      validation:\r?\n        organization_role:\r?\n          _in:\r?\n/);
    expect(field).not.toMatch(/      validation:\r?\n        _in:/);
    for (const role of ["master", "administrator", "server_owner", "team_member", "trainee"]) {
      expect(field).toContain(`            - ${role}`);
    }
  });
});
