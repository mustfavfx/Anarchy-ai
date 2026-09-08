import { describe, it, expect } from 'vitest';
import { snapToGuides, snapToOrthoAngle, type Guide } from './RulerGuidesOverlay';

describe('RulerGuidesOverlay math utilities', () => {
  it('snaps coordinates to nearest guide within threshold', () => {
    const guides: Guide[] = [
      { id: 'g1', orientation: 'vertical', pos: 100 },
      { id: 'g2', orientation: 'horizontal', pos: 250 },
    ];

    // Point near vertical guide (96, 50) -> should snap X to 100
    const snap1 = snapToGuides(96, 50, guides, 8);
    expect(snap1.snappedX).toBe(true);
    expect(snap1.x).toBe(100);
    expect(snap1.snappedY).toBe(false);
    expect(snap1.y).toBe(50);

    // Point near horizontal guide (300, 252) -> should snap Y to 250
    const snap2 = snapToGuides(300, 252, guides, 8);
    expect(snap2.snappedX).toBe(false);
    expect(snap2.x).toBe(300);
    expect(snap2.snappedY).toBe(true);
    expect(snap2.y).toBe(250);

    // Point far from guides -> no snap
    const snap3 = snapToGuides(50, 50, guides, 8);
    expect(snap3.snappedX).toBe(false);
    expect(snap3.snappedY).toBe(false);
    expect(snap3.x).toBe(50);
    expect(snap3.y).toBe(50);
  });

  it('snaps angles to nearest orthogonal 45° step', () => {
    // Exactly 0 degrees (horizontal)
    const ortho0 = snapToOrthoAngle(0, 0, 100, 5, 45);
    expect(ortho0.angleDeg).toBe(0);
    expect(ortho0.y).toBe(0);

    // Nearly 45 degrees
    const ortho45 = snapToOrthoAngle(0, 0, 100, 95, 45);
    expect(ortho45.angleDeg).toBe(45);
    expect(ortho45.x).toBe(ortho45.y); // At 45°, deltaX === deltaY

    // Nearly 90 degrees (vertical)
    const ortho90 = snapToOrthoAngle(0, 0, 4, 100, 45);
    expect(ortho90.angleDeg).toBe(90);
    expect(ortho90.x).toBe(0);
  });
});
