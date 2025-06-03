# Publishing Types Package

This document describes how to publish the `bmap-api-types` package to npm.

## Automated Process

The types package publishing is fully automated using the script at `scripts/publish-types.ts`.

### What the script does:

1. **Copies types** from the main `types.ts` file to `packages/types/src/core.ts`
2. **Checks npm registry** for the latest published version
3. **Bumps version** automatically from npm version (patch version: 0.0.x)
4. **Updates version** in both `package.json` and `src/index.ts`
5. **Builds** the TypeScript package  
6. **Publishes** to npm (if `--publish` flag is used)

### Available Commands:

#### Build types only (no publish)
```bash
bun run build:types
```
This will:
- Copy and sync types
- Check npm registry for latest version
- Bump patch version (e.g., 0.0.3 → 0.0.4)
- Build the package
- **NOT** publish to npm

#### Build and publish to npm
```bash
bun run publish:types
```
This will:
- Do everything above
- **Publish** to npm as `bmap-api-types@0.0.x`

#### Test publish (dry run)
```bash
bun run publish:types:dry
```
This will:
- Do everything except the actual publish
- Show what would be published
- Safe to test without affecting npm

### Prerequisites for Publishing:

1. **npm login**: You must be logged in to npm
   ```bash
   npm login
   ```

2. **Permissions**: You need publish permissions for the `bmap-api-types` package

### Version Strategy:

- **Patch versions**: 0.0.x (automated bumps)
- **Minor versions**: 0.x.0 (manual for feature additions)
- **Major versions**: x.0.0 (manual for breaking changes)

### Manual Version Bumping:

If you need to bump minor or major versions manually:

```bash
cd packages/types
npm version minor  # 0.0.4 → 0.1.0
npm version major  # 0.1.0 → 1.0.0
```

Then run the build script:
```bash
bun run build:types
```

### Workflow Integration:

The types package should be published:
- **After major API changes**
- **When new types are added**
- **When existing types are modified**
- **Before releasing new API versions**

### Troubleshooting:

#### "Not logged in to npm"
```bash
npm login
npm whoami  # verify login
```

#### "Permission denied"
Contact the package owner to add you as a maintainer.

#### "Version already exists"
The script automatically bumps versions, but if there's a conflict:
```bash
cd packages/types
npm version patch  # manually bump
```

### Package Details:

- **Package name**: `bmap-api-types`
- **npm registry**: https://www.npmjs.com/package/bmap-api-types
- **Repository**: https://github.com/b-open-io/bmap-api
- **License**: MIT 