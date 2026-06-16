import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import CommonItemPanel from '../src/components/CommonItemPanel.jsx';
import { AuthProvider } from '../src/contexts/AuthContext.jsx';

vi.mock('axios', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.includes('/common/')) {
        return Promise.resolve({
          data: {
            common_key: '010.020',
            items: [
              { _id: 'a', area_code: '01', area_name: '검사실운영', item_number: '01.010.020', year: 2026, question: 'Q', description: 'D', score: null, classification: 'C' },
              { _id: 'b', area_code: '90', area_name: '분자유전', item_number: '90.010.020', year: 2026, question: 'Q', description: 'D', score: null, classification: 'C' },
            ],
          },
        });
      }
      if (url.includes('/edit-type-codes')) return Promise.resolve({ data: [{ code: 'MODIFY', label: '문항 수정' }] });
      return Promise.resolve({ data: {} });
    }),
    patch: vi.fn().mockResolvedValue({ data: { common_key: '010.020' } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

const renderPanel = (props = {}) =>
  render(
    <AuthProvider>
      <CommonItemPanel commonKey="010.020" onClose={vi.fn()} onSaved={vi.fn()} {...props} />
    </AuthProvider>
  );

beforeEach(() => { axios.patch.mockClear(); });

describe('CommonItemPanel', () => {
  it('renders all areas sharing the common_key (SC-2)', async () => {
    renderPanel();
    expect(await screen.findByText(/검사실운영/)).toBeInTheDocument();
    expect(screen.getByText(/분자유전/)).toBeInTheDocument();
  });

  it('blocks save until an area is selected + reason + a changed field (SC-4)', async () => {
    renderPanel();
    await screen.findByText(/검사실운영/);
    const saveBtn = screen.getByRole('button', { name: /일괄 저장/ });
    expect(saveBtn).toBeDisabled(); // 미선택·무사유·무변경
  });

  it('PATCH /common/:key with changed field + selected areas + reason (SC-3)', async () => {
    const onSaved = vi.fn();
    renderPanel({ onSaved });
    await screen.findByText(/검사실운영/);

    const textboxes = screen.getAllByRole('textbox'); // [질문, 설명, 배점, 수정사유]
    fireEvent.change(textboxes[1], { target: { value: 'NEW DESC' } }); // 설명 변경
    fireEvent.change(textboxes[3], { target: { value: '일괄 사유' } });  // 수정사유

    const checks = screen.getAllByRole('checkbox'); // [분야01, 분야90, MODIFY]
    fireEvent.click(checks[0]); // 분야 01 선택

    const saveBtn = screen.getByRole('button', { name: /일괄 저장/ });
    expect(saveBtn).toBeEnabled();
    fireEvent.click(saveBtn);

    await waitFor(() => expect(axios.patch).toHaveBeenCalled());
    const [url, body] = axios.patch.mock.calls[0];
    expect(url).toContain('/common/010.020');
    expect(body).toMatchObject({ description: 'NEW DESC', area_codes: ['01'], reason: '일괄 사유' });
    expect(body).not.toHaveProperty('question'); // 미변경 필드 미전송
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
