---
name: build-release-manager
description: Manage Electron builds and releases for Spacebros1. Build for multiple platforms, generate changelogs, manage versioning, and validate assets. Use when preparing releases, building distributables, or managing deployment.
metadata:
  short-description: Manage Electron builds and releases
---

# Build & Release Manager

Manage Electron builds, versioning, and releases for Spacebros1.

## Build Scripts

### Development

```bash
# Run in normal mode
npm start

# Run with DevTools (for debugging)
npm run start:dev

# Run smoke test (auto-closes after load)
npm run start:smoke
```

### Production Builds

```bash
# Build for current platform
npm run dist

# Build for Windows (NSIS installer)
npm run dist:win

# Build for Linux (AppImage, deb, tar.gz)
npm run dist:linux
```

**Output:** `dist/` directory

## Build Outputs

### Windows
- `Neon Space Cave Setup X.Y.Z.exe` - NSIS installer

### Linux
- `Neon Space Cave-X.Y.Z.AppImage` - Universal Linux package
- `neonspacecave_X.Y.Z_amd64.deb` - Debian/Ubuntu package
- `Neon Space Cave-X.Y.Z.tar.gz` - Tarball archive

## Version Management

### Current Version

Located in `package.json`:

```json
{
  "version": "0.1.0"
}
```

### Bumping Version

Update version in `package.json`:

```bash
# Patch version (0.1.0 -> 0.1.1)
# Minor version (0.1.0 -> 0.2.0)
# Major version (0.1.0 -> 1.0.0)

# Edit package.json
vim package.json  # or use your editor

# Then rebuild
npm run dist
```

### Semantic Versioning

- **Major**: Breaking changes, major features
- **Minor**: New features, content additions
- **Patch**: Bug fixes, small improvements

## Release Workflow

### 1. Pre-Release Checklist

```bash
# Run smoke test
npm run start:smoke

# Check for uncommitted changes
git status

# Verify all assets are included
ls assets/
```

**Required assets:**
- Sprites: `assets/*.png`
- Audio: `assets/sfx/*.mp3`
- Fonts: (if applicable)

### 2. Generate Changelog

```bash
# View recent commits
git log --oneline -10

# Generate changelog from commits since last tag
git log <last_tag>..HEAD --pretty=format:"- %s"
```

**Changelog format:**
```markdown
## Version X.Y.Z (YYYY-MM-DD)

### Added
- New feature 1
- New feature 2

### Fixed
- Bug fix 1
- Bug fix 2

### Changed
- Modification 1
```

### 3. Build Release

```bash
# Build for current platform
npm run dist

# Or build for specific platforms
npm run dist:win   # Windows
npm run dist:linux # Linux
```

### 4. Test Release

Run the built executable to verify:
- Game launches correctly
- All assets load
- Audio works
- No console errors

### 5. Tag Release

```bash
# Create git tag
git tag -a v0.1.0 -m "Release version 0.1.0"

# Push tag
git push origin v0.1.0
```

## Build Configuration

**File:** `package.json` (build section)

```json
{
  "build": {
    "appId": "com.spacebros.neonspacecave",
    "productName": "Neon Space Cave",
    "files": [
      "package.json",
      "electron/**/*",
      "assets/**/*",
      "src/**/*",
      "index.html",
      "node_modules/phaser/dist/phaser.min.js"
    ],
    "directories": {
      "output": "dist"
    }
  }
}
```

## Electron Builder Options

### Common Options

```bash
# Build for specific architecture
electron-builder --win --x64
electron-builder --win --ia32

# Build portable version (no installer)
electron-builder --win --x64 --portable

# Build with specific output directory
electron-builder --win --x64 --output dist/win
```

### Linux Options

```bash
# Build only AppImage
electron-builder --linux appimage

# Build only deb
electron-builder --linux deb

# Build only tar.gz
electron-builder --linux tar.gz
```

## Troubleshooting

### Build Fails

**Common issues:**
1. Missing assets - Check `assets/` directory
2. Missing dependencies - Run `npm install`
3. Electron not installed - Run `npm install electron`

### Missing Assets in Build

Check `package.json` build configuration:

```json
"files": [
  "package.json",
  "electron/**/*",
  "assets/**/*",     // Ensure this is included
  "src/**/*",
  "index.html"
]
```

### Large Build Size

Causes:
- DevDependencies included
- Unnecessary files
- Large assets

**Solutions:**
- Use `asarUnpack` only for needed files
- Compress assets
- Remove unused dependencies

## Automation Script

Create `scripts/release.sh`:

```bash
#!/bin/bash
set -e

VERSION=$1
if [ -z "$VERSION" ]; then
    echo "Usage: ./release.sh X.Y.Z"
    exit 1
fi

echo "Releasing version $VERSION"

# Update version in package.json
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

# Generate changelog
echo "## Version $VERSION ($(date +%Y-%m-%d))" > CHANGELOG_NEW.md
git log --pretty=format:"- %s" $(git describe --tags --abbrev=0)..HEAD >> CHANGELOG_NEW.md
cat CHANGELOG.md >> CHANGELOG_NEW.md
mv CHANGELOG_NEW.md CHANGELOG.md

# Commit
git add package.json CHANGELOG.md
git commit -m "Release version $VERSION"

# Tag
git tag -a "v$VERSION" -m "Release version $VERSION"

# Build
npm run dist

echo "Release $VERSION complete!"
echo "Files in dist/:"
ls -lh dist/
```

## Files of Interest

| File | Purpose |
|------|---------|
| `package.json` | Version, build config, scripts |
| `electron/main.js` | Electron main process |
| `electron/preload.js` | Context bridge |
| `electron-builder.yml` | Alternative build config (optional) |
| `dist/` | Build output directory |

## Quick Reference

```bash
# Quick build for current platform
npm run dist

# Quick version bump
# 1. Edit package.json version
# 2. npm run dist

# Full release
# 1. Update version in package.json
# 2. Generate changelog from git log
# 3. npm run dist
# 4. Test built executable
# 5. git tag vX.Y.Z
# 6. git push origin vX.Y.Z
```
