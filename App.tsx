
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  FileUp, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Files, 
  RotateCcw,
  BookOpen,
  Layout,
  Copy,
  Check,
  FileText,
  ClipboardCheck,
  Award,
  MessageSquare,
  HelpCircle
} from 'lucide-react';
import { ProcessingState, PageExtraction, EvaluationReport } from './types';
import { getPageCount, getPageAsImage, getPageAsDataUrl } from './services/pdfProcessor';
import { extractContentFromPage } from './services/geminiService';
import { processAndEvaluate } from './services/evaluatorService';

const toBase64 = (f: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(f);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });

const App: React.FC = () => {
  // --- State Hooks (Now correctly inside the component) ---
  const [state, setState] = useState<ProcessingState>({
    status: 'idle',
    totalPages: 0,
    currentPage: 0,
    results: []
  });
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setFile(null);
    setAnswerKeyFile(null);
    setReport(null);
    setCopied(false);
    setEvalError(null);
    setEvalLoading(false);
    setState({
      status: 'idle',
      totalPages: 0,
      currentPage: 0,
      results: []
    });
  };

  const handleEvaluate = async () => {
    if (!file || !answerKeyFile) return;
    
    try {
      setEvalLoading(true);
      setEvalError(null);

      const [studentBase64, keyBase64] = await Promise.all([
        toBase64(file),
        toBase64(answerKeyFile)
      ]);

      const evaluation = await processAndEvaluate(
        { base64: studentBase64, mimeType: file.type || 'application/pdf' },
        { base64: keyBase64, mimeType: answerKeyFile.type || 'application/pdf' }
      );

      setReport(evaluation);
    } catch (e: any) {
      setEvalError(e?.message || 'Evaluation failed. Please check your files and try again.');
    } finally {
      setEvalLoading(false);
    }
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

      for (let i = 1; i <= count; i++) {
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

  const combinedContent = useMemo(() => {
    return state.results
      .filter(r => r.status === 'completed')
      .map(r => r.content)
      .join('\n\n');
  }, [state.results]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(combinedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

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
          <div className="flex flex-col items-center justify-center py-10 space-y-8">
            <div className="w-full max-w-xl bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-indigo-400 transition-all group">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 rounded-full mb-6 group-hover:scale-110 transition-transform">
                <FileUp className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">1. Upload Student Work</h2>
              <p className="text-gray-500 mb-8 max-w-xs mx-auto">
                First, select the student's answer sheet (PDF).
              </p>
              <label className="inline-block px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl cursor-pointer hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-lg shadow-indigo-200">
                Select Student PDF
                <input type="file" className="hidden" accept=".pdf" onChange={onFileChange} />
              </label>
            </div>

            <div className="w-full max-w-xl bg-indigo-50/50 rounded-2xl p-8 border border-indigo-100">
              <div className="flex items-center space-x-3 mb-4">
                <ClipboardCheck className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-900">2. Add Answer Key (Optional)</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                If you want AI to grade this paper, upload the official answer key or original document here.
              </p>
              <div className="relative group">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setAnswerKeyFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"
                />
                {answerKeyFile && (
                  <p className="mt-2 text-sm font-medium text-indigo-600 animate-in fade-in slide-in-from-left-2">
                    ✓ Selected: {answerKeyFile.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {(state.status === 'loading' || state.status === 'processing' || state.status === 'completed') && (
          <div className="space-y-8 pb-20">
            {/* Progress Panel */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Files className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Document Extraction</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{file?.name}</h3>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-tight">Status</div>
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
              <div className="mt-6 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                  style={{ width: `${(state.currentPage / state.totalPages) * 100}%` }}
                />
              </div>
            </div>

            {/* Individual Page Extraction Grid */}
            <div ref={scrollRef} className="space-y-6">
              {state.results.map((res) => (
                <div 
                  key={res.pageNumber} 
                  id={`page-${res.pageNumber}`}
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm border transition-all duration-300 ${
                    res.status === 'processing' 
                      ? 'border-indigo-400 ring-4 ring-indigo-50 scale-[1.01]' 
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col md:flex-row">
                    <div className="w-full md:w-48 bg-gray-50 flex-shrink-0 border-r border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Page {res.pageNumber}</span>
                        {res.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      </div>
                      <div className="aspect-[3/4] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
                        {res.imageUrl ? (
                          <img src={res.imageUrl} alt={`Page ${res.pageNumber}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Layout className="w-8 h-8 text-gray-200" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 p-6">
                      {res.status === 'pending' ? (
                        <div className="h-full flex items-center justify-center italic text-gray-400 text-sm">
                          Pending sequential extraction...
                        </div>
                      ) : res.status === 'processing' ? (
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2 text-indigo-600 font-medium">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Gemini AI is scanning content...</span>
                          </div>
                          <div className="space-y-2">
                            <div className="h-3 bg-gray-100 rounded-full w-full animate-pulse"></div>
                            <div className="h-3 bg-gray-100 rounded-full w-5/6 animate-pulse"></div>
                            <div className="h-3 bg-gray-100 rounded-full w-4/6 animate-pulse"></div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-700">
                          <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Raw Extraction</span>
                            <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">Cleaned</span>
                          </div>
                          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-48 overflow-y-auto">
                            {res.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Combined Final Output Section */}
            {state.status === 'completed' && (
              <div className="mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
                  <div className="bg-indigo-600 px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-white">
                      <FileText className="w-6 h-6" />
                      <h2 className="text-xl font-bold">Combined Text Output</h2>
                    </div>
                    <button
                      onClick={copyToClipboard}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        copied 
                          ? 'bg-green-400 text-green-950' 
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied' : 'Copy All'}</span>
                    </button>
                  </div>
                  <div className="p-8">
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 min-h-[200px] max-h-[600px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-sans text-base text-gray-800 leading-relaxed">
                        {combinedContent || "No text was extracted."}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* --- Evaluation Section --- */}
                <div className="bg-white rounded-3xl border border-indigo-200 shadow-2xl overflow-hidden">
                  <div className="bg-indigo-50 px-8 py-6 border-b border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-indigo-700">
                        <Award className="w-6 h-6" />
                        <h2 className="text-xl font-bold">Automatic Evaluation</h2>
                      </div>
                      <p className="text-sm text-indigo-600/70 font-medium">
                        Compare extracted content against the Answer Key
                      </p>
                    </div>

                    {!report && !evalLoading && (
                      <div className="flex items-center space-x-4">
                        {!answerKeyFile && (
                          <div className="flex items-center space-x-2 text-xs font-medium text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                            <AlertCircle className="w-4 h-4" />
                            <span>Upload an Answer Key to evaluate</span>
                          </div>
                        )}
                        <button
                          disabled={!answerKeyFile}
                          onClick={handleEvaluate}
                          className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          Grade Paper Now
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-8">
                    {evalLoading ? (
                      <div className="py-20 flex flex-col items-center space-y-6">
                        <div className="relative">
                          <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 bg-indigo-50 rounded-full animate-pulse"></div>
                          </div>
                        </div>
                        <div className="text-center space-y-2">
                          <h4 className="text-lg font-bold text-gray-900">Gemini is evaluating...</h4>
                          <p className="text-sm text-gray-500">Aligning questions and grading responses against the key.</p>
                        </div>
                      </div>
                    ) : evalError ? (
                      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start space-x-4">
                        <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                        <div>
                          <h4 className="font-bold text-red-900">Evaluation Error</h4>
                          <p className="text-sm text-red-700">{evalError}</p>
                          <button onClick={handleEvaluate} className="mt-4 text-xs font-bold text-red-800 underline">Try again</button>
                        </div>
                      </div>
                    ) : report ? (
                      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl">
                            <div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Total Score</div>
                            <div className="text-4xl font-black">
                              {report.totalScore} <span className="text-lg opacity-60">/ {report.maxPossibleScore}</span>
                            </div>
                            <div className="mt-4 h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-white transition-all duration-1000" 
                                style={{ width: `${(report.totalScore / report.maxPossibleScore) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                            <div className="flex items-center space-x-2 text-gray-400 mb-3">
                              <MessageSquare className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Global Summary</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed font-medium">
                              {report.summary}
                            </p>
                          </div>
                          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                            <div className="flex items-center space-x-2 text-gray-400 mb-3">
                              <HelpCircle className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">To Improve</span>
                            </div>
                            <ul className="space-y-2">
                              {report.improvementAreas.map((area, idx) => (
                                <li key={idx} className="flex items-start space-x-2 text-sm text-gray-600">
                                  <span className="w-1 h-1 rounded-full bg-indigo-400 mt-2 shrink-0"></span>
                                  <span>{area}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Detailed Question Table */}
                        <div className="space-y-4">
                          <h4 className="text-lg font-bold text-gray-900 px-2">Itemized Grading</h4>
                          <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                  <tr>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Q#</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Question Text</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Answer Key</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Student</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Score</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Feedback</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {report.items.map((item) => (
                                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                                      <td className="px-6 py-4 text-sm font-black text-indigo-600">{item.questionNumber}</td>
                                      <td className="px-6 py-4 text-sm text-gray-900 font-semibold max-w-[200px] truncate">{item.questionText}</td>
                                      <td className="px-6 py-4 text-xs text-gray-500 max-w-[150px] truncate italic">{item.modelAnswer}</td>
                                      <td className="px-6 py-4 text-xs text-gray-800 font-medium max-w-[150px] truncate">{item.studentAnswer}</td>
                                      <td className="px-6 py-4">
                                        <div className="flex items-center space-x-1">
                                          <span className={`text-sm font-bold ${item.score === item.maxScore ? 'text-green-600' : 'text-amber-600'}`}>
                                            {item.score}
                                          </span>
                                          <span className="text-[10px] text-gray-400">/ {item.maxScore}</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-xs text-gray-600">{item.feedback}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-20 flex flex-col items-center text-center space-y-4">
                        <Award className="w-12 h-12 text-gray-200" />
                        <div className="space-y-1">
                          <h4 className="font-bold text-gray-400">Ready for Grading</h4>
                          <p className="text-xs text-gray-400 max-w-xs">The evaluation will appear here once you click "Grade Paper Now".</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {state.status === 'error' && (
          <div className="max-w-xl mx-auto py-12 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Extraction Error</h3>
            <p className="text-gray-500">{state.errorMessage}</p>
            <button onClick={reset} className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors">Try Again</button>
          </div>
        )}
      </main>

      <footer className="py-8 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-400">
            Powered by Gemini 2.5/3 Pro & PDF.js • Secure In-Browser Processing
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
