import { describe, it, expect } from 'vitest';
import { architecturalMaterialExtractor } from './ArchitecturalMaterialExtractor';
import { designDNAService, ARCHITECTURAL_DNA_PROFILES, BUILDING_CODES } from './DesignDNAService';

describe('Architectural Knowledge & Verification Engines', () => {
  it('extracts default tectonic material palette with physical lighting profile', () => {
    const palette = architecturalMaterialExtractor.getDefaultPalette();
    expect(palette).toBeDefined();
    expect(palette.colors.length).toBeGreaterThanOrEqual(4);
    expect(palette.materials.length).toBeGreaterThanOrEqual(3);
    expect(palette.colors.some(c => c.hex.startsWith('#'))).toBe(true);

    const promptText = architecturalMaterialExtractor.generateMaterialPrompt(palette);
    expect(promptText).toContain('authentic tactile material specification');
    expect(promptText).toContain('Honed Roman Travertine');
  });

  it('audits Salmani architectural design against SBC 1101 code accurately', () => {
    const report = designDNAService.auditCompliance('salmani', 'SBC_1101', {
      siteAreaM2: 800,
      estimatedCoveragePercent: 60,
      floors: 2,
    });

    expect(report).toBeDefined();
    expect(report.complianceScore).toBe(100);
    expect(report.status).toBe('fully-compliant');
    expect(report.dna.nameAr).toContain('السلمانية');
    expect(report.checks.length).toBeGreaterThanOrEqual(5);
    expect(report.metrics.groundCoverageM2).toBe(480);
    expect(report.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  it('detects violations when coverage exceeds building code limit', () => {
    const report = designDNAService.auditCompliance('dubai_luxury', 'DUBAI_MUNICIPALITY', {
      siteAreaM2: 500,
      estimatedCoveragePercent: 75, // Max is 60%
      floors: 2,
    });

    expect(report.complianceScore).toBeLessThan(100);
    expect(report.status).toBe('minor-deviations');
    const coverageCheck = report.checks.find(c => c.item.includes('Coverage'));
    expect(coverageCheck?.passed).toBe(false);
  });
});
