# Your First Project

Let's create your first AI-generated image in 5 minutes!

## Step 1: Create New Project

Press **Ctrl+N** or click **File → New Project**

You'll see an empty canvas with the sidebar on the left.

## Step 2: Add Source Node

You have two options:

### Option A: Image Source
1. Click **+ Source** in sidebar
2. Or drag & drop an image from your computer
3. The image appears as a node on canvas

### Option B: Text Source
1. Click **+ Source** 
2. Leave image empty
3. Enter prompt in text field below

**Example Prompt**: `Modern minimalist house, glass facade, sunset lighting`

## Step 3: Add Processing Node

Right-click on the source node → **Add Child → Render**

This creates a "Ghost Node" that will process your input.

## Step 4: Configure Settings

### Select AI Model
Click on the ghost node:
- **FLUX.1 Pro**: Best quality, slower
- **FLUX.1 Realism**: Photorealistic results
- **Recraft**: Fast, good for concepts

### Adjust Settings
- **Prompt**: Describe what you want
- **Negative Prompt**: What to avoid
- **Steps**: More = better quality (20-50)
- **Guidance**: How closely to follow prompt (7-12)

## Step 5: Generate

1. Click **Generate** button in sidebar
2. Wait for progress indicator
3. Result appears as new node

## Step 6: Refine (Optional)

Not satisfied? Right-click the result node:
- **Retry**: Generate again with same settings
- **Modify**: Change prompt and regenerate
- **Add Ghost**: Chain another processing step

## Step 7: Export

Right-click the final result:
- **Save Image**: Download as PNG/JPG
- **Export All**: Batch export multiple results
- **Save Project**: Save as `.ana` file

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+N | New Project |
| Ctrl+S | Save Project |
| Ctrl+O | Open Project |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Space+Drag | Pan Canvas |
| Scroll | Zoom |
| Right-click | Context Menu |

## Tips for Success

1. **Start Simple**: One source, one processing step
2. **Good Prompts**: Be specific about style, lighting, materials
3. **Experiment**: Try different models and settings
4. **Save Often**: Press Ctrl+S regularly
5. **Use History**: Check History tab to browse past results

## Common First Projects

Try these beginner-friendly ideas:
- Transform a sketch into realistic render
- Add people/context to an architectural photo
- Change time of day (day to sunset)
- Material replacement (brick to glass)
- Style transfer (make photo look like watercolor)

---

**Next**: [Interface Overview](./04-interface.md)
