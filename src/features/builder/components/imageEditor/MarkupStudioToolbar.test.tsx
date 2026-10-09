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
    expect(screen.getByTitle(/1\. اسحب الشريط/)).toBeDefined();

    // 2. Select tool
    expect(screen.getByTitle(/2\. سهم التحديد/)).toBeDefined();

    // 3. Brush tool
    expect(screen.getByTitle(/3\. الفرشاة/)).toBeDefined();

    // 4. Text tool
    expect(screen.getByTitle(/4\. الكتابة/)).toBeDefined();

    // 5. Shapes tool
    expect(screen.getByTitle(/5\. الأشكال الهندسية/)).toBeDefined();

    // 6. Color indicator
    expect(screen.getByTitle(/6\. اختيار الألوان/)).toBeDefined();

    // 7. Eraser tool
    expect(screen.getByTitle(/7\. ممحاة احترافية/)).toBeDefined();

    // 8. Undo & Redo
    expect(screen.getByTitle(/8\. تراجع/)).toBeDefined();
    expect(screen.getByTitle(/8\. إعادة/)).toBeDefined();

    // 9. Exit
    expect(screen.getByTitle(/9\. الخروج من وضع Markup/)).toBeDefined();

    // Prompt bar & target engine indicator
    expect(screen.getByText('Nano Banana 2')).toBeDefined();
    expect(screen.getByText('تطبيق وتوليد')).toBeDefined();
  });

  it('submits prompt instruction and calls onApply with input text', () => {
    const onApply = vi.fn();
    render(<MarkupStudioToolbar {...defaultProps} onApply={onApply} />);

    const input = screen.getByPlaceholderText(/صف التعديل المطلوب حسب الرسم/);
    fireEvent.change(input, { target: { value: 'إضافة نافذة مقوسة كلاسيكية' } });

    const submitBtn = screen.getByTitle(/Send to engine/);
    fireEvent.click(submitBtn);

    expect(onApply).toHaveBeenCalledWith('إضافة نافذة مقوسة كلاسيكية');
  });

  it('calls onExit when clicking exit button', () => {
    const onExit = vi.fn();
    render(<MarkupStudioToolbar {...defaultProps} onExit={onExit} />);

    const exitBtn = screen.getByTitle(/9\. الخروج من وضع Markup/);
    fireEvent.click(exitBtn);

    expect(onExit).toHaveBeenCalled();
  });
});
