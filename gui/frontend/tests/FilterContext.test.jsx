import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { FilterProvider, useFilterContext } from '../src/contexts/FilterContext';

// Mock useFilters hook
vi.mock('../src/hooks/useFilters', () => ({
  useFilters: () => ({
    filters: { years: [2024, 2023, 2022], areas: ['01 검사실운영', '07 종합검증'], subCategories: [] },
    loading: false
  })
}));

// Test component to access context
function TestConsumer() {
  const ctx = useFilterContext();
  return (
    <div>
      <span data-testid="viewMode">{ctx.viewMode}</span>
      <span data-testid="selectedYear">{ctx.selectedYear}</span>
      <span data-testid="selectedArea">{ctx.selectedArea}</span>
      <button onClick={() => ctx.setViewMode('history')}>Change View</button>
      <button onClick={() => ctx.setSelectedYear('2023')}>Set Year</button>
      <button onClick={ctx.resetFilters}>Reset</button>
    </div>
  );
}

describe('FilterContext', () => {
  it('provides default values', () => {
    render(
      <FilterProvider>
        <TestConsumer />
      </FilterProvider>
    );

    expect(screen.getByTestId('viewMode')).toHaveTextContent('dashboard');
  });

  it('initializes year and area from filters', async () => {
    render(
      <FilterProvider>
        <TestConsumer />
      </FilterProvider>
    );

    // Wait for useEffect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId('selectedYear')).toHaveTextContent('2024');
    expect(screen.getByTestId('selectedArea')).toHaveTextContent('01 검사실운영');
  });

  it('allows updating viewMode', async () => {
    render(
      <FilterProvider>
        <TestConsumer />
      </FilterProvider>
    );

    const button = screen.getByText('Change View');
    await act(async () => {
      button.click();
    });

    expect(screen.getByTestId('viewMode')).toHaveTextContent('history');
  });

  it('resets filters to empty state', async () => {
    render(
      <FilterProvider>
        <TestConsumer />
      </FilterProvider>
    );

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Set a year first
    const setYearBtn = screen.getByText('Set Year');
    await act(async () => {
      setYearBtn.click();
    });
    expect(screen.getByTestId('selectedYear')).toHaveTextContent('2023');

    // Reset
    const resetBtn = screen.getByText('Reset');
    await act(async () => {
      resetBtn.click();
    });

    expect(screen.getByTestId('selectedYear')).toHaveTextContent('');
    expect(screen.getByTestId('selectedArea')).toHaveTextContent('');
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useFilterContext must be used within a FilterProvider');

    spy.mockRestore();
  });
});
