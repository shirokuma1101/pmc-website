# Security policy

## Architecture boundary

This repository contains the Next.js frontend and BFF together with the local
Directus schema, bootstrap automation, and custom endpoint extension. It does
not contain runtime databases, uploads, credentials, session tokens, or
production Directus configuration.

The `/pmc-website` Directus extension is the authorization boundary for
frontend content operations. Public and member access to the corresponding
standard Directus collection and file APIs must remain disabled. Verify this
boundary with `npm run cms:smoke` after schema, policy, or extension changes.

The bootstrap and smoke-test scripts intentionally reject non-loopback
Directus URLs. Do not remove this guard or run development automation against
production.

## Secrets

- Never commit `.env`, `.env.local`, cookies, tokens, private keys, database
  credentials, administrator passwords, or license keys.
- Treat `NEXT_PUBLIC_*` values as public browser configuration. Never put a
  secret in these variables.
- Keep production Directus secrets on the Directus host, preferably through a
  secret manager or Docker secrets.
- Rotate a credential immediately if it is exposed in Git history, logs,
  screenshots, issues, or build artifacts.

## Deployment

- Use HTTPS for both the frontend and production Directus.
- Keep `AUTH_COOKIE_SECURE=true` in production.
- Set the frontend canonical URLs and Directus CORS origins explicitly; do not
  use wildcard production origins.
- Bind containers only to the intended reverse proxy or private interface.
- Back up the Directus database, uploads, and extensions before schema or
  version changes, and inspect schema changes with a dry run first.
- Apply dependency and container updates only after the full verification
  suite passes.

## Automated security checks

The `Security` GitHub Actions workflow runs on pull requests, changes to
`main`, every Monday, and manual dispatch. It performs:

- `npm audit` for high and critical dependency vulnerabilities.
- Gitleaks scanning across the complete Git history.
- CodeQL analysis for JavaScript and TypeScript.
- Trivy scanning of the built frontend container for fixable high and critical
  operating-system and library vulnerabilities.

Dependabot checks npm, Docker, and GitHub Actions dependencies each Monday.
Review generated pull requests and run the full verification suite before
merging them; do not enable automatic merging for security updates without
reviewing behavior changes.

Run the checks available without extra local tools using:

```text
npm run security:check
```

Container scanning is performed in GitHub Actions. To reproduce it locally,
install the free Trivy CLI, build the frontend image as documented in the
workflow, and run Trivy with `HIGH,CRITICAL` severity and `--ignore-unfixed`.

Gitleaks Action does not require a license key for repositories owned by a
personal GitHub account. Organization-owned repositories may require a
`GITLEAKS_LICENSE` repository secret. CodeQL code scanning requires a public
repository or an eligible GitHub Code Security plan.

## Reporting

Do not put secrets, personal information, `.env` files, screenshots containing
tokens, or production responses in public issues. Enable GitHub private
vulnerability reporting before making the repository public.
