import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RevisionListView from '../src/components/RevisionListView.jsx';
import { FilterProvider } from '../src/contexts/FilterContext.jsx';

vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { years: [], areas: [], subCategories: [] },
    }),
  },
}));

const sampleItems = [
  {
    _id: 'id1', area: '01', sub_category: '심사범위', common_key: '010.001',
    about_item: { item_number: '01.010.001', question: '선택된 문항 A', score: 10, item_type: 'R' },
    metadata: { year: 2026, source: '검사실운영' },
    revision: { status: 'none', locked: false, revised: false },
  },
  {
    _id: 'id2', area: '01', sub_category: '심사범위', common_key: '010.002',
    about_item: { item_number: '01.010.002', question: '선택된 문항 B', score: 5, item_type: 'B' },
    metadata: { year: 2026, source: '검사실운영' },
    revision: { status: 'draft', locked: false, revised: false },
  },
];

function renderView(props = {}) {
  return render(
    <FilterProvider>
      <RevisionListView selectedItems={sampleItems} onNavigateToRevision={vi.fn()} {...props} />
    </FilterProvider>
  );
}

describe('RevisionListView — 화면 A', () => {
  it('renders without crashing', () => {
    expect(() => renderView()).not.toThrow();
  });

  it('shows item numbers for all selected items', () => {
    renderView();
    expect(screen.getByText('01.010.001')).toBeTruthy();
    expect(screen.getByText('01.010.002')).toBeTruthy();
  });

  it('shows item question', () => {
    renderView();
    expect(screen.getByText(/선택된 문항 A/)).toBeTruthy();
  });

  it('shows revision status badge', () => {
    renderView();
    // Status shown as Korean label (수정중, 미시작, etc.)
    const badge = screen.queryByText(/수정중/) ?? screen.queryByText(/미시작/) ?? screen.queryByText(/draft/i);
    expect(badge).toBeTruthy();
  });

  it('shows empty state when no items selected', () => {
    renderView({ selectedItems: [] });
    expect(screen.getByText(/선택된 문항이 없습니다/i)).toBeTruthy();
  });

  it('calls onNavigateToRevision when 비교·개정 button clicked', () => {
    const onNav = vi.fn();
    renderView({ onNavigateToRevision: onNav });
    const buttons = screen.getAllByRole('button');
    const navBtn = buttons.find(b => b.textContent.includes('비교·개정') || b.textContent.includes('개정'));
    if (navBtn) fireEvent.click(navBtn);
    expect(onNav).toHaveBeenCalled();
  });
});
