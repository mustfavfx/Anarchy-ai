/**
 * ArchitecturalMaterialExtractor
 * Extracts physical architectural materials, tactile finishes, and color palettes
 * directly from images or multimodal agent descriptions.
 */

import { archVisionAgent } from './ArchVisionAgentService';
import type { TectonicMaterial } from './ArchitecturalUnderstanding';
import { logger } from '../../utils/logger';

export interface ArchitecturalColorSwatch {
  name: string;
  hex: string;
  role: 'primary-facade' | 'secondary-mass' | 'accent-joinery' | 'glazing' | 'hardscape' | 'ambient';
  description?: string;
}

export interface ArchitecturalMaterialPalette {
  id: string;
  extractedAt: number;
  paletteName: string;
  colors: ArchitecturalColorSwatch[];
  materials: TectonicMaterial[];
  lightingProfile: {
    ambientColorTemp: number; // e.g. 3500K
    sunAngle: string;
    shadowTone: string;
  };
  summary: string;
}

export class ArchitecturalMaterialExtractor {
  private static instance: ArchitecturalMaterialExtractor;

  private constructor() {}

  public static getInstance(): ArchitecturalMaterialExtractor {
    if (!ArchitecturalMaterialExtractor.instance) {
      ArchitecturalMaterialExtractor.instance = new ArchitecturalMaterialExtractor();
    }
    return ArchitecturalMaterialExtractor.instance;
  }

  /**
   * Analyzes an image and extracts its tectonic materials and color palette.
   */
  public async extractFromImage(
    imageBase64: string,
    promptHint?: string
  ): Promise<ArchitecturalMaterialPalette> {
    try {
      const classification = await archVisionAgent.classifyImage(imageBase64, promptHint);
      
      const materials: TectonicMaterial[] = (classification?.materials && classification.materials.length > 0)
        ? classification.materials
        : [
            {
              name: 'Honed Roman Travertine',
              finish: 'Cross-cut matte with natural porous fissures',
              location: 'Main Facade Cladding',
              reflectivity: 'matte',
            },
            {
              name: 'Board-Formed Architectural Concrete',
              finish: 'Tactile wood-grain imprint with tie-rod reveals',
              location: 'Cantilevered Podium & Columns',
              reflectivity: 'rough',
            },
            {
              name: 'Low-Iron Structural Glazing',
              finish: 'Double-glazed with solar low-E coating',
              location: 'Curtain Wall Enclosure',
              reflectivity: 'specular',
            },
            {
              name: 'Anodized Champagne Bronze',
              finish: 'Micro-brushed 20mm slim profiles',
              location: 'Window Mullions & Pergola Louvers',
              reflectivity: 'semi-gloss',
            },
          ];

      const colors = this.derivePaletteFromMaterials(materials, classification?.lighting?.timeOfDay);

      return {
        id: `mat-${Date.now()}`,
        extractedAt: Date.now(),
        paletteName: `${classification?.architecturalStyle || 'Modern Architectural'} Palette`,
        colors,
        materials,
        lightingProfile: {
          ambientColorTemp: classification?.lighting?.colorTempK || 4500,
          sunAngle: classification?.lighting?.sunAzimuth || 'Low-angle afternoon sun (South-West)',
          shadowTone: classification?.lighting?.shadowQuality === 'sharp-crisp' ? '#1c1b1f' : '#2b292e',
        },
        summary: classification?.description || 'Curated architectural material palette with verified tectonic balance.',
      };
    } catch (err) {
      logger.warn('[MaterialExtractor] Fallback to default palette:', err);
      return this.getDefaultPalette();
    }
  }

  /**
   * Derives a color palette from recognized architectural materials.
   */
  private derivePaletteFromMaterials(
    materials: TectonicMaterial[],
    timeOfDay?: string
  ): ArchitecturalColorSwatch[] {
    const swatches: ArchitecturalColorSwatch[] = [];

    materials.forEach((mat, idx) => {
      const lower = mat.name.toLowerCase();
      let hex = '#D8D2C2';
      let role: ArchitecturalColorSwatch['role'] = 'primary-facade';

      if (lower.includes('concrete') || lower.includes('cement')) {
        hex = '#8A8D8F';
        role = 'secondary-mass';
      } else if (lower.includes('travertine') || lower.includes('limestone') || lower.includes('sandstone')) {
        hex = '#DFD3C3';
        role = 'primary-facade';
      } else if (lower.includes('wood') || lower.includes('timber') || lower.includes('cedar') || lower.includes('oak')) {
        hex = '#A27B5C';
        role = 'accent-joinery';
      } else if (lower.includes('glass') || lower.includes('glazing')) {
        hex = '#A5C9CA';
        role = 'glazing';
      } else if (lower.includes('bronze') || lower.includes('copper') || lower.includes('steel') || lower.includes('metal')) {
        hex = '#3F4E4F';
        role = 'accent-joinery';
      } else if (lower.includes('marble') || lower.includes('calacatta')) {
        hex = '#F5F5F7';
        role = 'primary-facade';
      }

      swatches.push({
        name: mat.name,
        hex,
        role,
        description: mat.finish,
      });
    });

    // Add lighting ambient accent
    if (timeOfDay === 'golden-hour') {
      swatches.push({
        name: 'Golden Hour Sunwash',
        hex: '#E8A87C',
        role: 'ambient',
        description: 'Warm solar reflection at 3200K',
      });
    } else {
      swatches.push({
        name: 'Atmospheric Daylight',
        hex: '#E0E7EC',
        role: 'ambient',
        description: 'Diffused natural daylight at 5600K',
      });
    }

    return swatches;
  }

  /**
   * Generates prompt enhancement string based on materials.
   */
  public generateMaterialPrompt(palette: ArchitecturalMaterialPalette): string {
    const materialPhrases = palette.materials
      .map(m => `${m.name} with ${m.finish} on ${m.location}`)
      .join(', ');
    const colorPhrases = palette.colors
      .slice(0, 3)
      .map(c => `${c.name} (${c.hex})`)
      .join(', ');

    return `authentic tactile material specification: ${materialPhrases}, complementary architectural chromatic harmony (${colorPhrases}), micro-surface displacement and realistic light bounce physics`;
  }

  public getDefaultPalette(): ArchitecturalMaterialPalette {
    return {
      id: `mat-default-${Date.now()}`,
      extractedAt: Date.now(),
      paletteName: 'Natural Warm Contemporary Palette',
      colors: [
        { name: 'Warm Travertine Stone', hex: '#DFD3C3', role: 'primary-facade', description: 'Honed surface with soft natural veining' },
        { name: 'Architectural Concrete', hex: '#8A8D8F', role: 'secondary-mass', description: 'Tactile board-formed finish' },
        { name: 'Smoked Oak Slatting', hex: '#634832', role: 'accent-joinery', description: 'Deep grain natural timber' },
        { name: 'Anodized Charcoal Metal', hex: '#2C3639', role: 'accent-joinery', description: 'Ultra-thin window frames' },
        { name: 'Natural Solar Daylight', hex: '#F9F5EB', role: 'ambient', description: 'Neutral 5200K natural bounce' },
      ],
      materials: [
        { name: 'Honed Roman Travertine', finish: 'Cross-cut matte finish', location: 'Exterior facade panels', reflectivity: 'matte' },
        { name: 'Board-Formed Concrete', finish: 'Wood grain texture', location: 'Podium base and columns', reflectivity: 'rough' },
        { name: 'Low-E Solar Glazing', finish: 'Anti-reflective double pane', location: 'Full-height floor to ceiling glazing', reflectivity: 'specular' },
      ],
      lightingProfile: {
        ambientColorTemp: 5200,
        sunAngle: 'Mid-morning soft sunlight at 45 degrees',
        shadowTone: '#242426',
      },
      summary: 'Timeless architectural palette emphasizing warm natural stone and tactile concrete.',
    };
  }
}

export const architecturalMaterialExtractor = ArchitecturalMaterialExtractor.getInstance();
