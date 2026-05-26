# Node Library Overview

Anarchy AI uses a node-based workflow system. This guide explains all available nodes and their functions.

## What Are Nodes?

Nodes are visual building blocks that you connect to create workflows:
- Each node performs a specific function
- Nodes connect via edges (lines)
- Data flows from left to right
- Results can branch and merge

## Node Types

### 1. Source Nodes (Green)
Starting points of your workflow.

**Purpose**: Define input image or text prompt

**Properties**:
- Image upload
- Text prompt input
- Seed value (for reproducibility)
- Initial settings

**Usage**:
- Drag image to create
- Click "+ Source" button
- Can have multiple outputs

---

### 2. Ghost Nodes (Blue)
Processing and transformation nodes.

**Purpose**: AI processing and image manipulation

**Types**:
- **Render** - Generate from prompt
- **Restyle** - Change artistic style
- **Modify** - Edit specific elements
- **Upscale** - Increase resolution
- **Variate** - Create variations

**Properties**:
- AI Model selection
- Prompt input
- Negative prompt
- Steps (quality vs speed)
- Guidance scale
- Resolution settings

**Usage**:
- Right-click parent node → Add Child
- Can chain multiple ghost nodes
- Each can have different settings

---

### 3. Result Nodes (Purple)
Final output nodes.

**Purpose**: Store and export final images

**Properties**:
- Final image display
- Metadata (model, prompt, settings)
- Export options
- History link

**Usage**:
- Created automatically after generation
- Can have multiple result nodes
- Each stores independently

## Node Connections

### Parent → Child
- Data flows from parent to child
- Child inherits parent's image/prompt
- Child can modify or transform

### Multiple Outputs
- One parent can have many children
- Each child gets same input
- Different children = different processing

### Chaining
```
Source → Ghost1 → Ghost2 → Result
```
- Sequential processing
- Each step refines the image
- Full workflow history preserved

## Working with Nodes

### Creating Nodes
| Method | Action |
|--------|--------|
| Drag image | Creates Source node |
| + Source button | New empty source |
| Right-click node | Add Child Ghost |
| Copy/Paste | Duplicate existing |

### Selecting Nodes
- **Click**: Select single node
- **Shift+Click**: Add to selection
- **Drag box**: Select multiple
- **Ctrl+A**: Select all

### Moving Nodes
- **Drag**: Move selected node
- **Drag group**: Move all selected
- **Auto-arrange**: Click Rearrange button

### Deleting Nodes
- **Delete key**: Remove selected
- **Right-click → Delete**: Context menu
- **Backspace**: Also removes

**Note**: Deleting parent removes all children

## Node Properties Panel

When you select a node, the sidebar shows:

### Common Properties
- **Node Type** (display only)
- **Node ID** (for reference)
- **Created Date**

### Source Node Properties
- **Image Preview**
- **Replace Image** button
- **Prompt** (if text-only)
- **Seed** value

### Ghost Node Properties
- **Processing Type**
- **AI Model** dropdown
- **Prompt** input
- **Negative Prompt** input
- **Steps** slider (1-50)
- **Guidance Scale** (1-20)
- **Resolution** preset
- **Aspect Ratio**

### Result Node Properties
- **Full Image Preview**
- **Generated Settings** (read-only)
- **Export** buttons
- **Add to History** toggle

## Node States

Visual indicators show status:

| Icon | State | Meaning |
|------|-------|---------|
| ⏳ | Pending | Waiting to process |
| 🔄 | Processing | AI working |
| ✅ | Complete | Done successfully |
| ⚠️ | Warning | Done with issues |
| ❌ | Error | Failed |
| 👻 | Ghost | Not yet generated |

## Advanced Node Features

### Batch Processing
- Select multiple ghost nodes
- Click "Generate All"
- Processes in sequence

### Compare Mode
- Select two result nodes
- Right-click → Compare
- Side-by-side view

### Node Templates
- Save node settings as template
- Reuse in future projects
- Share with team

### Node Notes
- Add text notes to any node
- Document your workflow
- Instructions for collaborators

## Node Shortcuts

| Shortcut | Action |
|----------|--------|
| Tab | Add child to selected |
| Delete | Remove selected node |
| Ctrl+D | Duplicate node |
| Ctrl+C | Copy node settings |
| Ctrl+V | Paste settings |
| Enter | Edit selected node |
| F2 | Rename node |

## Best Practices

1. **Name Your Nodes**: Double-click title to rename
2. **Group by Purpose**: Keep related nodes together
3. **Use Colors**: Tag nodes by category
4. **Document**: Add notes to complex workflows
5. **Save Templates**: Reuse common setups

## Troubleshooting

### Node Won't Connect
- Check node types (only certain connections allowed)
- Ensure parent is processed
- No circular references allowed

### Ghost Node Not Generating
- Verify API key is set
- Check prompt isn't empty
- Ensure valid model selected

### Result Not Saving
- Check storage space
- Verify history is enabled
- Try manual export

---

**Next**: [AI Generation Nodes](./02-ai-generation.md)
