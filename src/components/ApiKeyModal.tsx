import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, KeyRound, Check, Zap, Lock, AlertTriangle, ArrowRight, Edit3, RotateCcw } from 'lucide-react';
import { getProviders, getApiKey, setApiKey, getActiveProviderId, setActiveProviderId } from '../services/ai';
import type { AIProvider } from '../services/providers';

const PASSWORD_HASH = 'dc0c49888b0726d8eed7958b144946d1fb9b5aac3ed47b37719b33ae95e51b43';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCurrentHash(): string {
  return localStorage.getItem('api_password_hash') || PASSWORD_HASH;
}

export default function ApiKeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [apiUnlocked, setApiUnlocked] = useState(false);
  const [gatePass, setGatePass] = useState('');
  const [gateError, setGateError] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdMsgOk, setPwdMsgOk] = useState(false);
  const [providers] = useState<AIProvider[]>(() => getProviders());
  const [activeId, setActiveId] = useState<string>(() => getActiveProviderId());
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApiUnlocked(sessionStorage.getItem('api_unlocked') === getCurrentHash());
    const k: Record<string, string> = {};
    providers.forEach(p => { k[p.id] = getApiKey(p.id); });
    setKeys(k);
    setActiveId(getActiveProviderId());
    setSaved(false);
  }, [open, providers]);

  const handleSave = () => {
    Object.entries(keys).forEach(([id, key]) => setApiKey(id, key));
    setActiveProviderId(activeId);
    setSaved(true);
    setTimeout(() => onClose(), 400);
  };

  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatePass.trim()) return;
    setGateLoading(true); setGateError(false);
    const h = await sha256(gatePass);
    const curHash = getCurrentHash();
    if (h === curHash) {
      sessionStorage.setItem('api_unlocked', curHash);
      setApiUnlocked(true);
    } else {
      setGateError(true); setGatePass('');
    }
    setGateLoading(false);
  };

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(''); setPwdMsgOk(false);
    if (newPwd.length < 4) { setPwdMsg('新密码至少4位'); return; }
    if (newPwd !== confirmPwd) { setPwdMsg('两次密码不一致'); return; }
    const oldHash = await sha256(oldPwd);
    const curHash = getCurrentHash();
    if (oldHash !== curHash) { setPwdMsg('旧密码错误'); return; }
    const newHash = await sha256(newPwd);
    localStorage.setItem('api_password_hash', newHash);
    sessionStorage.setItem('api_unlocked', newHash);
    setPwdMsg('密码修改成功！新密码已生效');
    setPwdMsgOk(true);
    setOldPwd(''); setNewPwd(''); setConfirmPwd('');
  };

  const handleResetPwd = () => {
    localStorage.removeItem('api_password_hash');
    sessionStorage.removeItem('api_unlocked');
    setApiUnlocked(false);
    setShowChangePwd(false);
    setPwdMsg(''); setPwdMsgOk(false);
  };

  if (!open) return null;
  const ap = providers.find(p => p.id === activeId);

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-[61] flex items-end sm:items-center justify-center pointer-events-none">
        <div className="pointer-events-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">

          {/* Password Gate */}
          {!apiUnlocked && (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Lock size={16} className="text-amber-600" />
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">身份验证</h2>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"><X size={18} /></button>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-500 mb-4">API 接口配置需要密码验证，请输入演示站密码。</p>
                <form onSubmit={handleGateSubmit} className="space-y-3">
                  <input
                    type="password"
                    value={gatePass}
                    onChange={e => { setGatePass(e.target.value); setGateError(false); }}
                    placeholder="输入密码"
                    autoFocus
                    className="input text-center text-lg tracking-widest"
                    disabled={gateLoading}
                  />
                  {gateError && (
                    <p className="text-xs text-red-500 flex items-center justify-center gap-1">
                      <AlertTriangle size={12} />密码错误
                    </p>
                  )}
                  <button type="submit" disabled={gateLoading || !gatePass.trim()} className="btn-base btn-primary w-full justify-center py-2.5">
                    {gateLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>验证 <ArrowRight size={15} /></>}
                  </button>
                </form>
              </div>
            </>
          )}

          {/* API Config (only when unlocked) */}
          {apiUnlocked && (<>
          {/* Header */}
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                <KeyRound size={16} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">API 接口配置</h2>
                {!showChangePwd && (
                  <button onClick={() => setShowChangePwd(true)} className="text-[11px] text-gray-400 hover:text-indigo-600 flex items-center gap-1 mt-0.5">
                    <Edit3 size={10} />修改密码
                  </button>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"><X size={18} /></button>
          </div>

          {/* Change Password Form */}
          {showChangePwd && (
            <div className="p-4 border-b border-gray-100 bg-amber-50/50">
              <form onSubmit={handleChangePwd} className="space-y-2.5">
                <p className="text-xs text-gray-600 font-medium">修改访问密码</p>
                <input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} placeholder="旧密码" className="input text-sm" />
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="新密码（至少4位）" className="input text-sm" />
                <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="确认新密码" className="input text-sm" />
                {pwdMsg && (
                  <p className={`text-xs flex items-center gap-1 ${pwdMsgOk ? 'text-emerald-600' : 'text-red-500'}`}>
                    {pwdMsgOk ? <Check size={11} /> : <AlertTriangle size={11} />}{pwdMsg}
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="btn-base btn-primary text-xs flex-1 justify-center">确认修改</button>
                  <button type="button" onClick={() => { setShowChangePwd(false); setPwdMsg(''); }} className="btn-base btn-secondary text-xs flex-1 justify-center">取消</button>
                  {localStorage.getItem('api_password_hash') && (
                    <button type="button" onClick={handleResetPwd} className="btn-base btn-ghost text-xs" title="恢复默认密码"><RotateCcw size={12} /></button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Tabs */}
          <div className="px-3 py-2.5 border-b border-gray-100 overflow-x-auto shrink-0">
            <div className="flex gap-1">
              {providers.map(p => (
                <button key={p.id} onClick={() => setActiveId(p.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                    activeId === p.id ? 'bg-indigo-600 text-white shadow-sm' :
                    keys[p.id] ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'text-gray-400 hover:bg-gray-100'
                  }`}>
                  {keys[p.id] && activeId !== p.id && <Check size={10} />}{p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
            {ap && (
              <>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">接口地址</label>
                  <div className="mt-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 font-mono break-all select-all">{ap.endpoint}/chat/completions</div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">API Key</label>
                  <div className="relative mt-1.5">
                    <input type={showKey === activeId ? 'text' : 'password'} value={keys[activeId] || ''}
                      onChange={e => setKeys(prev => ({ ...prev, [activeId]: e.target.value }))}
                      placeholder={`输入 ${ap.name} 的 API Key...`} className="input pr-10 font-mono text-xs sm:text-sm" />
                    <button onClick={() => setShowKey(prev => prev === activeId ? null : activeId)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showKey === activeId ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">默认模型</label>
                  <select className="select w-full mt-1.5" defaultValue={ap.defaultModel}>
                    {ap.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <Zap size={14} className="text-amber-500 shrink-0" />
                  <div className="text-xs text-amber-700">当前使用 <strong>{ap.name}</strong> · <strong>{ap.defaultModel}</strong></div>
                </div>
              </>
            )}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">已配置接口</label>
              <div className="mt-1.5 space-y-0.5">
                {providers.map(p => (
                  <div key={p.id} onClick={() => setActiveId(p.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                      activeId === p.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${keys[p.id] ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                      <span className={activeId === p.id ? 'font-medium text-indigo-600' : 'text-gray-600'}>{p.name}</span>
                    </div>
                    <span className="text-gray-400">{keys[p.id] ? '已配置' : '未配置'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-100 flex gap-3 shrink-0">
            <button onClick={handleSave} className="btn-base btn-primary flex-1 justify-center">{saved ? '已保存 ✓' : '保存配置'}</button>
            <button onClick={onClose} className="btn-base btn-secondary flex-1 justify-center">取消</button>
          </div>
          </>)}
        </div>
      </div>
    </>
  );
}
