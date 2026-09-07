import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

describe('useFocusTrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns a ref object', () => {
    const { result } = renderHook(() =>
      useFocusTrap({ isActive: true })
    );
    expect(result.current).toBeDefined();
    expect(result.current.current).toBeNull();
  });

  it('fires onEscape when Escape key is pressed', () => {
    const onEscape = vi.fn();
    renderHook(() =>
      useFocusTrap({ isActive: true, onEscape })
    );

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(event);

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('does not fire onEscape when not active', () => {
    const onEscape = vi.fn();
    renderHook(() =>
      useFocusTrap({ isActive: false, onEscape })
    );

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(event);

    expect(onEscape).not.toHaveBeenCalled();
  });
});
