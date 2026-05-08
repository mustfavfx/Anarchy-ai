# KIE API Integration Plan for Anarchy AI

## Executive Summary
Integrate KIE AI image generation API with support for 10+ models including FLUX, Stable Diffusion, DALL-E 3, and specialized models for various use cases.

---

## Phase 1: Core Infrastructure (Week 1)

### 1.1 API Service Layer ✅ DONE
**Files Created:**
- `src/services/kie/KieService.ts` - Main API service
- `src/services/kie/index.ts` - Exports

**Features:**
- Type-safe API client with 10 models
- Automatic retry logic
- Configurable timeouts
- Model capability detection
- Img2Img support

### 1.2 Model Support Matrix

| Model | Type | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| FLUX.1 [dev] | Open | Medium | ⭐⭐⭐⭐⭐ | General purpose |
| FLUX.1 [schnell] | Open | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Quick drafts |
| FLUX.1 [pro] | Paid | Medium | ⭐⭐⭐⭐⭐ | Commercial |
| SDXL | Open | Medium | ⭐⭐⭐⭐ | Versatile |
| SD 3 | Open | Medium | ⭐⭐⭐⭐⭐ | Modern arch |
| Kandinsky | Open | Slow | ⭐⭐⭐⭐ | Artistic |
| Animagine | Open | Medium | ⭐⭐⭐⭐ | Anime/Manga |
| RealVisXL | Open | Medium | ⭐⭐⭐⭐⭐ | Portraits |
| DALL-E 3 | API | Fast | ⭐⭐⭐⭐⭐ | Creative |
| Midjourney | API | Medium | ⭐⭐⭐⭐⭐ | Artistic |

### 1.3 Configuration
```typescript
// .env
VITE_KIE_API_KEY=your_api_key_here
VITE_KIE_BASE_URL=https://api.kie.ai/v1
```

---

## Phase 2: UI Implementation (Week 1-2)

### 2.1 AI Control Panel ✅ DONE
**Files Created:**
- `src/features/builder/AIControlPanel.tsx`
- `src/features/builder/AIControlPanel.css`

**Features:**
- Model selection grid with categories
- Parameter sliders (Steps, CFG, Strength)
- Seed control with randomize
- Real-time capability display
- Collapsible sections

### 2.2 Integration Points

**Update `useBuilderWorkflow.ts`:**
```typescript
// Add to executeNode
const executeNode = async (nodeId, prompt, config) => {
  const result = await kieService.generateImg2Img({
    model: selectedModel,  // From AI Control Panel
    prompt,
    steps: params.steps,
    cfg: params.cfg,
    seed: params.seed,
    strength: params.strength
  }, inputImageBase64);
  
  return result.imageUrl;
};
```

**Update Right Sidebar:**
- Replace "AI features coming soon" with `AIControlPanel`
- Pass selected model and params to workflow

---

## Phase 3: Workflow Integration (Week 2)

### 3.1 Enhanced Node Processing

**Ghost Node → Result Transformation:**
```
User clicks Generate
    ↓
AI Control Panel provides:
  - Selected model
  - Parameters
    ↓
KieService.generateImg2Img()
    ↓
Transform Ghost → Result
    ↓
Display generated image
```

### 3.2 State Management

**Add to BuilderNodeData:**
```typescript
interface BuilderNodeData {
  // ... existing fields
  aiConfig?: {
    model: KIEModel;
    steps: number;
    cfg: number;
    seed?: number;
    strength?: number;
  };
}
```

### 3.3 Progress Tracking

**Features:**
- Real-time generation progress
- Queue management for multiple nodes
- Retry on failure
- Cancellation support

---

## Phase 4: Advanced Features (Week 3)

### 4.1 Batch Processing
- Process multiple ghost nodes in parallel
- Queue system with priority
- Resource management

### 4.2 Preset System
```typescript
interface GenerationPreset {
  name: string;
  model: KIEModel;
  params: Partial<KIEGenerationParams>;
  category: 'render' | 'upscale' | 'variation' | 'custom';
}

const BUILT_IN_PRESETS: GenerationPreset[] = [
  {
    name: 'Photorealistic',
    model: 'flux-dev',
    params: { steps: 30, cfg: 7.5 },
    category: 'render'
  },
  {
    name: 'Fast Draft',
    model: 'flux-schnell',
    params: { steps: 4, cfg: 1 },
    category: 'render'
  },
  {
    name: 'Anime Style',
    model: 'animagine',
    params: { steps: 28, cfg: 7 },
    category: 'render'
  }
];
```

### 4.3 Cost Tracking
```typescript
interface UsageStats {
  generationsToday: number;
  creditsUsed: number;
  estimatedCost: number;
  byModel: Record<KIEModel, number>;
}
```

---

## Phase 5: Quality Assurance (Week 3-4)

### 5.1 Testing Checklist
- [ ] All 10 models generate successfully
- [ ] Img2Img with strength 0-100% works
- [ ] Error handling for failed generations
- [ ] Network retry logic
- [ ] UI responsive on different screen sizes
- [ ] Dark/light mode compatibility

### 5.2 Performance Optimization
- Image caching
- Lazy loading of model info
- Debounced parameter changes
- Optimistic UI updates

---

## Technical Architecture

### Data Flow
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AI Control    │────▶│  KieService.ts  │────▶│   KIE API       │
│   Panel UI      │     │  (HTTP Client)  │     │   (External)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ useBuilderWorkflow│     │  Error Handler  │
│    (State)      │◀────│  (Retry Logic)  │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│   GhostNode     │
│  (Transforms to)│
│   ResultNode    │
└─────────────────┘
```

### API Request Structure
```typescript
POST /v1/generate/img2img
{
  "model": "flux-dev",
  "prompt": "Modern interior design with natural lighting",
  "negative_prompt": "blurry, low quality, distorted",
  "image": "base64encoded...",
  "strength": 0.75,
  "width": 1024,
  "height": 1024,
  "steps": 28,
  "cfg": 7.5,
  "seed": 123456789,
  "scheduler": "euler_a"
}
```

### Response Structure
```typescript
{
  "id": "gen_abc123",
  "image_url": "https://cdn.kie.ai/...",
  "seed": 123456789,
  "generation_time_ms": 4500
}
```

---

## UI Design Guidelines

### Color Scheme
- Primary: `#e11d48` (Rose/Red)
- Secondary: `#3b82f6` (Blue)
- Background: `#0a0a0c` (Near black)
- Card: `rgba(255,255,255,0.02)`
- Border: `rgba(255,255,255,0.06)`

### Typography
- Headers: 13px, weight 700, uppercase, letter-spacing 0.08em
- Body: 12px, weight 400
- Values: 12px, weight 700, monospace

### Spacing
- Card padding: 16px
- Grid gap: 10px
- Section gap: 16px
- Border radius: 12px (cards), 10px (buttons)

---

## Next Steps

1. **Integrate AIControlPanel into RightSidebar**
   - Replace placeholder
   - Connect to workflow

2. **Update executeNode with real API**
   - Remove mock data
   - Add kieService calls

3. **Add error handling UI**
   - Toast notifications
   - Retry buttons

4. **Test with real API key**
   - Validate all models
   - Check generation quality

---

## Success Metrics

- ✅ 10 models accessible from UI
- ✅ Generation completes in < 10 seconds (fast models)
- ✅ < 5% error rate
- ✅ Zero UI crashes during generation
- ✅ Smooth parameter adjustments
