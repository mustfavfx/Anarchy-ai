---
description: How to publish app updates to all users
---
# 🚀 Publishing App Updates

## Prerequisites

1. GitHub repository secrets must be configured:
   - `TAURI_SIGNING_PRIVATE_KEY` - Signing key for updates
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - Key password

## How to Publish an Update

### Method 1: Using Git Tags (Recommended)

1. Update version in `package.json` and `src-tauri/tauri.conf.json`
2. Commit changes:
   ```bash
   git add .
   git commit -m "Bump version to v0.7.1"
   ```
3. Create and push a tag:
   ```bash
   git tag v0.7.1
   git push origin v0.7.1
   ```
4. GitHub Actions will automatically:
   - Build for Windows, macOS, and Linux
   - Create GitHub Release
   - Upload update metadata

### Method 2: Manual Workflow

1. Go to GitHub → Actions → "Publish Release"
2. Click "Run workflow"
3. Enter version number (e.g., `0.7.1`)
4. Click "Run workflow"

## What Happens Next

### For You (Developer):
- GitHub builds all platforms
- Creates release with installers
- Uploads `latest.json` for auto-updates

### For Users:
- App checks for updates every startup (after 3 seconds)
- **Mandatory blocking modal appears** - cannot use app until updated
- Download starts automatically
- Progress bar shows download status
- App **auto-restarts** after update completes
- No way to skip or dismiss the update!

## Update File Structure

```
releases/
├── latest.json           # Update metadata
├── anarchy-ai_0.7.1_x64-setup.exe    # Windows
├── anarchy-ai_0.7.1_x64.dmg          # macOS Intel
├── anarchy-ai_0.7.1_aarch64.dmg      # macOS Apple Silicon
└── anarchy-ai_0.7.1_amd64.AppImage   # Linux
```

## Testing Updates Locally

1. Build locally:
   ```bash
   npm run tauri:build
   ```
2. Install the app
3. Publish a new version
4. Check if update notification appears

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No update notification | Check `tauri.conf.json` endpoint URL |
| Download fails | Verify GitHub release exists |
| Signature error | Check signing key in secrets |
