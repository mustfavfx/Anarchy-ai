# Enhance Region + Smart Mask — integration notes

Independent implementation, not derived from any competitor's compiled code.
Built around ANARCHY's own GhostNode / hold-commit-release model.

## Files

- `types.ts` — shared interfaces
- `geometry.ts` — screen→canvas→image space conversion, geometry lock mask + blend
- `classifier.ts` — heuristic + Gemini vision fallback surface classifier, cached
- `maskTools.ts` — brush strokes, snap-to-element spatial grid, binary mask rasterizer
- `engines.ts` — engine registry + per-capability payload builder (binary_mask / semantic_text / hybrid)
- `creditLedger.ts` — hold → commit/release, idempotent commit, derived balance
- `presetsAndMemory.ts` — 62-preset filtering/ranking, project memory read/write
- `useGhostGeneration.ts` — concurrency-capped parallel generation with `Promise.allSettled`
- `NodeInspectorPanel.tsx` — the Enhance/Draw tabs, wires everything together

## Wire before use

1. **`callEngine`** — point at the same Replicate dispatch `EnginesViewModel` already uses.
2. **`totalBalance` / credit persistence** — replace the local `ledger` state with
   your real `useBuilderCredits`; `getAvailableCredits(totalBalance, ledger)` should
   become the single source the UI reads from everywhere, not a separately
   mutated counter (this is what the credit-charging bug traced back to).
3. **`detectClosedContours` / `runLSD`** — pass in your existing CAD Vision Pro
   contour + line-detection functions (`maskTools.ts`, `geometry.ts`).
4. **`onCommitChildNode`** — wire to `HistoryService.save` with `parentId`/`rootId`
   lineage, same pattern you already use.
5. **`projectMemory`** — persist inside your `.ana` project file under a new
   `projectMemory` section, not a separate file, so it travels with the project.
6. **Element pre-computation** — call `precomputeElements` once per image load
   (background task), not per click; the `SpatialGrid` is what keeps clicks fast.

## Notes

- `maskToDataUrl` in `engines.ts` has a placeholder for `OffscreenCanvas` → data
  URL conversion — swap in whatever helper you already use for that in your
  Electron/Tauri runtime (`convertToBlob` + `FileReader`, or a native bridge call).
- Flux Fill Pro/Dev take a literal binary mask. Nano Banana 2 does not — it's
  mask-free and works from the text description built in `engines.ts`. Nano
  Banana Pro accepts both. If you add engines later, always set `maskCapability`
  explicitly rather than assuming.
