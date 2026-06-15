import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import axios from 'axios';
import ItemModal from '../src/components/ItemModal.jsx';
import { AuthProvider } from '../src/contexts/AuthContext.jsx';

vi.mock('axios', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.includes('/common/')) {
        return Promise.resolve({
          data: {
            common_key: '010.001',
            items: [
              { _id: 'abc1', area_code: '01', area_name: '검사실운영', item_number: '01.010.001', year: 2026, question: 'Q', description: 'D', score: 10, classification: 'R' },
              { _id: 'z90', area_code: '90', area_name: '분자유전', item_number: '90.010.001', year: 2026, question: 'Q', description: 'D', score: 10, classification: 'R' },
            ],
          },
        });
      }
      if (url.includes('/edit-type-codes')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

const makeItem = (overrides = {}) => ({
  _id: 'abc1',
  area: '01',
  sub_category: '01 심사범위',
  common_key: '010.001',
  na_available: false,
  about_item: { item_number: '01.010.001', question: '조직도가 있는가?', description: '설명', score: 10, item_type: 'R' },
  metadata: { year: 2026, source: '검사실운영' },
  revision: { status: 'none', locked: false, revised: false },
  ...overrides,
});

const renderModal = (item) =>
  render(
    <AuthProvider>
      <ItemModal selectedItem={item} setSelectedItem={vi.fn()} setItems={vi.fn()} setHistoryItems={vi.fn()} />
    </AuthProvider>
  );

describe('ItemModal — 공통문항 일괄 진입점 (SC-1)', () => {
  it('shows the bulk-common button when common_key exists', () => {
    renderModal(makeItem());
    expect(screen.getByRole('button', { name: '공통문항 일괄' })).toBeInTheDocument();
  });

  it('hides the button for a non-common item (no common_key)', () => {
    renderModal(makeItem({ common_key: null }));
    expect(screen.queryByRole('button', { name: '공통문항 일괄' })).not.toBeInTheDocument();
  });

  it('opens CommonItemPanel showing all areas on click', async () => {
    renderModal(makeItem());
    fireEvent.click(screen.getByRole('button', { name: '공통문항 일괄' }));
    expect(await screen.findByText(/공통문항 일괄 — 010.001/)).toBeInTheDocument();
    expect(await screen.findByText(/분자유전/)).toBeInTheDocument();
  });
});
