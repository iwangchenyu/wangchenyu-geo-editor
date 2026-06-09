import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowUpDown, Trash2, Eye, Download, FileText, Globe, X, Sparkles, Pencil, RotateCcw, FolderOpen, Plus, Folder, Tag, Archive, MoreHorizontal, Check, GitCompare, Layers, Shield, Hash, Clock, Bookmark, Copy, CopyCheck, Code2 } from 'lucide-react';
import { useEnterprise } from '../../store/enterprise';
import { queryAll, execute, persistDatabase, generateId } from '../../db';
import { chatWithJSON, hasApiKey } from '../../services/ai';
import type { Article, Collection } from '../../types';
import { markdownToHtml, copyRichText } from '../../utils/markdown';

type Tab = 'all' | 'collections' | 'trash';

const PLATFORMS: Record<string, string> = { zhihu: '知乎', wechat: '公众号', xiaohongshu: '小红书', website: '官网', ai_search: 'AI搜索' };
const STATUS: Record<string, string> = { draft: '草稿', published: '已发布', archived: '已归档' };
const FORM_LABELS: Record<string, string> = { knowledge_science: '知识科普', comparison_review: '对比测评', case_analysis: '案例分析', scene_immersion: '场景代入', product_tech: '产品技术', hot_topic: '热点话题', cost_breakdown: '成本拆解', industry_wiki: '行业百科', user_qa: '用户问答', risk_experience: '体验风险' };
const wc = (n: number) => n>=10000?`${(n/10000).toFixed(1)}万`:n>=1000?`${(n/1000).toFixed(1)}k`:String(n);

// 下拉菜单 Hook
function useDropdown() {
  const [openId, setOpenId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpenId(null); };
    if (openId) { document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }
  }, [openId]);
  return { openId, setOpenId, ref };
}

export default function ArticleManager() {
  const { currentEnterprise } = useEnterprise();
  const [tab, setTab] = useState<Tab>('all');
  const [articles, setArticles] = useState<Article[]>([]);
  const [trashArticles, setTrashArticles] = useState<Article[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedColl, setSelectedColl] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('all');
  const [platformF, setPlatformF] = useState('all');
  const [sort, setSort] = useState<'date'|'words'|'title'>('date');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Article | null>(null);
  const [editing, setEditing] = useState<Article | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTags, setEditTags] = useState('');
  const [tagLoading, setTagLoading] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<Article | null>(null);
  const [compareB, setCompareB] = useState<Article | null>(null);
  const [collMenuOpen, setCollMenuOpen] = useState(false);
  const [richPreview, setRichPreview] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [showNewColl, setShowNewColl] = useState(false);
  const [page, setPage] = useState(0);
  const dropdown = useDropdown();
  const collRef = useRef<HTMLDivElement>(null);
  const PS = 20;

  const refresh = () => {
    if (!currentEnterprise) return;
    const parseArticle = (a: any): Article => {
      try { if (typeof a.tags === 'string') a.tags = JSON.parse(a.tags); } catch {}
      try { if (typeof a.citation_signals === 'string') a.citation_signals = JSON.parse(a.citation_signals); } catch {}
      try { if (typeof a.compliance === 'string') a.compliance = JSON.parse(a.compliance); } catch {}
      try { if (typeof a.citations_embedded === 'string') a.citations_embedded = JSON.parse(a.citations_embedded); } catch {}
      return a;
    };
    const rawArticles = queryAll<any>('SELECT * FROM articles WHERE enterprise_id=? AND status NOT IN (?,?) ORDER BY generated_at DESC', [currentEnterprise.id, 'deleted', 'archived']);
    setArticles(rawArticles.map(parseArticle));
    const rawTrash = queryAll<any>('SELECT * FROM articles WHERE enterprise_id=? AND status=? ORDER BY deleted_at DESC', [currentEnterprise.id, 'deleted']);
    setTrashArticles(rawTrash.map(parseArticle));
    setCollections(queryAll<Collection>('SELECT * FROM collections WHERE enterprise_id=? ORDER BY created_at DESC', [currentEnterprise.id]));
  };
  useEffect(refresh, [currentEnterprise]);

  // Close coll menu on outside click
  useEffect(() => { const h = (e: MouseEvent) => { if (collRef.current && !collRef.current.contains(e.target as Node)) setCollMenuOpen(false); };
    if (collMenuOpen) { document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); } }, [collMenuOpen]);

  // --- AI Tags ---
  const suggestTags = async (article: Article) => {
    if (!hasApiKey() || !currentEnterprise) return;
    setTagLoading(article.id);
    try {
      const r = await chatWithJSON<{tags: string[]}>([{role:'system',content:'根据文章提取3-5个精准标签。返回{"tags":["标签"]}'},{role:'user',content:`标题：${article.title}\n正文前500字：${article.body_markdown.slice(0,500)}`}]);
      const tags = [...new Set([...article.tags, ...r.tags])];
      execute('UPDATE articles SET tags=?, modified_at=? WHERE id=?', [JSON.stringify(tags), new Date().toISOString(), article.id]);
      await persistDatabase();
      setArticles(prev => prev.map(a => a.id===article.id ? {...a, tags, modified_at:new Date().toISOString()} : a));
    } catch {} finally { setTagLoading(null); }
  };

  // --- Edit ---
  const startEdit = (a: Article) => { setEditing(a); setEditTitle(a.title); setEditBody(a.body_markdown); setEditTags(a.tags.join(', ')); };
  const saveEdit = async () => {
    if (!editing || !currentEnterprise) return;
    const newTags = editTags.split(',').map(t=>t.trim()).filter(Boolean);
    const v = editing.version + 1;
    execute('UPDATE articles SET title=?, body_markdown=?, word_count=?, tags=?, version=?, modified_at=? WHERE id=?',
      [editTitle, editBody, editBody.length, JSON.stringify(newTags), v, new Date().toISOString(), editing.id]);
    await persistDatabase();
    setArticles(prev => prev.map(a => a.id===editing.id ? {...a, title:editTitle, body_markdown:editBody, word_count:editBody.length, tags:newTags, version:v, modified_at:new Date().toISOString()} : a));
    setEditing(null);
  };

  // --- Trash ---
  const restoreArticle = async (id: string) => { execute('UPDATE articles SET status=?, deleted_at=NULL, modified_at=? WHERE id=?', ['draft', new Date().toISOString(), id]); await persistDatabase(); refresh(); };
  const permDelete = async (id: string) => { execute('DELETE FROM articles WHERE id=?', [id]); await persistDatabase(); refresh(); };
  const emptyTrash = async () => { for (const a of trashArticles) execute('DELETE FROM articles WHERE id=?', [a.id]); await persistDatabase(); refresh(); };

  // --- Collections ---
  const createColl = async () => { if(!collectionName.trim()||!currentEnterprise)return; const id=generateId('col'); execute('INSERT INTO collections (id,enterprise_id,name,description,created_at) VALUES (?,?,?,?,?)',[id,currentEnterprise.id,collectionName.trim(),'',new Date().toISOString()]); await persistDatabase(); setCollections(prev=>[{id,enterprise_id:currentEnterprise.id,name:collectionName.trim(),description:'',created_at:new Date().toISOString()},...prev]); setCollectionName(''); setShowNewColl(false); };
  const deleteColl = async (id: string) => { execute('DELETE FROM collection_articles WHERE collection_id=?',[id]); execute('DELETE FROM collections WHERE id=?',[id]); await persistDatabase(); setCollections(prev=>prev.filter(c=>c.id!==id)); if(selectedColl===id) setSelectedColl(null); };
  const addToColl = async (articleIds: string[], collId: string) => { for(const aid of articleIds) { try { execute('INSERT OR IGNORE INTO collection_articles (collection_id, article_id) VALUES (?,?)',[collId,aid]); } catch {} } await persistDatabase(); };
  const removeFromColl = async (aid: string, cid: string) => { execute('DELETE FROM collection_articles WHERE collection_id=? AND article_id=?',[cid,aid]); await persistDatabase(); };

  const collArticles = selectedColl ? queryAll<{article_id:string}>('SELECT article_id FROM collection_articles WHERE collection_id=?',[selectedColl]).map(r=>r.article_id) : [];

  // --- Bulk operations ---
  const del = async (id: string) => { execute('UPDATE articles SET status=?, deleted_at=? WHERE id=?',['deleted',new Date().toISOString(),id]); await persistDatabase(); refresh(); };
  const batchDel = async () => { for(const id of selected) await del(id); setSelected(new Set()); };
  const tog = (id: string) => setSelected(prev=>{const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n;});
  const exp = (a: Article) => { const b=new Blob([a.body_markdown],{type:'text/markdown'}); const el=document.createElement('a'); el.href=URL.createObjectURL(b); el.download=`${a.title.replace(/[\\/:*?"<>|]/g,'_').slice(0,40)}.md`; el.click(); URL.revokeObjectURL(el.href); };

  const selectedArticles = articles.filter(a => selected.has(a.id));

  if (!currentEnterprise) {
    return <div className="flex flex-col items-center justify-center py-32 text-center"><div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4"><FileText size={28} className="text-gray-300"/></div><p className="text-base font-medium text-gray-400 mb-1">尚未选择企业</p><p className="text-sm text-gray-300">请先在上方创建或选择一个企业</p></div>;
  }

  const tabBtn = (t: Tab, label: string, icon?: React.ReactNode, badge?: number) => (
    <button onClick={()=>setTab(t)} className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${tab===t?'bg-indigo-600 text-white shadow-sm':'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
      {icon}{label}{badge ? <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-0.5 ${tab===t?'bg-white/20 text-white':'badge-red'}`}>{badge}</span> : null}
    </button>
  );

  const filtered = articles.filter(a=>{if(statusF!=='all'&&a.status!==statusF)return false;if(platformF!=='all'&&a.platform!==platformF)return false;if(search){const q=search.toLowerCase();return a.title.toLowerCase().includes(q)||a.body_markdown.toLowerCase().includes(q);}return false;});
  const sorted = (search||statusF!=='all'||platformF!=='all'?filtered:articles).sort((a,b)=>{if(sort==='date')return new Date(b.generated_at).getTime()-new Date(a.generated_at).getTime();if(sort==='words')return b.word_count-a.word_count;return a.title.localeCompare(b.title,'zh');});
  const paged = sorted.slice(page*PS,(page+1)*PS);

  return (
    <div className="space-y-4">
      {/* Tabs + Toolbar */}
      <div className="card">
        <div className="flex items-center gap-1 p-1.5 border-b border-gray-100 overflow-x-auto">
          {tabBtn('all', '全部文章')}
          {tabBtn('collections', '收藏夹', <FolderOpen size={14}/>)}
          {trashArticles.length>0 && tabBtn('trash', '回收站', <Archive size={14}/>, trashArticles.length)}
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-gray-900">{tab==='all'?'文章管理':tab==='collections'?'收藏夹':'回收站'}</h1>
              <span className="text-sm text-gray-400">{tab==='all'?articles.length:tab==='trash'?trashArticles.length:collections.length} 项</span>
            </div>

            {/* Selection actions */}
            <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
              {tab==='all' && selected.size === 2 && (
                <button onClick={() => { const [a,b] = selectedArticles; setCompareA(a); setCompareB(b); }} className="btn-base btn-ghost text-xs">
                  <GitCompare size={13}/>对比两篇
                </button>
              )}
              {tab==='all' && selected.size > 0 && (
                <div className="relative" ref={collRef}>
                  <button onClick={() => setCollMenuOpen(!collMenuOpen)} className="btn-base btn-ghost text-xs"><Bookmark size={13}/>加入收藏夹</button>
                  {collMenuOpen && (
                    <div className="absolute top-full mt-1 right-0 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-40 overflow-hidden">
                      {collections.map(c => <button key={c.id} onClick={()=>{addToColl([...selected],c.id);setCollMenuOpen(false);setSelected(new Set());}} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">{c.name}</button>)}
                      {collections.length===0 && <div className="px-3 py-2 text-xs text-gray-400">暂无收藏夹</div>}
                    </div>
                  )}
                </div>
              )}
              {tab==='all' && selected.size > 0 && <button onClick={batchDel} className="btn-base btn-danger text-xs"><Trash2 size={13}/>删除 {selected.size} 篇</button>}
              {tab==='all' && <button onClick={()=>setSort(s=>s==='date'?'words':s==='words'?'title':'date')} className="btn-base btn-ghost text-xs"><ArrowUpDown size={13}/>{sort==='date'?'时间':sort==='words'?'字数':'标题'}</button>}
              {tab==='trash'&&trashArticles.length>0&&<button onClick={emptyTrash} className="btn-base btn-danger text-xs"><Trash2 size={13}/>清空回收站</button>}
              {tab==='collections'&&<button onClick={()=>setShowNewColl(true)} className="btn-base btn-primary text-xs"><Plus size={13}/>新建收藏夹</button>}
            </div>
          </div>

          {tab!=='collections'&&<div className="flex flex-col sm:flex-row gap-2 mt-3"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索标题或正文..." className="input pl-9 text-sm"/></div><div className="flex gap-2"><select value={statusF} onChange={e=>setStatusF(e.target.value)} className="select text-sm w-[110px]"><option value="all">全部状态</option><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已归档</option></select><select value={platformF} onChange={e=>setPlatformF(e.target.value)} className="select text-sm w-[110px]"><option value="all">全部平台</option><option value="zhihu">知乎</option><option value="wechat">公众号</option><option value="xiaohongshu">小红书</option><option value="website">官网</option><option value="ai_search">AI搜索</option></select></div></div>}
        </div>
      </div>

      {/* === ALL ARTICLES === */}
      {tab==='all'&&(
        <div className="card overflow-hidden">
          {articles.length===0?<div className="py-20 text-center"><div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3"><FileText size={24} className="text-gray-300"/></div><p className="text-sm font-medium text-gray-400">暂无文章</p><p className="text-xs text-gray-300">前往创作中心，AI 帮你批量生成</p></div>:(
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="w-10 pl-4 pr-2 py-3"><input type="checkbox" onChange={()=>selected.size===paged.length&&paged.length>0?setSelected(new Set()):setSelected(new Set(paged.map(a=>a.id)))} checked={selected.size===paged.length&&paged.length>0} className="w-3.5 h-3.5 rounded accent-indigo-600"/></th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">标题</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-[72px] hidden sm:table-cell">平台</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-[80px] hidden sm:table-cell">标签</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-[56px] hidden md:table-cell">字数</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-[88px] hidden lg:table-cell">时间</th>
                  <th className="w-[42px] pr-4 pl-2 py-3"/>
                </tr></thead>
                <tbody>
                  {paged.map((a,i)=>(
                    <tr key={a.id} className={`border-b border-gray-50 transition-colors ${selected.has(a.id)?'bg-indigo-50/50':i%2===0?'bg-white':'bg-gray-50/30'} hover:bg-gray-50`}>
                      <td className="pl-4 pr-2 py-3"><input type="checkbox" checked={selected.has(a.id)} onChange={()=>tog(a.id)} className="w-3.5 h-3.5 rounded accent-indigo-600"/></td>
                      <td className="px-3 py-3">
                        <button onClick={()=>setPreview(a)} className="text-[13px] font-medium text-left text-gray-900 hover:text-indigo-600 transition-colors line-clamp-1 max-w-[240px] sm:max-w-[320px] block">{a.title}</button>
                        <div className="flex items-center gap-1.5 mt-0.5 sm:hidden"><Globe size={11} className="text-gray-300"/><span className="text-[11px] text-gray-400">{PLATFORMS[a.platform]||a.platform}</span></div>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell"><div className="flex items-center gap-1"><Globe size={12} className="text-gray-300"/><span className="text-xs text-gray-500">{PLATFORMS[a.platform]||a.platform}</span></div></td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-0.5 max-w-[120px]">{a.tags.slice(0,3).map(t=><span key={t} className="badge-purple text-[10px]">{t}</span>)}{a.tags.length>3&&<span className="text-[10px] text-gray-400">+{a.tags.length-3}</span>}</div>
                      </td>
                      <td className="px-3 py-3 text-right hidden md:table-cell"><span className="text-xs text-gray-400 tabular-nums">{wc(a.word_count)}</span></td>
                      <td className="px-3 py-3 text-right hidden lg:table-cell"><span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">{new Date(a.generated_at).toLocaleDateString('zh-CN',{month:'short',day:'numeric'})}</span></td>
                      <td className="pr-4 pl-2 py-3 relative">
                        <button onClick={()=>dropdown.setOpenId(dropdown.openId===a.id?null:a.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><MoreHorizontal size={15}/></button>
                        {dropdown.openId===a.id&&(
                          <div ref={dropdown.ref} className="absolute right-4 top-10 w-40 bg-white rounded-xl shadow-lg border border-gray-200 z-30 overflow-hidden">
                            <button onClick={()=>{setPreview(a);dropdown.setOpenId(null);}} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"><Eye size={13}/>预览</button>
                            <button onClick={()=>{startEdit(a);dropdown.setOpenId(null);}} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"><Pencil size={13}/>编辑</button>
                            <button onClick={()=>{suggestTags(a);dropdown.setOpenId(null);}} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"><Sparkles size={13}/>AI标签</button>
                            <button onClick={()=>{exp(a);dropdown.setOpenId(null);}} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"><Download size={13}/>下载</button>
                            {collections.length>0&&<div className="border-t border-gray-100"><div className="px-3 py-1.5 text-[10px] text-gray-400 uppercase">加入收藏夹</div>{collections.map(c=><button key={c.id} onClick={()=>{addToColl([a.id],c.id);dropdown.setOpenId(null);}} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"><Bookmark size={13}/>{c.name}</button>)}</div>}
                            <div className="border-t border-gray-100"><button onClick={()=>{del(a.id);dropdown.setOpenId(null);}} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 text-red-500 transition-colors"><Trash2 size={13}/>删除</button></div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === COLLECTIONS === */}
      {tab==='collections'&&(
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 space-y-1.5">
            {showNewColl&&<div className="card p-3 mb-2"><input autoFocus value={collectionName} onChange={e=>setCollectionName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')createColl();if(e.key==='Escape')setShowNewColl(false);}} placeholder="收藏夹名称" className="input text-sm"/><div className="flex gap-2 mt-2"><button onClick={createColl} disabled={!collectionName.trim()} className="btn-base btn-primary flex-1 py-1.5 text-xs">创建</button><button onClick={()=>setShowNewColl(false)} className="btn-base btn-secondary flex-1 py-1.5 text-xs">取消</button></div></div>}
            {collections.map(c=><button key={c.id} onClick={()=>setSelectedColl(c.id)} className={`w-full text-left p-3 rounded-xl border transition-all ${selectedColl===c.id?'border-indigo-300 bg-indigo-50/30':'border-gray-200 bg-white hover:border-gray-300'}`}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Folder size={14} className="text-amber-500"/><span className="text-sm font-medium text-gray-900">{c.name}</span></div><button onClick={e=>{e.stopPropagation();deleteColl(c.id);}} className="text-gray-400 hover:text-red-500"><X size={13}/></button></div></button>)}
            {collections.length===0&&!showNewColl&&<div className="text-center py-12 text-sm text-gray-400">暂无收藏夹</div>}
          </div>
          <div className="md:col-span-2">
            {selectedColl?<div className="card p-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">{collections.find(c=>c.id===selectedColl)?.name}</h3>
              {articles.filter(a=>collArticles.includes(a.id)).length===0?<div className="text-center py-8 text-sm text-gray-400">此收藏夹暂无文章</div>:articles.filter(a=>collArticles.includes(a.id)).map(a=><div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><div className="flex-1 min-w-0"><p className="text-sm text-gray-900 truncate">{a.title}</p><div className="flex gap-2 mt-0.5"><span className="text-[11px] text-gray-400">{PLATFORMS[a.platform]||a.platform}</span><span className="text-[11px] text-gray-400">{wc(a.word_count)}</span></div></div><button onClick={()=>removeFromColl(a.id,selectedColl!)} className="p-1 text-gray-400 hover:text-red-500"><X size={13}/></button></div>)}
            </div>:<div className="card flex items-center justify-center h-40 text-sm text-gray-400">选择收藏夹查看内容</div>}
          </div>
        </div>
      )}

      {/* === TRASH === */}
      {tab==='trash'&&(
        <div className="card overflow-hidden">
          {trashArticles.length===0?<div className="py-20 text-center"><div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3"><Archive size={24} className="text-gray-300"/></div><p className="text-sm font-medium text-gray-400">回收站为空</p></div>:(
            <div className="overflow-x-auto"><table className="w-full min-w-[500px]"><thead><tr className="border-b border-gray-100 bg-gray-50/50"><th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">标题</th><th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-[100px] hidden sm:table-cell">删除时间</th><th className="w-[140px] pr-5 pl-2 py-3"/></tr></thead><tbody>{trashArticles.map(a=><tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50"><td className="px-5 py-3"><span className="text-sm text-gray-500 line-clamp-1">{a.title}</span></td><td className="px-3 py-3 hidden sm:table-cell"><span className="text-xs text-gray-400">{a.deleted_at?new Date(a.deleted_at).toLocaleDateString('zh-CN',{month:'short',day:'numeric'}):''}</span></td><td className="pr-5 pl-2 py-3"><div className="flex items-center justify-end gap-1"><button onClick={()=>restoreArticle(a.id)} className="btn-base btn-success text-xs py-1 px-2"><RotateCcw size={12}/>恢复</button><button onClick={()=>permDelete(a.id)} className="btn-base btn-danger text-xs py-1 px-2"><Trash2 size={12}/>删除</button></div></td></tr>)}</tbody></table></div>
          )}
        </div>
      )}

      {/* === ENHANCED PREVIEW MODAL === */}
      {preview&&(<><div className="fixed inset-0 z-50 bg-black/40" onClick={()=>setPreview(null)}/>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="min-w-0 pr-4"><h3 className="font-semibold text-sm text-gray-900 truncate">{preview.title}</h3>
                <div className="flex items-center gap-3 mt-1 flex-wrap"><span className="text-xs text-gray-400 flex items-center gap-1"><Globe size={11}/>{PLATFORMS[preview.platform]||preview.platform}</span><span className="text-xs text-gray-400">{wc(preview.word_count)}</span><span className="text-xs text-gray-400">v{preview.version}</span><span className="text-xs text-gray-400">{new Date(preview.generated_at).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setRichPreview(!richPreview)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400" title={richPreview ? "切换到Markdown" : "切换到富文本预览"}>{richPreview ? <Code2 size={16} /> : <Eye size={16} />}</button>
                {richPreview && <button onClick={() => { copyRichText(markdownToHtml(preview.body_markdown)); }} className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-emerald-600 transition-colors" title="复制富文本"><Copy size={16} /></button>}
                <button onClick={()=>exp(preview)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><Download size={16}/></button><button onClick={()=>setPreview(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16}/></button></div>
            </div>

            {/* Stats panel */}
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5"><Shield size={13} className="text-gray-400"/><span className="text-xs text-gray-500">引用信号：</span>
                  {Object.entries(preview.citation_signals).map(([k,v])=>v>0?<span key={k} className="badge-purple text-[10px]">{k}:{v as number}</span>:null)}
                </div>
                <div className="flex items-center gap-1.5"><Check size={13} className={preview.compliance.passed?'text-emerald-500':'text-red-400'}/><span className="text-xs text-gray-500">合规：{preview.compliance.passed?'通过':'待审查'}</span></div>
              </div>
              {/* Editable tags */}
              <div className="flex items-center gap-2 mt-2">
                <Tag size={13} className="text-gray-400 shrink-0"/>
                <div className="flex flex-wrap gap-1 flex-1">
                  {preview.tags.map((t,i)=><span key={i} className="badge-purple text-[10px]">{t}</span>)}
                </div>
                <button onClick={()=>{startEdit(preview);setPreview(null); setRichPreview(false);}} className="text-xs text-indigo-600 hover:underline shrink-0">编辑</button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {richPreview ? (
                <div
                  className="richtext-content max-w-none text-sm leading-relaxed text-gray-800"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(preview.body_markdown) }}
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                />
              ) : (
                <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap font-mono">{preview.body_markdown}</div>
              )}
            </div>
          </div>
        </div>
      </>)}

      {/* === COMPARE MODAL === */}
      {compareA&&compareB&&(<><div className="fixed inset-0 z-50 bg-black/40" onClick={()=>{setCompareA(null);setCompareB(null);}}/>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0"><h3 className="font-semibold text-sm text-gray-900">文章对比</h3><button onClick={()=>{setCompareA(null);setCompareB(null);}} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={17}/></button></div>
            <div className="p-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><div className="text-xs text-gray-400 mb-1">文章 A</div><div className="text-sm font-semibold text-gray-900">{compareA.title}</div></div>
                <div><div className="text-xs text-gray-400 mb-1">文章 B</div><div className="text-sm font-semibold text-gray-900">{compareB.title}</div></div>
              </div>
              <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden mb-4">
                <thead><tr className="bg-gray-50"><th className="text-left px-4 py-2 text-xs text-gray-400 w-[120px]">指标</th><th className="text-left px-4 py-2 text-xs text-gray-400">A</th><th className="text-left px-4 py-2 text-xs text-gray-400">B</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {[{l:'平台',aL:PLATFORMS[compareA.platform],bL:PLATFORMS[compareB.platform]},{l:'内容形态',aL:FORM_LABELS[compareA.content_form]||compareA.content_form,bL:FORM_LABELS[compareB.content_form]||compareB.content_form},{l:'字数',aL:wc(compareA.word_count),bL:wc(compareB.word_count)},{l:'版本',aL:`v${compareA.version}`,bL:`v${compareB.version}`},{l:'合规',aL:compareA.compliance.passed?'✓通过':'✗待审',bL:compareB.compliance.passed?'✓通过':'✗待审'},{l:'数据引用',aL:String(compareA.citation_signals.data_point),bL:String(compareB.citation_signals.data_point)},{l:'权威引用',aL:String(compareA.citation_signals.authority_citation),bL:String(compareB.citation_signals.authority_citation)},{l:'案例引用',aL:String(compareA.citation_signals.case_study),bL:String(compareB.citation_signals.case_study)},{l:'步骤化',aL:String(compareA.citation_signals.step_by_step),bL:String(compareB.citation_signals.step_by_step)},{l:'对比信号',aL:String(compareA.citation_signals.comparison),bL:String(compareB.citation_signals.comparison)},{l:'风险提示',aL:String(compareA.citation_signals.risk_warning),bL:String(compareB.citation_signals.risk_warning)}].map((r,i)=><tr key={i} className="hover:bg-gray-50"><td className="px-4 py-2 text-gray-500 font-medium">{r.l}</td><td className="px-4 py-2">{r.aL}</td><td className="px-4 py-2">{r.bL}</td></tr>)}
                </tbody>
              </table>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-xs text-gray-400 mb-2">A 正文</div><div className="text-xs text-gray-600 whitespace-pre-wrap max-h-[40vh] overflow-y-auto bg-gray-50 rounded-xl p-3">{compareA.body_markdown.slice(0,1500)}{compareA.body_markdown.length>1500?'...':''}</div></div>
                <div><div className="text-xs text-gray-400 mb-2">B 正文</div><div className="text-xs text-gray-600 whitespace-pre-wrap max-h-[40vh] overflow-y-auto bg-gray-50 rounded-xl p-3">{compareB.body_markdown.slice(0,1500)}{compareB.body_markdown.length>1500?'...':''}</div></div>
              </div>
            </div>
          </div>
        </div>
      </>)}

      {/* === EDIT MODAL === */}
      {editing&&(<><div className="fixed inset-0 z-50 bg-black/40" onClick={()=>setEditing(null)}/>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0"><div><h3 className="font-semibold text-sm text-gray-900">编辑文章</h3><span className="text-xs text-gray-400">版本 {editing.version} → {editing.version+1}</span></div><button onClick={()=>setEditing(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={17}/></button></div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div><label className="text-[11px] font-semibold text-gray-400 uppercase mb-1 block">标题</label><input value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="input font-medium"/></div>
              <div><label className="text-[11px] font-semibold text-gray-400 uppercase mb-1 block">标签（逗号分隔）</label><input value={editTags} onChange={e=>setEditTags(e.target.value)} className="input text-sm"/></div>
              <div><div className="flex items-center justify-between mb-1"><label className="text-[11px] font-semibold text-gray-400 uppercase">正文 (Markdown)</label><button onClick={() => setRichPreview(!richPreview)} className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">{richPreview ? <Code2 size={12}/> : <Eye size={12}/>}{richPreview ? "编辑源码" : "富文本预览"}</button></div>{richPreview ? (
                <div
                  className="richtext-content max-w-none text-sm leading-relaxed text-gray-800 bg-gray-50 rounded-xl p-4 border border-gray-200 min-h-[300px]"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(editBody) }}
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                />
              ) : (
                <textarea value={editBody} onChange={e=>setEditBody(e.target.value)} rows={18} className="input font-mono text-sm resize-none"/>
              )}</div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 shrink-0"><button onClick={saveEdit} className="btn-base btn-primary flex-1 justify-center">保存修改</button><button onClick={()=>setEditing(null)} className="btn-base btn-secondary flex-1 justify-center">取消</button></div>
          </div>
        </div>
      </>)}
    </div>
  );
}

