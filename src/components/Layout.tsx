import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { PenLine, FileText, Download, KeyRound, Menu, X, Sparkles, Image, Info } from 'lucide-react';
import EnterpriseSwitcher from './EnterpriseSwitcher';
import { useEnterprise } from '../store/enterprise';
import ApiKeyModal from './ApiKeyModal';
import { getActiveProvider, getApiKey } from '../services/ai';

const navItems = [
  { to: '/', icon: PenLine, label: '创作中心', exact: true },
  { to: '/articles', icon: FileText, label: '文章管理' },
  { to: '/optimize', icon: Sparkles, label: '优化' },
  { to: '/assets', icon: Image, label: '图片' },
  { to: '/export', icon: Download, label: '导出' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { dbReady } = useEnterprise();
  const location = useLocation();
  const [showApiKey, setShowApiKey] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [providerLabel, setProviderLabel] = useState('API');

  const refreshProvider = useCallback(() => {
    const p = getActiveProvider();
    setProviderLabel(getApiKey(p.id) ? p.name : 'API');
  }, []);

  useEffect(() => { refreshProvider(); }, [refreshProvider, showApiKey]);
  useEffect(() => { setMobileMenu(false); }, [location.pathname]);

  if (!dbReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between">
          {/* Left */}
          <div className="flex items-center gap-2 sm:gap-3">
            <NavLink to="/" className="flex items-center gap-2 text-indigo-600 font-semibold text-base shrink-0 no-underline">
              <PenLine size={20} strokeWidth={2} />
              <span className="hidden sm:inline">王尘宇GEO编辑器</span>
            </NavLink>
            <div className="w-px h-5 bg-gray-200 hidden sm:block" />
            <EnterpriseSwitcher />
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors no-underline ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon size={16} strokeWidth={1.8} />
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={() => { setShowApiKey(true); refreshProvider(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ml-2 ${
                providerLabel !== 'API'
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <KeyRound size={16} strokeWidth={1.8} />
              {providerLabel}
            </button>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenu(!mobileMenu)}
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {mobileMenu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileMenu && (
          <nav className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1 animate-in slide-in-from-top-2 duration-200">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={() => setMobileMenu(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors no-underline ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`
                }
              >
                <item.icon size={18} strokeWidth={1.8} />
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={() => { setShowApiKey(true); setMobileMenu(false); refreshProvider(); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                providerLabel !== 'API'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <KeyRound size={18} strokeWidth={1.8} />
              {providerLabel !== 'API' ? `${providerLabel} 已连接` : 'API 接口配置'}
            </button>
          </nav>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-5 py-4 sm:py-6">
        {children}
      </main>
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 py-3 flex items-center justify-center">
          <div className="relative group">
            <span className="text-[11px] text-gray-400 flex items-center gap-1 cursor-default select-none">
              <span>© 2026 西安蓝蜻蜓网络科技有限公司</span>
              <Info size={11} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </span>
            {/* Hover card */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
              <p className="text-[11px] font-medium text-gray-700 mb-1.5">王尘宇</p>
              <div className="space-y-1 text-[10px] text-gray-500">
                <p>西安蓝蜻蜓网络科技有限公司</p>
                <div className="border-t border-gray-100 my-1.5" />
                <a href="https://wangchenyu.com" target="_blank" rel="noopener noreferrer" className="block text-indigo-500 hover:text-indigo-700 pointer-events-auto">wangchenyu.com</a>
                <a href="https://qro.cn" target="_blank" rel="noopener noreferrer" className="block text-indigo-500 hover:text-indigo-700 pointer-events-auto">qro.cn</a>
                <a href="https://mqs.net" target="_blank" rel="noopener noreferrer" className="block text-indigo-500 hover:text-indigo-700 pointer-events-auto">mqs.net</a>
                <div className="border-t border-gray-100 my-1.5" />
                <p className="flex items-center gap-1"><span className="text-gray-400">邮箱</span> 314111741@qq.com</p>
                <p className="flex items-center gap-1"><span className="text-gray-400">微信</span> wangshifucn</p>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <ApiKeyModal open={showApiKey} onClose={() => setShowApiKey(false)} />
    </div>
  );
}
