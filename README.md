# Spacebros (Electron)

This repo packages the existing `index.html` game into an Electron desktop app, with Phaser included (local `node_modules` in Electron, CDN fallback in a browser).

## Run (dev)

1. `npm install` (PowerShell note: if `npm` is blocked, use `npm.cmd`)
2. `npm run start` (or `npm run start:dev` for DevTools)

## Build installers

### Windows
- `npm run dist:win`
- Output: `dist/Neon Space Cave Setup 0.1.0.exe`

### Linux
- `npm run dist:linux`
- Output formats:
  - **AppImage** (`Neon Space Cave-0.1.0.AppImage`) - Universal Linux format
  - **deb** (`neon-space-cave_0.1.0_amd64.deb`) - Debian/Ubuntu package
  - **tar.gz** (`Neon Space Cave-0.1.0.tar.gz`) - Generic archive

### All platforms
- `npm run dist`

## Linux Installation

**AppImage** (recommended, works on most distributions):
```bash
chmod +x "Neon Space Cave-0.1.0.AppImage"
./"Neon Space Cave-0.1.0.AppImage"
```

**deb** (Debian/Ubuntu/Linux Mint):
```bash
sudo dpkg -i neon-space-cave_0.1.0_amd64.deb
```

**tar.gz** (generic):
```bash
tar -xzf "Neon Space Cave-0.1.0.tar.gz"
cd "Neon Space Cave"
./neon-space-cave
```

## Build Requirements

**Debian/Ubuntu:**
```bash
sudo apt install rpm libgtk-3-dev
```

**Fedora/RHEL:**
```bash
sudo dnf install gtk3-devel rpm-build
```

**Arch Linux:**
```bash
sudo pacman -S gtk3
```
