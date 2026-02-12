
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FileUp, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Files, 
  RotateCcw,
  BookOpen,
  Layout
} from 'lucide-react';
import { ProcessingState, PageExtraction } from './types';
import { getPageCount, getPageAsImage, getPageAsDataUrl } from './services/pdfProcessor';
import { extractContentFromPage } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<ProcessingState>({
    status: 'idle',
    totalPages: 0,
    currentPage: 0,
    results: []
  });
  const [file, setFile] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setFile(null);
    setState({
      status: 'idle',
      totalPages: 0,
      currentPage: 0,
      results: []
    });
  };

  const processFile = async (uploadedFile: File) => {
    try {
      setState(prev => ({ ...prev, status: 'loading', errorMessage: undefined }));
      const count = await getPageCount(uploadedFile);
      
      setState(prev => ({ 
        ...prev, 
        status: 'processing', 
        totalPages: count, 
        currentPage: 1,
        results: Array.from({ length: count }, (_, i) => ({
          pageNumber: i + 1,
          content: '',
          status: 'pending'
        }))
      }));

      // Sequential Processing Loop
      for (let i = 1; i <= count; i++) {
        // Update current rendering page
        const pagePreview = await getPageAsDataUrl(uploadedFile, i);
        
        setState(prev => ({
          ...prev,
          currentPage: i,
          results: prev.results.map(r => 
            r.pageNumber === i 
              ? { ...r, status: 'processing', imageUrl: pagePreview } 
              : r
          )
        }));

        try {
          // Extract content using Gemini
          const base64 = await getPageAsImage(uploadedFile, i);
          const text = await extractContentFromPage(base64);

          setState(prev => ({
            ...prev,
            results: prev.results.map(r => 
              r.pageNumber === i 
                ? { ...r, content: text, status: 'completed' } 
                : r
            )
          }));
        } catch (err) {
          setState(prev => ({
            ...prev,
            results: prev.results.map(r => 
              r.pageNumber === i 
                ? { ...r, content: 'Failed to extract content.', status: 'error' } 
                : r
            )
          }));
        }
      }

      setState(prev => ({ ...prev, status: 'completed' }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        errorMessage: 'Failed to process file. Make sure it is a valid PDF.' 
      }));
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      processFile(selected);
    }
  };

  // Auto-scroll to the current processing page
  useEffect(() => {
    if (state.status === 'processing' && scrollRef.current) {
      const activeElement = document.getElementById(`page-${state.currentPage}`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [state.currentPage, state.status]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              DocuFlow <span className="text-indigo-600">AI</span>
            </h1>
          </div>
          
          {state.status !== 'idle' && (
            <button 
              onClick={reset}
              className="flex items-center space-x-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {state.status === 'idle' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-full max-w-xl bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-indigo-400 transition-all group">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 rounded-full mb-6 group-hover:scale-110 transition-transform">
                <FileUp className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload your PDF</h2>
              <p className="text-gray-500 mb-8 max-w-xs mx-auto">
                We'll extract the content page-by-page using Gemini AI vision.
              </p>
              <label className="inline-block px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl cursor-pointer hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-lg shadow-indigo-200">
                Select PDF File
                <input type="file" className="hidden" accept=".pdf" onChange={onFileChange} />
              </label>
            </div>
          </div>
        )}

        {(state.status === 'loading' || state.status === 'processing' || state.status === 'completed') && (
          <div className="space-y-8">
            {/* Progress Panel */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Files className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Processing Document</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{file?.name}</h3>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <div className="text-xs font-medium text-gray-400 uppercase">Current Stage</div>
                    <div className="text-lg font-bold text-gray-900">
                      Page {state.currentPage} <span className="text-gray-400">/ {state.totalPages}</span>
                    </div>
                  </div>
                  <div className="h-12 w-12 flex items-center justify-center bg-indigo-50 rounded-full">
                    {state.status === 'processing' ? (
                      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    )}
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-6 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                  style={{ width: `${(state.currentPage / state.totalPages) * 100}%` }}
                />
              </div>
            </div>

            {/* Results Grid */}
            <div ref={scrollRef} className="space-y-6">
              {state.results.map((res) => (
                <div 
                  key={res.pageNumber} 
                  id={`page-${res.pageNumber}`}
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm border transition-all duration-500 ${
                    res.status === 'processing' 
                      ? 'border-indigo-400 ring-2 ring-indigo-50 scale-[1.01]' 
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Page Visualization */}
                    <div className="w-full md:w-64 bg-gray-50 flex-shrink-0 border-r border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Page {res.pageNumber}</span>
                        {res.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {res.status === 'processing' && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                      </div>
                      <div className="aspect-[3/4] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex items-center justify-center relative">
                        {res.imageUrl ? (
                          <img src={res.imageUrl} alt={`Page ${res.pageNumber}`} className="w-full h-full object-cover" />
                        ) : (
                          <Layout className="w-10 h-10 text-gray-200" />
                        )}
                        {res.status === 'pending' && (
                          <div className="absolute inset-0 bg-gray-100/50 flex items-center justify-center backdrop-blur-[1px]">
                            <span className="text-xs font-medium text-gray-400">Waiting...</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 p-6 relative">
                      {res.status === 'pending' ? (
                        <div className="h-full flex items-center justify-center italic text-gray-400">
                          Waiting for processing sequence...
                        </div>
                      ) : res.status === 'processing' ? (
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2 text-indigo-600 font-medium">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>AI is reading page {res.pageNumber}...</span>
                          </div>
                          <div className="space-y-2 animate-pulse">
                            <div className="h-4 bg-gray-100 rounded w-full"></div>
                            <div className="h-4 bg-gray-100 rounded w-11/12"></div>
                            <div className="h-4 bg-gray-100 rounded w-10/12"></div>
                          </div>
                        </div>
                      ) : (
                        <div className="prose prose-sm max-w-none text-gray-700">
                          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                            <span className="text-sm font-semibold text-gray-900">Extracted Content</span>
                            <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-md font-medium border border-green-100">Ready</span>
                          </div>
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                            {res.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.status === 'error' && (
          <div className="max-w-xl mx-auto py-12 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Something went wrong</h3>
            <p className="text-gray-500">{state.errorMessage}</p>
            <button 
              onClick={reset}
              className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="py-8 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-400">
            Powered by Gemini AI Vision and PDF.js Core
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
