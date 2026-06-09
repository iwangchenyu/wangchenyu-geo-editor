import React, { useState } from 'react';
import { Building2, Plus, ChevronDown, Trash2, Check } from 'lucide-react';
import { useEnterprise } from '../store/enterprise';

export default function EnterpriseSwitcher() {
  const { enterprises, currentEnterprise, switchEnterprise, createEnterprise, deleteEnterprise } = useEnterprise();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createEnterprise(newName.trim());
    setNewName(''); setCreating(false); setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 border border-transparent hover:border-gray-300 transition-all text-[13px] font-medium text-gray-700"
      >
        <Building2 size={15} strokeWidth={1.8} className="text-indigo-500" />
        <span className="max-w-[120px] sm:max-w-[160px] truncate">
          {currentEnterprise ? currentEnterprise.name : '选择企业'}
        </span>
        <ChevronDown size={12} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1.5 left-0 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 overflow-hidden">
            <div className="p-1.5">
              <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold px-2.5 py-1.5">当前企业</div>
              {enterprises.map(ent => (
                <div
                  key={ent.id}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                    currentEnterprise?.id === ent.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => { switchEnterprise(ent.id); setOpen(false); }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={14} strokeWidth={1.5} className={currentEnterprise?.id === ent.id ? 'text-indigo-500' : 'text-gray-400'} />
                    <span className={`truncate text-[13px] ${currentEnterprise?.id === ent.id ? 'text-indigo-600 font-medium' : 'text-gray-700'}`}>{ent.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {currentEnterprise?.id === ent.id && <Check size={14} className="text-indigo-500 shrink-0" />}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteEnterprise(ent.id); }}
                      className="p-1 hover:bg-red-50 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 p-1.5">
              {creating ? (
                <div className="p-1.5">
                  <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                    placeholder="企业名称" className="input text-[13px]" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleCreate} disabled={!newName.trim()} className="btn-base btn-primary flex-1 py-1.5 text-xs">创建</button>
                    <button onClick={() => setCreating(false)} className="btn-base btn-secondary flex-1 py-1.5 text-xs">取消</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setCreating(true)} className="w-full flex items-center gap-2 px-2.5 py-2 text-[13px] text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                  <Plus size={15} />创建新企业
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
