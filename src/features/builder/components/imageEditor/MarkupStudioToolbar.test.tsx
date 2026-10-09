import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkupStudioToolbar } from './MarkupStudioToolbar';

describe('MarkupStudioToolbar 9-Tool Suite', () => {
  const defaultProps = {
    activeSubtool: 'brush' as const,
    setActiveSubtool: vi.fn(),
    activeShape: 'rect' as const,
    setActiveShape: vi.fn(),
    activeColor: '#e52b2b',
    setActiveColor: vi.fn(),
    canUndo: true,
    canRedo: true,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    engineDisplayName: 'Nano Banana 2',
    onApply: vi.fn(),
    onExit: vi.fn(),
  };

  it('renders all 9 tools with prompt bar and engine indicator', () => {
    render(<MarkupStudioToolbar {...defaultProps} />);

    // 1. Drag handle
    expect(screen.getByTitle(/Drag to reposition/i)).toBeDefined();

    // 2. Select tool
    expect(screen.getByTitle(/Select & Transform/i)).toBeDefined();

    // 3. Brush tool
    expect(screen.getByTitle(/Brush/i)).toBeDefined();

    // 4. Text tool
    expect(screen.getByTitle(/Text Label/i)).toBeDefined();

    // 5. Shapes tool
    expect(screen.getByTitle(/Geometric Shapes/i)).toBeDefined();

    // 6. Color indicator
    expect(screen.getByTitle(/Color Palette/i)).toBeDefined();

    // 7. Eraser tool
    expect(screen.getByTitle(/Eraser/i)).toBeDefined();

    // 8. Undo & Redo
    expect(screen.getByTitle(/^Undo$/i)).toBeDefined();
    expect(screen.getByTitle(/^Redo$/i)).toBeDefined();

    // 9. Exit
    expect(screen.getByTitle(/Exit Markup Mode/i)).toBeDefined();

    // Prompt bar & target engine indicator
    expect(screen.getByText('Nano Banana 2')).toBeDefined();
    expect(screen.getByText('Generate')).toBeDefined();
  });

  it('submits prompt instruction and calls onApply with input text', () => {
    const onApply = vi.fn();
    render(<MarkupStudioToolbar {...defaultProps} onApply={onApply} />);

    const input = screen.getByPlaceholderText(/Describe your edit based on the markup/i);
    fireEvent.change(input, { target: { value: 'Add arched balcony windows' } });

    const submitBtn = screen.getByTitle(/Send to engine/i);
    fireEvent.click(submitBtn);

    expect(onApply).toHaveBeenCalledWith('Add arched balcony windows');
  });

  it('calls onExit when clicking exit button', () => {
    const onExit = vi.fn();
    render(<MarkupStudioToolbar {...defaultProps} onExit={onExit} />);

    const exitBtn = screen.getByTitle(/Exit Markup Mode/i);
    fireEvent.click(exitBtn);

    expect(onExit).toHaveBeenCalled();
  });
});
