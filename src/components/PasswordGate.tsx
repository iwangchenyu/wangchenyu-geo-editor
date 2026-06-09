import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, AlertTriangle } from 'lucide-react';

// 密码的 SHA-256 哈希值（默认密码: geo2026）
// 修改密码：终端运行 echo -n "你的新密码" | shasum -a 256
const PASSWORD_HASH = 'dc0c49888b0726d8eed7958b144946d1fb9b5aac3ed47b37719b33ae95e51b43';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pass, setPass] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('gate_unlocked') === PASSWORD_HASH) {
      setUnlocked(true);
    }
    setChecking(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pass.trim()) return;
    setLoading(true); setError(false);
    const h = await sha256(pass);
    if (h === PASSWORD_HASH) {
      sessionStorage.setItem('gate_unlocked', PASSWORD_HASH);
      setUnlocked(true);
    } else {
      setError(true); setPass('');
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
              <Lock size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">王尘宇GEO编辑器</h1>
            <p className="text-sm text-gray-500 mt-1">演示站 · 请输入访问密码</p>
          </div>

          <form onSubmit={handleSubmit} className="card p-5 space-y-4">
            <input
              type="password"
              value={pass}
              onChange={e => { setPass(e.target.value); setError(false); }}
              placeholder="输入密码"
              autoFocus
              className="input text-center text-lg tracking-widest"
              disabled={loading}
            />
            {error && (
              <p className="text-xs text-red-500 flex items-center justify-center gap-1">
                <AlertTriangle size={12} />密码错误，请重试
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !pass.trim()}
              className="btn-base btn-primary w-full justify-center py-2.5"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>进入演示 <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            西安蓝蜻蜓网络科技有限公司
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
