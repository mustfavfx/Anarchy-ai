# Quick Start Video Tutorial Guide

This written guide accompanies the Quick Start video (5:30).

## Before You Start

### Prerequisites
- Anarchy AI installed
- Replicate API key configured
- Sample image ready (optional)

### What You'll Learn
- Create a basic workflow
- Generate your first AI image
- Export and save results
- Use keyboard shortcuts

## Step-by-Step

### 1. New Project (0:00-0:45)

**Video**: Opening screen and new project

**Actions**:
1. Launch Anarchy AI
2. Press **Ctrl+N** for new project
3. Or click **File → New**
4. Empty canvas appears

**Tip**: New projects start fresh - previous work auto-saved

---

### 2. Add Source (0:45-2:00)

**Video**: Adding source image

**Actions**:
1. Click **+ Source** in sidebar
2. File picker opens
3. Select your image
4. Or: Drag image directly onto canvas

**What happens**:
- Green source node appears
- Image displayed on node
- Properties shown in sidebar

**Alternative**: Type prompt instead of image
1. Click + Source
2. Don't select image
3. Type in prompt field: `Modern villa with pool`

---

### 3. Add Processing (2:00-3:30)

**Video**: Right-click menu and adding ghost node

**Actions**:
1. Right-click on source node
2. Menu appears with options
3. Hover over **Add Child**
4. Select **Render**

**What happens**:
- Blue ghost node appears
- Connected to source by line
- Ghost node selected automatically

**Configure the ghost**:
1. In sidebar, select model:
   - FLUX.1 [pro] for quality
   - FLUX.1 [schnell] for speed
2. Enter prompt: `Transform into photorealistic render, sunset lighting`
3. Keep default settings for now

---

### 4. Generate (3:30-4:30)

**Video**: Clicking Generate and waiting

**Actions**:
1. Click **Generate** button (sidebar)
2. Progress indicator appears
3. Wait for completion

**What happens**:
- Ghost node shows loading state
- Progress bar in status bar
- Purple result node appears when done

**Time**: 10-30 seconds depending on model

---

### 5. View Result (4:30-5:00)

**Video**: Double-clicking to view full image

**Actions**:
1. Result node shows thumbnail
2. Double-click to enlarge
3. Click X or outside to close

**Compare**:
- Side panel shows before/after if source was image

---

### 6. Export (5:00-5:30)

**Video**: Right-click export options

**Actions**:
1. Right-click result node
2. Select **Save Image**
3. Choose format (PNG/JPG)
4. Select location
5. Click Save

**Alternative**: Use **Ctrl+E** shortcut

---

## Common Issues

### "No API Key"
**Fix**: Go to Settings → AI Models → Add Replicate key

### "Generation Failed"
**Try**: 
- Check internet connection
- Select different model
- Simplify prompt

### "Can't See Result"
**Check**: 
- Look for purple node
- Check if ghost completed (not error)
- Zoom out to find nodes (F to fit)

## Next Steps

After completing this tutorial:
1. Try with different source images
2. Experiment with prompts
3. Add multiple ghost nodes
4. Explore different models

## Practice Exercise

Create this workflow:
```
[House Photo] → [Render: Make modern] → [Result]
```

Time target: Under 2 minutes

---

**Related**: [Your First Project](../getting-started/03-first-project.md)
