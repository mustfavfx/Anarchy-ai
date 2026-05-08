import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    close: vi.fn(),
  })),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

// Mock Replicate Service
vi.mock('../services/replicate', () => ({
  replicateService: {
    generateImage: vi.fn(),
    upscaleImage: vi.fn(),
    updateApiKey: vi.fn(),
  },
}));
