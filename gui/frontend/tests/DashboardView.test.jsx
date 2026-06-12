import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardView from '../src/components/DashboardView.jsx';
import { FilterProvider } from '../src/contexts/FilterContext.jsx';
import { AuthProvider } from '../src/contexts/AuthContext.jsx';

// Stub API calls made inside useFilters / FilterContext
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { years: [], areas: [], subCategories: [] }
    }),
  },
}));

const sampleItems = [
  {
    _id: 'abc1',
    area: '01',
    sub_category: '심사범위',
    common_key: '010.001',
    about_item: {
      item_number: '01.010.001',
      question: '검사실 조직도가 있는가?',
      description: '조직도 설명',
      score: 10,
      item_type: 'R',
    },
    metadata: { year: 2026, source: '검사실운영' },
    revision: { status: 'none', locked: false, revised: false },
  },
];

function renderDashboard(props = {}) {
  return render(
    <AuthProvider>
      <FilterProvider>
        <DashboardView
          items={sampleItems}
          loading={false}
          setSelectedItem={vi.fn()}
          {...props}
        />
      </FilterProvider>
    </AuthProvider>
  );
}

describe('DashboardView — search input (regression for setSearchTerm bug)', () => {
  it('renders search input without throwing', () => {
    expect(() => renderDashboard()).not.toThrow();
    expect(screen.getByPlaceholderText(/검색/)).toBeTruthy();
  });

  it('typing in search input does not throw setSearchTerm error', () => {
    renderDashboard();
    const input = screen.getByPlaceholderText(/검색/);
    expect(() => {
      fireEvent.change(input, { target: { value: '조직도' } });
    }).not.toThrow();
  });

  it('search input updates value without error', () => {
    renderDashboard();
    const input = screen.getByPlaceholderText(/검색/);
    fireEvent.change(input, { target: { value: '테스트 검색어' } });
    // If this doesn't throw, the setSearchTerm bug is fixed
    expect(input).toBeTruthy();
  });
});

describe('DashboardView — card content', () => {
  it('renders item number in card', () => {
    renderDashboard();
    expect(screen.getByText('01.010.001')).toBeTruthy();
  });

  it('renders item question in card', () => {
    renderDashboard();
    expect(screen.getByText(/조직도가 있는가/)).toBeTruthy();
  });

  it('renders item description in card', () => {
    renderDashboard();
    expect(screen.getByText(/조직도 설명/)).toBeTruthy();
  });

  it('renders year in card footer', () => {
    renderDashboard();
    expect(screen.getByText(/2026/)).toBeTruthy();
  });
});

describe('DashboardView — REVISED badge', () => {
  it('shows REVISED badge for revised items', () => {
    const revisedItems = [{
      ...sampleItems[0],
      revision: { status: 'final', locked: true, revised: true },
    }];
    renderDashboard({ items: revisedItems });
    expect(screen.getByText(/REVISED/i)).toBeTruthy();
  });

  it('does not show REVISED badge for non-revised items', () => {
    renderDashboard();
    expect(screen.queryByText(/REVISED/i)).toBeNull();
  });
});

describe('DashboardView — loading state', () => {
  it('shows loading indicator when loading=true', () => {
    renderDashboard({ loading: true, items: [] });
    expect(screen.getByText(/검색 중/)).toBeTruthy();
  });
});
