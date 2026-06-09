import React, { useState, useEffect } from 'react';
import { Download, FileText, FileJson, Check, Loader2, Archive } from 'lucide-react';
import { useEnterprise } from '../../store/enterprise';
import { queryAll } from '../../db';
import type { Article } from '../../types';
import { platformLabel } from '../../utils/labels';

export default function ArticleExport() {
  const { currentEnterprise } = useEnterprise();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<'markdown'|'json'|'txt'>('markdown');
  const [exp, setExp] = useState(false);
  const [hist, setHist] = useState<{time:string;count:number;format:string}[]>([]);

  useEffect(() => {
    if (!currentEnterprise) return;
    setArticles(queryAll<Article>('SELECT * FROM articles WHERE enterprise_id=? AND status!=?',[currentEnterprise.id,'deleted']));
  }, [currentEnterprise]);

  const tog = (id:string) => setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const togAll = () => selected.size===articles.length?setSelected(new Set()):setSelected(new Set(articles.map(a=>a.id)));
  const run = async () => {
    const te = articles.filter(a=>selected.has(a.id)); if(!te.length)return;
    setExp(true);
    let blob:Blob; let ext:string;
    if(format==='json'){blob=new Blob([JSON.stringify(te.map(a=>({title:a.title,platform:a.platform,word_count:a.word_count,body:a.body_markdown})),null,2)],{type:'application/json'});ext='json';}
    else if(format==='txt'){blob=new Blob([te.map(a=>`# ${a.title}\n\n${a.body_markdown.replace(/^#/gm,'##')}\n\n---\n`).join('\n')],{type:'text/plain'});ext='txt';}
    else {blob=new Blob([te.map(a=>a.body_markdown).join('\n\n---\n\n')],{type:'text/markdown'});ext='md';}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`articles_${te.length}.${ext}`;a.click();URL.revokeObjectURL(a.href);
    setHist(p=>[{time:new Date().toLocaleString('zh-CN'),count:te.length,format},...p].slice(0,10));
    setExp(false);
  };

  if (!currentEnterprise) return <div className="flex flex-col items-center justify-center py-24 text-center"><div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4"><Download size={28} className="text-gray-300"/></div><p className="text-base font-medium text-gray-400 mb-1">尚未选择企业</p><p className="text-sm text-gray-300">请先在上方选择企业</p></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="card p-4 sm:p-6">
        <h1 className="text-lg font-semibold tracking-tight text-gray-900 mb-1">文章导出</h1>
        <p className="text-sm text-gray-400 mb-5">选择文章，支持 Markdown、JSON、纯文本三种格式导出。</p>
        <div className="flex gap-2 mb-5">
          {[{k:'markdown' as const,l:'Markdown',i:FileText,d:'保留格式，可导入飞书/Notion'},{k:'json' as const,l:'JSON',i:FileJson,d:'结构化数据'},{k:'txt' as const,l:'纯文本',i:FileText,d:'无格式纯文本'}].map(o=><button key={o.k} onClick={()=>setFormat(o.k)} className={`flex-1 p-3.5 rounded-xl border text-left transition-all ${format===o.k?'border-indigo-300 bg-indigo-50':'border-gray-200 hover:border-gray-300'}`}><o.i size={18} className={format===o.k?'text-indigo-600':'text-gray-400'}/><div className="text-sm font-medium mt-1.5 text-gray-900">{o.l}</div><div className="text-xs text-gray-400 mt-0.5">{o.d}</div></button>)}
        </div>
        <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-400">已选 {selected.size}/{articles.length} 篇</span><button onClick={togAll} className="text-xs text-indigo-600 hover:underline">{selected.size===articles.length?'取消全选':'全选'}</button></div>
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-64 overflow-y-auto mb-5">
          {articles.length===0?<div className="px-4 py-12 text-center text-sm text-gray-400">暂无文章可导出</div>:articles.map(a=><label key={a.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"><input type="checkbox" checked={selected.has(a.id)} onChange={()=>tog(a.id)} className="w-3.5 h-3.5 rounded accent-indigo-600"/><span className="flex-1 text-sm text-gray-700 truncate">{a.title}</span><span className="text-xs text-gray-400 shrink-0">{platformLabel(a.platform)}·{a.word_count}字</span></label>)}
        </div>
        <button onClick={run} disabled={!selected.size||exp} className="btn-base btn-primary w-full justify-center py-2.5">{exp?<><Loader2 size={14} className="animate-spin"/>导出中...</>:<><Download size={14}/>导出 {selected.size} 篇为 {format.toUpperCase()}</>}</button>
      </div>
      {hist.length>0&&<div className="card p-4 sm:p-5"><div className="flex items-center gap-2 mb-3"><Archive size={14} className="text-gray-400"/><h3 className="text-sm font-semibold text-gray-900">导出历史</h3></div>{hist.map((h,i)=><div key={i} className="flex items-center justify-between text-xs py-1"><span className="flex items-center gap-1.5 text-gray-400"><Check size={12} className="text-emerald-500"/>{h.time}</span><span className="text-gray-400">{h.count}篇·{h.format.toUpperCase()}</span></div>)}</div>}
    </div>
  );
}
