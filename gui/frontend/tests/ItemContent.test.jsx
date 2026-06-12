import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ItemContent from '../src/components/ItemContent.jsx';

const makeItem = (overrides = {}) => ({
  _id: 'abc123',
  area: '01',
  sub_category: '심사범위',
  about_item: {
    item_number: '01.010.020',
    question: '검사실 조직도가 있는가?',
    description: '조직도에는 책임자와 담당자가 명시되어야 함',
    score: 10,
    item_type: 'R',
  },
  metadata: { year: 2024, source: '검사실운영' },
  revision: { status: 'none', locked: false, revised: false },
  ...overrides,
});

describe('ItemContent — question and description rendering', () => {
  it('renders the item number', () => {
    render(<ItemContent item={makeItem()} />);
    expect(screen.getByText(/01\.010\.020/)).toBeTruthy();
  });

  it('renders the question text', () => {
    render(<ItemContent item={makeItem()} />);
    expect(screen.getByText(/조직도가 있는가/)).toBeTruthy();
  });

  it('renders the description text', () => {
    render(<ItemContent item={makeItem()} />);
    expect(screen.getByText(/책임자와 담당자/)).toBeTruthy();
  });
});

describe('ItemContent — score display', () => {
  it('shows numeric score in points', () => {
    render(<ItemContent item={makeItem()} />);
    expect(screen.getByText(/10점/)).toBeTruthy();
  });

  it('shows 핵심 label when score is null and classification is C', () => {
    const item = makeItem({
      about_item: {
        item_number: '01.010.020',
        question: '조직도가 있는가?',
        description: '',
        score: null,
        item_type: 'C',
      },
    });
    const { container } = render(<ItemContent item={item} />);
    expect(container.querySelector('.score-core')).toBeTruthy();
    expect(container.querySelector('.score-core').textContent).toMatch(/핵심/);
  });

  it('shows 핵심 when score is null even without explicit C classification', () => {
    const item = makeItem({
      about_item: {
        item_number: '01.010.020',
        question: '조직도가 있는가?',
        description: '',
        score: null,
        item_type: '',
      },
    });
    const { container } = render(<ItemContent item={item} />);
    expect(container.querySelector('.score-core')).toBeTruthy();
  });
});

describe('ItemContent — classification badge', () => {
  it('renders 필요 badge for R classification', () => {
    const { container } = render(<ItemContent item={makeItem()} />);
    expect(container.querySelector('.badge-required')).toBeTruthy();
    expect(container.querySelector('.badge-required').textContent).toBe('필요');
  });

  it('renders 기본 badge for B classification', () => {
    const item = makeItem({
      about_item: {
        item_number: '01.010.020',
        question: '조직도가 있는가?',
        description: '',
        score: 5,
        item_type: 'B',
      },
    });
    const { container } = render(<ItemContent item={item} />);
    expect(container.querySelector('.badge-basic')).toBeTruthy();
    expect(container.querySelector('.badge-basic').textContent).toBe('기본');
  });
});

describe('ItemContent — REVISED badge', () => {
  it('shows REVISED badge when revision.revised is true', () => {
    const item = makeItem({
      revision: { status: 'final', locked: true, revised: true },
    });
    render(<ItemContent item={item} />);
    expect(screen.getByText(/REVISED/i)).toBeTruthy();
  });

  it('does not show REVISED badge when not revised', () => {
    render(<ItemContent item={makeItem()} />);
    expect(screen.queryByText(/REVISED/i)).toBeNull();
  });
});
