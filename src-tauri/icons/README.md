# App Icons

Put your app icons here with these names:

- `32x32.png` - Taskbar icon (Windows/Linux)
- `128x128.png` - Desktop icon
- `128x128@2x.png` - High DPI displays
- `icon.icns` - macOS icon
- `icon.ico` - Windows executable icon

## Generating Icons

Use the Tauri icon CLI:

```bash
npx tauri icon /path/to/your/icon.png
```

Or use an online converter:
- https://icoconvert.com/ (for .ico)
- https://cloudconvert.com/png-to-icns (for .icns)

## Recommended Icon Specs

- **Source**: 1024x1024 PNG with transparency
- **Format**: Square, no rounded corners (system handles that)
- **Colors**: Should work on both light and dark backgrounds

## Default Icon

Until you add your own icons, Tauri will use a default placeholder icon.
