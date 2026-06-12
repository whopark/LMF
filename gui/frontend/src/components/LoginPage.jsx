import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

function LoginPage() {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(name, password);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) setError('사용자를 찾을 수 없습니다.');
      else if (status === 401) setError('비밀번호가 올바르지 않습니다.');
      else setError('로그인에 실패했습니다. 다시 시도하세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f172a',
    }}>
      <div style={{
        background: '#1e293b', borderRadius: '1rem', padding: '2.5rem',
        width: '100%', maxWidth: '380px', border: '1px solid #334155',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <HelpCircle size={36} color="#38bdf8" />
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
              LMF Accreditation
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              임상검사실 인증심사 문항관리
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              사용자 이름
            </label>
            <input
              type="text"
              className="select-input"
              style={{ width: '100%' }}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="이름 입력"
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              비밀번호
            </label>
            <input
              type="password"
              className="select-input"
              style={{ width: '100%' }}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              required
            />
          </div>

          {error && (
            <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-save"
            style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#475569', textAlign: 'center' }}>
          계정이 없으면 관리자에게 문의하세요.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
