import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  Check, X, Trash2, Download, Upload, FileUp, 
  Copy, ChevronDown, ChevronUp, BarChart3, Database 
} from 'lucide-react';

const EXCLUDE_REASONS = [
  "Wrong patient population",
  "Wrong intervention",
  "Wrong outcomes",
  "Wrong study design",
  "Wrong publication type",
  "Foreign language",
  "Other"
];

export default function App() {
  const [articles, setArticles] = useState(() => {
    const savedData = localStorage.getItem('prisma_screening_data');
    return savedData ? JSON.parse(savedData) : [];
  });
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 管理摘要手風琴展開狀態的 Set
  const [expandedAbstracts, setExpandedAbstracts] = useState(new Set());

  useEffect(() => {
    localStorage.setItem('prisma_screening_data', JSON.stringify(articles));
  }, [articles]);

  const handleFileUpload = async (e, source) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data.map(row => normalizeArticle(row, source));
        mergeArticles(parsedData, source);
        setIsProcessing(false);
        e.target.value = null; 
      }
    });
  };

  const handleResumeCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const resumedData = results.data.map(row => ({
          id: crypto.randomUUID(),
          Author: row['Author'] || '',
          Year: row['Year'] || '',
          DOI: row['DOI'] || '',
          Title: row['Title'] || '',
          Journal: row['Journal'] || '',
          Abstract: row['Abstract'] || '',
          PubMed: parseInt(row['PubMed']) || 0,
          Embase: parseInt(row['Embase']) || 0,
          Cochrane: parseInt(row['Cochrane']) || 0,
          Include: parseInt(row['Include']) || 0,
          Exclude: parseInt(row['Exclude']) || 0,
          Duplicate: parseInt(row['Duplicate']) || 0, // 新增 Duplicate 讀取
          ExcludeReason: row['Exclude reason'] || ''
        }));
        
        setArticles(resumedData);
        setIsProcessing(false);
        e.target.value = null;
      }
    });
  };

  const normalizeArticle = (row, source) => {
    return {
      Title: row['Title'] || row['Original Title'] || '',
      Author: row['Authors'] || row['Author Names'] || row['Author(s)'] || '',
      Year: row['Publication Year'] || row['Year'] || '',
      Journal: row['Journal/Book'] || row['Journal'] || row['Source'] || '',
      DOI: row['DOI'] || '',
      Abstract: row['Abstract'] || '',
      PubMed: source === 'PubMed' ? 1 : 0,
      Embase: source === 'Embase' ? 1 : 0,
      Cochrane: source === 'Cochrane' ? 1 : 0,
      Include: 0,
      Exclude: 0,
      Duplicate: 0, // 新增 Duplicate 狀態
      ExcludeReason: ''
    };
  };

  const mergeArticles = (newArticles, source) => {
    setArticles(prev => {
      const merged = [...prev];
      newArticles.forEach(newArt => {
        const duplicateIndex = merged.findIndex(existing => 
          (newArt.DOI && existing.DOI === newArt.DOI) || 
          (newArt.Title && newArt.Title.toLowerCase().trim() === existing.Title.toLowerCase().trim())
        );

        if (duplicateIndex >= 0) {
          merged[duplicateIndex][source] = 1;
          if (!merged[duplicateIndex].Abstract && newArt.Abstract) {
             merged[duplicateIndex].Abstract = newArt.Abstract;
          }
        } else {
          newArt.id = crypto.randomUUID();
          merged.push(newArt);
        }
      });
      return merged;
    });
  };

  // 處理三個主要決策：Include, Exclude, Duplicate
  const handleDecision = (id, decision) => {
    setArticles(prev => prev.map(art => {
      if (art.id === id) {
        return {
          ...art,
          Include: decision === 'include' ? 1 : 0,
          Exclude: decision === 'exclude' ? 1 : 0,
          Duplicate: decision === 'duplicate' ? 1 : 0,
          ExcludeReason: decision === 'exclude' ? art.ExcludeReason : '' 
        };
      }
      return art;
    }));
  };

  const handleReasonChange = (id, reason) => {
    setArticles(prev => prev.map(art => 
      art.id === id ? { ...art, ExcludeReason: reason } : art
    ));
  };

  const toggleAbstract = (id) => {
    setExpandedAbstracts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    const exportData = articles.map(art => ({
      Author: art.Author,
      Year: art.Year,
      DOI: art.DOI,
      Title: art.Title,
      Journal: art.Journal,
      Abstract: art.Abstract,
      PubMed: art.PubMed,
      Embase: art.Embase,
      Cochrane: art.Cochrane,
      Include: art.Include,
      Exclude: art.Exclude,
      Duplicate: art.Duplicate, // 匯出加入 Duplicate
      'Exclude reason': art.ExcludeReason
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'prisma_screening_results.csv';
    link.click();
  };

  const clearData = () => {
    if(window.confirm('確定要清除所有文獻與篩選進度嗎？此動作無法復原。')) {
      setArticles([]);
      setExpandedAbstracts(new Set());
      localStorage.removeItem('prisma_screening_data');
    }
  };

  // 統計數據
  const total = articles.length;
  const includedCount = articles.filter(a => a.Include).length;
  const excludedCount = articles.filter(a => a.Exclude).length;
  const duplicatedCount = articles.filter(a => a.Duplicate).length;
  const pendingCount = total - includedCount - excludedCount - duplicatedCount;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans text-gray-800">
      <div className="max-w-[1200px] mx-auto space-y-6">
        
        {/* 最上方 Header 列 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="text-blue-600" size={24} /> 
            PRISMA Screening: Platin-based drugs for malignant pericardial effusion
          </h1>
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded hover:bg-purple-100 transition cursor-pointer text-sm font-medium">
              <FileUp size={16} /> Resume
              <input type="file" accept=".csv" onChange={handleResumeCSV} className="hidden" />
            </label>
            <button onClick={exportCSV} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition text-sm font-medium">
              <Download size={16} /> Export
            </button>
            {total > 0 && (
              <button onClick={clearData} className="flex items-center gap-1.5 bg-white text-red-600 border border-gray-200 px-3 py-1.5 rounded hover:bg-red-50 transition text-sm font-medium">
                <Trash2 size={16} /> Clear
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 左側/上方：Progress Dashboard */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
              <BarChart3 size={20} className="text-gray-500" /> Progress Dashboard
            </h2>
            
            <div className="grid grid-cols-5 gap-4 mb-4 text-center">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500 font-semibold uppercase">Total</p>
                <p className="text-2xl font-bold text-gray-800">{total}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                <p className="text-xs text-green-600 font-semibold uppercase">Included</p>
                <p className="text-2xl font-bold text-green-700">{includedCount}</p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                <p className="text-xs text-red-600 font-semibold uppercase">Excluded</p>
                <p className="text-2xl font-bold text-red-700">{excludedCount}</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                <p className="text-xs text-orange-600 font-semibold uppercase">Duplicate</p>
                <p className="text-2xl font-bold text-orange-700">{duplicatedCount}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-600 font-semibold uppercase">Pending</p>
                <p className="text-2xl font-bold text-blue-700">{pendingCount}</p>
              </div>
            </div>

            {/* 進度條 */}
            {total > 0 && (
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
                <div style={{ width: `${(includedCount / total) * 100}%` }} className="bg-green-500 h-full transition-all duration-500"></div>
                <div style={{ width: `${(excludedCount / total) * 100}%` }} className="bg-red-500 h-full transition-all duration-500"></div>
                <div style={{ width: `${(duplicatedCount / total) * 100}%` }} className="bg-orange-400 h-full transition-all duration-500"></div>
              </div>
            )}
          </div>

          {/* 右側：File Upload 區塊 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
              <Upload size={20} className="text-gray-500" /> Import Databases
            </h2>
            <div className="flex flex-col gap-3">
              {['PubMed', 'Embase', 'Cochrane'].map((source) => (
                <label key={source} className="cursor-pointer bg-gray-50 p-3 rounded-md border border-dashed border-gray-300 flex justify-between items-center hover:bg-blue-50 hover:border-blue-400 transition group">
                  <span className="font-semibold text-gray-700 text-sm group-hover:text-blue-700">{source} CSV</span>
                  <span className="bg-white px-2 py-1 text-xs border rounded text-gray-500 shadow-sm">Browse</span>
                  <input type="file" accept=".csv" onChange={(e) => handleFileUpload(e, source)} className="hidden" />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 文獻篩選卡片列表 */}
        <div className="flex flex-col gap-4">
          {articles.map((art, index) => {
            const isExpanded = expandedAbstracts.has(art.id);
            
            return (
              <div key={art.id} className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row overflow-hidden transition hover:shadow-md">
                
                {/* 左側：主內容與手風琴摘要 */}
                <div className="flex-1 p-5 flex gap-4">
                  <div className="text-gray-400 font-bold text-lg min-w-[24px] pt-1">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-blue-700 mb-1.5 leading-tight pr-4">
                      {art.Title}
                    </h3>
                    
                    <div className="text-sm text-gray-600 mb-3 space-y-0.5">
                      <p className="line-clamp-2">{art.Author}</p>
                      <p>
                        <span className="font-semibold text-gray-800">{art.Journal}</span> 
                        {art.Year && <span className="mx-1">• {art.Year}</span>}
                        {art.DOI && <span className="mx-1 text-gray-400">• DOI: {art.DOI}</span>}
                      </p>
                    </div>

                    {/* Abstract 手風琴按鈕 */}
                    <button 
                      onClick={() => toggleAbstract(art.id)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-blue-600 transition mb-2"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {isExpanded ? 'Hide Abstract' : 'Show Abstract'}
                    </button>

                    {/* Abstract 內容 (展開時顯示) */}
                    {isExpanded && (
                      <div className="text-sm text-gray-700 bg-gray-50 p-4 rounded-md border border-gray-200 leading-relaxed mt-2 animate-in slide-in-from-top-2 duration-200">
                        {art.Abstract ? art.Abstract : <span className="italic text-gray-400">No abstract available for this article.</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* 右側：操作面板 */}
                <div className="w-full md:w-[280px] bg-gray-50 border-t md:border-t-0 md:border-l border-gray-200 p-5 flex flex-col gap-3 justify-start shrink-0">
                  
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {art.PubMed === 1 && <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">PubMed</span>}
                    {art.Embase === 1 && <span className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Embase</span>}
                    {art.Cochrane === 1 && <span className="bg-orange-100 text-orange-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">CENTRAL</span>}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => handleDecision(art.id, 'include')}
                      className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md font-bold text-sm border transition-all ${art.Include ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-green-50 hover:border-green-400'}`}
                    >
                      <Check size={16} /> Include
                    </button>
                    
                    <button 
                      onClick={() => handleDecision(art.id, 'exclude')}
                      className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md font-bold text-sm border transition-all ${art.Exclude ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-red-50 hover:border-red-400'}`}
                    >
                      <X size={16} /> Exclude
                    </button>

                    {/* 新增的 Duplicate 按鈕 */}
                    <button 
                      onClick={() => handleDecision(art.id, 'duplicate')}
                      className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md font-bold text-sm border transition-all ${art.Duplicate ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-orange-50 hover:border-orange-400'}`}
                    >
                      <Copy size={16} /> Duplicate
                    </button>
                  </div>

                  {art.Exclude === 1 && (
                    <div className="mt-1 animate-in fade-in duration-200">
                      <select 
                        className="w-full text-sm border border-gray-300 rounded-md p-2 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                        value={art.ExcludeReason}
                        onChange={(e) => handleReasonChange(art.id, e.target.value)}
                      >
                        <option value="" disabled>Select reason...</option>
                        {EXCLUDE_REASONS.map(reason => (
                          <option key={reason} value={reason}>{reason}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
          
          {articles.length === 0 && !isProcessing && (
             <div className="text-center py-24 bg-white rounded-lg border border-dashed border-gray-300 text-gray-500">
               <Database className="mx-auto mb-3 text-gray-300" size={48} />
               <p className="text-lg font-semibold text-gray-600">No data available</p>
               <p className="text-sm">Upload databases from the panel above to begin your screening process.</p>
             </div>
          )}
        </div>

      </div>
    </div>
  );
}