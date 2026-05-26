# Prompt Engineering Basics

Writing effective prompts is key to getting great results from AI image generation.

## What is a Prompt?

A prompt is a text description that tells the AI what image to generate. Think of it as instructions to an artist.

**Example**: `A modern glass house in the mountains at sunset`

## Prompt Structure

### Basic Formula
```
[Subject] + [Style] + [Details] + [Lighting] + [Quality boosters]
```

### Example Breakdown
| Part | Example |
|------|---------|
| Subject | Modern glass house |
| Style | Contemporary architecture |
| Details | Mountain location, panoramic windows |
| Lighting | Golden hour sunset |
| Quality | 8k resolution, photorealistic |

## Key Elements

### 1. Subject (Required)
What is the main focus?
- `Single-family home`
- `Office building`
- `Interior living room`
- `Landscape garden`

### 2. Style (Important)
What artistic or architectural style?
- `Modern minimalist`
- `Art Deco`
- `Brutalist concrete`
- `Japanese zen`
- `Mediterranean villa`

### 3. Materials
What surfaces and textures?
- `Glass and steel`
- `Natural wood and stone`
- `White marble facade`
- `Rustic brick exterior`

### 4. Lighting
What time of day and mood?
- `Golden hour sunset`
- `Blue hour twilight`
- `Overcast soft lighting`
- `Bright midday sun`
- `Night with interior lights`

### 5. Camera/View
What perspective?
- `Aerial view`
- `Eye-level perspective`
- `Wide angle`
- `Close-up detail`
- `Two-point perspective`

### 6. Quality Tags
Improve technical quality:
- `8k resolution`
- `Photorealistic`
- `Architectural photography`
- `Sharp focus`
- `High detail`
- `Cinematic composition`

## Prompt Length

### Short (Basic)
```
Modern house, glass facade, sunset
```
Good for: Quick drafts, concept exploration

### Medium (Balanced)
```
Contemporary minimalist house with floor-to-ceiling glass windows, 
nestled in mountain landscape, golden hour lighting, 
photorealistic architectural photography
```
Good for: Most use cases, balanced detail

### Long (Detailed)
```
Luxurious modern villa with cantilevered design, featuring natural 
stone and glass materials, infinity pool reflecting sunset sky, 
surrounded by Mediterranean olive trees, warm golden hour lighting, 
professional architectural photography, 8k resolution, 
sharp focus throughout
```
Good for: Final renders, specific vision

## Tips for Better Prompts

### ✅ Do
- Be specific about style and materials
- Mention lighting conditions
- Include camera perspective
- Add quality descriptors
- Use architectural terminology

### ❌ Don't
- Be too vague ("a nice house")
- Overload with conflicting styles
- Forget lighting (leads to flat images)
- Ignore composition/perspective
- Use negative words (see below)

## Order Matters

Words at the **beginning** have more weight:

```
// Good: Emphasis on modern
Modern minimalist house, some traditional elements

// Less good: Confused emphasis
House with modern minimalist and traditional elements
```

## Using Weights (Advanced)

Some models support emphasis:

```
(Modern:1.5) house with (glass:1.2) facade
```
Higher number = more emphasis (1.0 = normal)

## Common Architectural Prompts

### Exterior
```
[Style] house, [Materials], [Location], 
[Time of day] lighting, [View angle], 
architectural photography, 8k, photorealistic
```

### Interior
```
[Style] interior, [Room type], [Materials], 
[Lighting], [Color palette], 
interior photography, 4k, detailed
```

### Landscape
```
[Style] landscape, [Features], [Vegetation], 
[Time/weather], [Perspective], 
drone photography, wide angle, 8k
```

## Practice Examples

### Before (Basic)
```
A house
```

### After (Enhanced)
```
Modern Scandinavian house with charred wood (Shou Sugi Ban) exterior, 
large panoramic windows, pitched roof, situated in pine forest, 
misty morning atmosphere, soft diffused lighting, 
aerial perspective, architectural photography, 
8k resolution, photorealistic render
```

## Testing Your Prompts

1. **Start simple**: Add elements one by one
2. **Compare**: Generate with/without each element
3. **Iterate**: Keep what works, remove what doesn't
4. **Save**: Store successful prompts as templates

## Next Steps

- Learn about [Architectural Keywords](./02-architectural-keywords.md)
- Understand [Negative Prompts](./06-negative-prompts.md)
- Practice with different [Styles & Materials](./03-styles-materials.md)

---

**Tip**: Save your best prompts! Use them as starting points for future projects.
