# Interface Overview

Understanding the Anarchy AI interface will help you work more efficiently.

## Main Layout

```
┌─────────────────────────────────────────────┐
│  HEADER (Menu, Project Name, Actions)        │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ SIDEBAR  │      CANVAS (Main Workspace)     │
│ (Tools)  │                                  │
│          │      • Nodes are placed here     │
│          │      • Connect nodes with edges  │
│          │      • Pan/Zoom freely           │
│          │                                  │
│          ├──────────────────────────────────┤
│          │  HISTORY (Bottom Panel)          │
├──────────┴──────────────────────────────────┤
│  STATUS BAR (Zoom, Node Count, API Status)   │
└─────────────────────────────────────────────┘
```

## Header Bar

### Left Side
- **Menu** (☰): File, Edit, View, Help
- **Project Name**: Click to rename

### Right Side
- **New** (Ctrl+N): Clear canvas
- **Undo/Redo**: Step through changes
- **Save** (Ctrl+S): Save to `.ana` file
- **Settings**: App preferences

## Sidebar (Left)

### Tools Section
- **+ Source**: Add image/prompt source node
- **Generate**: Start AI processing
- **Clear**: Remove all nodes
- **Rearrange**: Auto-organize layout

### Properties Panel
When a node is selected:
- **Type**: Source/Ghost/Result
- **Prompt**: Input text
- **Model**: AI model selection
- **Settings**: Steps, guidance, etc.
- **Actions**: Delete, retry, export

### Quick Actions
- **History**: Open history modal
- **Export**: Quick export options
- **Help**: Documentation

## Canvas (Center)

The infinite workspace where you build workflows.

### Navigation
- **Pan**: Space + drag or middle-click drag
- **Zoom**: Mouse wheel or Ctrl + scroll
- **Fit All**: Double-click background or press F

### Node Types

#### Source Node (Green)
- Starting point of workflow
- Contains input image or prompt
- Can have multiple children

#### Ghost Node (Blue)
- Processing step
- AI generation happens here
- Can chain to more ghosts

#### Result Node (Purple)
- Final output
- Contains generated image
- Can be exported

### Interactions
- **Click**: Select node
- **Double-click**: View full image
- **Right-click**: Context menu
- **Drag**: Move node
- **Drag edge handle**: Connect to another node

## History Panel (Bottom)

Shows recent generations:
- **Thumbnails**: Preview of results
- **Source**: Grouped by input image
- **Search**: Find past generations
- **Star**: Mark favorites
- **Send to Canvas**: Restore to workflow

## Status Bar

Information at bottom:
- **Zoom Level**: Current canvas zoom %
- **Node Count**: Total nodes on canvas
- **API Status**: Connection to AI service
- **Progress**: Current generation status

## Context Menus

### Canvas (Right-click empty)
- Add Source Node
- Paste Image
- Rearrange Layout
- Zoom to Fit

### Node (Right-click)
- Add Child Node
- Duplicate
- Delete
- Export Image
- View in History

## Panels & Modals

### Documentation (F1)
- Browse help topics
- Search documentation
- Video tutorials

### Settings (Ctrl+,)
- API configuration
- Interface preferences
- Default values
- Keyboard shortcuts

### Export Modal
- Choose format (PNG, JPG, PDF)
- Select quality
- Batch export options

## Customization

### Resize Sidebar
Drag the divider between sidebar and canvas.

### Full Screen
Press F11 or View → Full Screen

### Themes
Settings → Appearance:
- Dark (default)
- Light
- High Contrast

## Productivity Tips

1. **Use Keyboard Shortcuts**: Faster than clicking
2. **Pin Sidebar**: Keep it open for quick access
3. **Auto-arrange**: Let AI organize your nodes
4. **Star Favorites**: Mark important results
5. **Search History**: Find past work quickly

---

**Next**: [Keyboard Shortcuts](./05-shortcuts.md)
