import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useFilters } from '../src/hooks/useFilters';

// Mock axios
vi.mock('axios');

describe('useFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns empty filters initially while loading', () => {
    axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useFilters());

    expect(result.current.loading).toBe(true);
    expect(result.current.filters).toEqual({ years: [], areas: [], subCategories: [] });
  });

  it('fetches and returns filters from API', async () => {
    const mockFilters = {
      years: [2024, 2023, 2022],
      areas: ['01 검사실운영', '07 종합검증'],
      subCategories: ['질관리', '검체관리']
    };

    axios.get.mockResolvedValueOnce({ data: mockFilters });

    const { result } = renderHook(() => useFilters());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.filters).toEqual(mockFilters);
    expect(axios.get).toHaveBeenCalledWith('/api/filters');
  });

  it('handles API error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    axios.get.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useFilters());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.filters).toEqual({ years: [], areas: [], subCategories: [] });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('cleans up on unmount (prevents state update)', async () => {
    let resolvePromise;
    axios.get.mockImplementation(() => new Promise(resolve => {
      resolvePromise = resolve;
    }));

    const { unmount } = renderHook(() => useFilters());

    // Unmount before promise resolves
    unmount();

    // Resolve after unmount - should not cause error
    resolvePromise({ data: { years: [2024], areas: [], subCategories: [] } });

    // No error should be thrown
  });
});
