import React from 'react';
import { Building2, DraftingCompass, Ruler, Upload } from 'lucide-react';

export interface StarterCardItem {
  icon: React.ReactNode;
  title: string;
  desc: string;
  prompt?: string;
  style?: string;
  typology?: string;
  area?: number;
  isUpload?: boolean;
}

export interface CuratedConceptItem {
  title: string;
  desc: string;
  text: string;
}

export const STARTER_CARDS: StarterCardItem[] = [
  {
    icon: <Building2 size={16} className="starter-icon rose" />,
    title: 'Luxury Modern Villa',
    desc: '500m² plot, beige travertine stone, double-glazed panoramic glass, central courtyard pool',
    prompt: 'Design a luxury modern villa on a 500m² site with beige travertine stone cladding, double-glazed panoramic windows, and an illuminated central courtyard pool.',
    style: 'Luxury Residential Villa',
    typology: 'Residential Villa',
    area: 500,
  },
  {
    icon: <DraftingCompass size={16} className="starter-icon blue" />,
    title: 'Biophilic Office Complex',
    desc: 'Commercial tower with vertical green terraces, solar louvers, and open timber atrium',
    prompt: 'Synthesize a commercial biophilic office building with stepped green garden terraces, responsive solar louvers, and a grand 4-story timber atrium.',
    style: 'Modern Contemporary',
    typology: 'Commercial Office',
    area: 1200,
  },
  {
    icon: <Ruler size={16} className="starter-icon green" />,
    title: 'Code Compliance & Setbacks',
    desc: 'Verify municipal setbacks, floor area ratio (FAR), and building zoning constraints',
    prompt: 'Perform a comprehensive architectural zoning and building code compliance check for a mixed-use project on an 800m² urban parcel.',
    style: 'Modern Contemporary',
    typology: 'Mixed-Use Complex',
    area: 800,
  },
  {
    icon: <Upload size={16} className="starter-icon purple" />,
    title: 'Upload Sketch / Plan',
    desc: 'Multimodal vision analysis of hand-drawn sketches or 2D floor plans for massing & render',
    isUpload: true,
  },
];

export const CURATED_CONCEPTS: CuratedConceptItem[] = [
  {
    title: 'Minimalist Nordic Residence',
    desc: 'Cantilevered volumes, raw concrete, pine forest integration',
    text: 'Minimalist concrete villa with cantilevered glass volumes, black metal trims, and pine forest backdrop.',
  },
  {
    title: 'Modern Mashrabiya Estate',
    desc: 'Perforated geometric screens, central courtyard, passive cooling',
    text: 'Modern Middle Eastern villa featuring geometric perforated stone screens, interior courtyard oasis, and passive cooling.',
  },
  {
    title: 'Parametric Waterfront Hotel',
    desc: 'Wave-inspired curved balconies overlooking oceanfront marina',
    text: 'Organic fluid high-rise resort with wave-inspired curved balconies overlooking oceanfront marina.',
  },
];
