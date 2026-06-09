import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Image, Trash2, Copy, CopyCheck, X, Filter, Tag, Maximize2, ImagePlus, AlertTriangle } from 'lucide-react';
import { useEnterprise } from '../../store/enterprise';
import { queryAll, execute, persistDatabase, generateId } from '../../db';

interface Asset {
  id: string;
  enterprise_id: string;
  name: string;
  data_url: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  category: string;
  created_at: string;
}

const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'logo', label: 'Logo' },
  { key: 'product', label: '产品图' },
  { key: 'brand', label: '品牌素材' },
  { key: 'general', label: '通用' },
];

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_WIDTH = 1400;
const JPEG_QUALITY = 0.82;

function compressImage(file: File): Promise<{ dataUrl: string; width: number; height: number; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > MAX_WIDTH) { h = Math.round(h * MAX_WIDTH / w); w = MAX_WIDTH; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, mimeType === 'image/png' ? undefined : JPEG_QUALITY);
        resolve({ dataUrl, width: w, height: h, mimeType });
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

export default function AssetManager() {
  const { currentEnterprise } = useEnterprise();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    if (!currentEnterprise) return;
    setAssets(queryAll<Asset>(
      'SELECT * FROM enterprise_assets WHERE enterprise_id=? ORDER BY created_at DESC',
      [currentEnterprise.id]
    ));
  }, [currentEnterprise]);

  useEffect(() => { refresh(); }, [refresh]);

  const doUpload = async (files: FileList | File[]) => {
    if (!currentEnterprise) return;
    setUploading(true); setError('');
    const fileArr = Array.from(files);
    for (const file of fileArr) {
      if (file.size > MAX_SIZE) { setError(`「${file.name}」超过 5MB 限制`); continue; }
      if (!file.type.startsWith('image/')) { setError(`「${file.name}」不是图片文件`); continue; }
      try {
        const compressed = await compressImage(file);
        const id = generateId('ast');
        execute(
          'INSERT INTO enterprise_assets (id,enterprise_id,name,data_url,mime_type,size_bytes,width,height,category,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [id, currentEnterprise.id, file.name, compressed.dataUrl, compressed.mimeType, file.size, compressed.width, compressed.height, 'general', new Date().toISOString()]
        );
      } catch (e: any) {
        setError(`「${file.name}」处理失败: ${e.message}`);
      }
    }
    await persistDatabase();
    refresh();
    setUploading(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) doUpload(e.dataTransfer.files);
  }, [currentEnterprise]);

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`删除「${asset.name}」？此操作不可撤销。`)) return;
    execute('DELETE FROM enterprise_assets WHERE id=?', [asset.id]);
    await persistDatabase();
    refresh();
    if (previewAsset?.id === asset.id) setPreviewAsset(null);
  };

  const handleCopy = async (asset: Asset, asMarkdown: boolean) => {
    const text = asMarkdown ? `![${asset.name}](${asset.data_url})` : asset.data_url;
    await navigator.clipboard.writeText(text);
    setCopiedId(asset.id + (asMarkdown ? '-md' : ''));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCategory = async (asset: Asset, cat: string) => {
    execute('UPDATE enterprise_assets SET category=? WHERE id=?', [cat, asset.id]);
    await persistDatabase();
    refresh();
  };

  const filtered = assets.filter(a => filter === 'all' || a.category === filter);
  const fmtSize = (b: number) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  if (!currentEnterprise) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4"><Image size={28} className="text-gray-300" /></div>
        <p className="text-base font-medium text-gray-400 mb-1">尚未选择企业</p><p className="text-sm text-gray-300">请先在上方选择企业</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">图片资产管理</h1>
            <p className="text-sm text-gray-400 mt-0.5">上传 Logo、产品图、品牌素材，用于文章配图和品牌展示</p>
          </div>
          <span className="text-xs text-gray-400">{assets.length} 张</span>
        </div>

        {/* Upload zone */}
        <div
          ref={dropRef}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
          }`}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => e.target.files && doUpload(e.target.files)}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-500">处理中...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ImagePlus size={28} className="text-gray-300" />
              <p className="text-sm text-gray-500">拖拽图片到这里，或<span className="text-indigo-600 font-medium">点击上传</span></p>
              <p className="text-xs text-gray-400">支持 JPG/PNG/WebP，单文件 ≤ 5MB，自动压缩至 1400px</p>
            </div>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12} />{error}</p>}
      </div>

      {/* Filter bar */}
      {assets.length > 0 && (
        <div className="card p-2 flex items-center gap-1">
          <Filter size={13} className="text-gray-400 ml-2 mr-1" />
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setFilter(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                filter === cat.key ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Image size={36} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">{assets.length === 0 ? '还没有上传图片' : '当前分类下没有图片'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(asset => (
            <div key={asset.id} className="card overflow-hidden group">
              {/* Thumbnail */}
              <div
                className="aspect-square bg-gray-100 flex items-center justify-center cursor-pointer relative overflow-hidden"
                onClick={() => setPreviewAsset(asset)}
              >
                <img
                  src={asset.data_url}
                  alt={asset.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Maximize2 size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              {/* Info */}
              <div className="p-2">
                <p className="text-[11px] font-medium text-gray-700 truncate" title={asset.name}>{asset.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-gray-400">{asset.width}×{asset.height}</span>
                  <span className="text-[10px] text-gray-300">·</span>
                  <span className="text-[10px] text-gray-400">{fmtSize(asset.size_bytes)}</span>
                </div>
                {/* Category selector */}
                <select
                  value={asset.category}
                  onChange={e => handleCategory(asset, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="mt-1.5 w-full text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-white text-gray-500 outline-none cursor-pointer"
                >
                  {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                {/* Actions */}
                <div className="flex items-center gap-1 mt-1.5">
                  <button
                    onClick={e => { e.stopPropagation(); handleCopy(asset, true); }}
                    className="flex-1 text-[10px] text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 py-1 rounded transition-colors flex items-center justify-center gap-1"
                    title="复制 Markdown"
                  >
                    {copiedId === asset.id + '-md' ? <CopyCheck size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    MD
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleCopy(asset, false); }}
                    className="flex-1 text-[10px] text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 py-1 rounded transition-colors flex items-center justify-center gap-1"
                    title="复制图片地址"
                  >
                    {copiedId === asset.id ? <CopyCheck size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    URL
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(asset); }}
                    className="text-[10px] text-gray-400 hover:text-red-500 hover:bg-red-50 py-1 px-1.5 rounded transition-colors"
                    title="删除"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewAsset(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewAsset(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors z-10"
            >
              <X size={16} />
            </button>
            <img src={previewAsset.data_url} alt={previewAsset.name} className="max-w-full max-h-[80vh] object-contain" />
            <div className="p-3 border-t border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{previewAsset.name}</p>
                <p className="text-xs text-gray-400">{previewAsset.width}×{previewAsset.height} · {fmtSize(previewAsset.size_bytes)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleCopy(previewAsset, true)} className="btn-base btn-secondary text-xs">
                  {copiedId === previewAsset.id + '-md' ? <CopyCheck size={12} /> : <Copy size={12} />}
                  复制 Markdown
                </button>
                <button onClick={() => handleDelete(previewAsset)} className="btn-base btn-danger text-xs">
                  <Trash2 size={12} />删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
