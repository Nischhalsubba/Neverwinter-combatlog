# Strikeglass Deployment Contract

The repository-root `wrangler.toml` is the only authoritative Cloudflare Workers configuration. `app/wrangler.toml` is intentionally removed to prevent two configuration identities from drifting.

Strikeglass currently treats the hosting integration as the single production deployment owner. GitHub Actions validates and fingerprints the production package but does not also publish production, avoiding duplicate deployment mechanisms.

## Production package identity

`pnpm build` creates `app/public` once and writes:

- `asset-manifest.json` with SHA-256 and byte size for every shipped file
- `build-manifest.json` with application version, source SHA, parser/verifier/catalog hashes, hashed entry assets, and one aggregate artifact identity
- hashed JavaScript and CSS entry assets under `public/assets/`

The production build excludes the unused Supabase browser integration so the local-first package does not ship optional cloud client code.

CI browser privacy and performance checks run against `app/public`, so the exact assembled artifact receives browser validation before it is considered release-ready.

## Release discipline

Normal flow is branch -> PR -> CI -> merge -> release gate -> one production deployment -> health verification. A successful CI build is not permission to deploy automatically. Production should be released only when production-affecting files changed, the exact artifact is new, required configuration is available, and no other production deployment is active.
