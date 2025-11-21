import React, { useState, useRef, useEffect } from 'react';
import { ParsedData, AnalysisStatus } from './types';
import { calculateStats, parseOscilloscopeCsv, performFFTAnalysis } from './utils/mathUtils';
import { analyzeSignalWithGemini } from './services/geminiService';
import { DataCharts } from './components/DataCharts';

const App: React.FC = () => {
  const [originalData, setOriginalData] = useState<ParsedData | null>(null); // Stores the full file data
  const [displayedData, setDisplayedData] = useState<ParsedData | null>(null); // Stores the currently zoomed/analyzed data
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus(AnalysisStatus.ANALYZING);
    setAiAnalysis("");
    setIsZoomed(false);

    try {
      const text = await file.text();
      
      // 1. Parse full file
      const { waveform, metadata } = parseOscilloscopeCsv(text);
      
      // 2. Stats
      const stats = calculateStats(waveform);
      
      // 3. FFT on full signal
      const { fftData, dominantFreq } = performFFTAnalysis(waveform, metadata.samplingRateHz);
      stats.dominantFrequency = dominantFreq;

      const fullData: ParsedData = {
        metadata,
        waveform,
        fftData,
        stats
      };

      setOriginalData(fullData);
      setDisplayedData(fullData);
      
      setStatus(AnalysisStatus.COMPLETED);
    } catch (error) {
      console.error("Parsing error", error);
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const handleZoom = (startIndex: number, endIndex: number) => {
    if (!originalData) return;

    // Slice the waveform
    const slicedWaveform = originalData.waveform.slice(startIndex, endIndex + 1);

    if (slicedWaveform.length < 10) return; // Prevent zooming too deep

    // Re-calculate stats for the slice
    const newStats = calculateStats(slicedWaveform);

    // Re-calculate FFT for the slice
    // Note: Freq resolution changes because N is smaller
    const { fftData, dominantFreq } = performFFTAnalysis(slicedWaveform, originalData.metadata.samplingRateHz);
    newStats.dominantFrequency = dominantFreq;

    setDisplayedData({
        metadata: {
            ...originalData.metadata,
            points: slicedWaveform.length // Update points count for display
        },
        waveform: slicedWaveform,
        fftData,
        stats: newStats
    });
    setIsZoomed(true);
    setAiAnalysis(""); // Clear old analysis as context changed
  };

  const handleResetZoom = () => {
    if (originalData) {
        setDisplayedData(originalData);
        setIsZoomed(false);
        setAiAnalysis("");
    }
  };

  const handleGeminiAnalysis = async () => {
    if (!displayedData) return;
    
    try {
        // Take a small snippet of raw data for the AI from the CURRENT view
        const snippet = displayedData.waveform.slice(0, 10).map(p => `${p.time.toFixed(4)}s: ${p.amplitude}`).join('\n');
        
        setAiAnalysis("Generating AI analysis for the current view... please wait.");
        
        const analysis = await analyzeSignalWithGemini(displayedData.metadata, displayedData.stats, snippet);
        setAiAnalysis(analysis);
    } catch (e) {
        setAiAnalysis("Error connecting to Gemini API. Please check your API Key configuration.");
    }
  };

  // Reset file input on mount
  useEffect(() => {
      if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M2 12h3l2 9 5-18 4 13h6"/></svg>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              OscilloView AI
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             <span className="text-xs font-medium px-2 py-1 bg-slate-700 rounded border border-slate-600 text-slate-400">v1.1 Pro</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Upload Section */}
        <div className="mb-8">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center border-dashed border-2 hover:border-blue-500 hover:bg-slate-750 transition-all duration-200 group cursor-pointer relative">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".csv,.txt" 
                    onChange={handleFileChange} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
                    <div className="p-3 bg-slate-700 rounded-full group-hover:bg-blue-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <div className="text-slate-300 font-medium">Click to upload CSV Data</div>
                    <div className="text-sm text-slate-500">Analyzes Time Base, Sampling Rate, and Amplitude automatically</div>
                </div>
            </div>
        </div>

        {status === AnalysisStatus.ANALYZING && (
             <div className="flex justify-center py-12">
                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
             </div>
        )}

        {displayedData && status === AnalysisStatus.COMPLETED && (
          <div className="space-y-6 animate-fade-in">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <StatCard label="Sample Rate" value={originalData?.metadata.samplingRate || `${displayedData.metadata.samplingRateHz} Hz`} />
                <StatCard label="Visible Points" value={displayedData.metadata.points.toLocaleString()} />
                <StatCard label="Peak-to-Peak" value={(displayedData.stats.max - displayedData.stats.min).toFixed(2)} sub={displayedData.metadata.yUnit} />
                <StatCard label="RMS" value={displayedData.stats.rms.toFixed(2)} sub={displayedData.metadata.yUnit} />
                <StatCard label="Dom. Freq" value={displayedData.stats.dominantFrequency.toFixed(1)} sub="Hz" highlight />
            </div>

            {/* Charts */}
            <DataCharts 
                waveform={displayedData.waveform} 
                fftData={displayedData.fftData} 
                unit={displayedData.metadata.yUnit}
                onZoomChange={handleZoom}
                onResetZoom={handleResetZoom}
                isZoomed={isZoomed}
            />

            {/* AI Analysis Section */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        AI Signal Insight {isZoomed && <span className="text-xs text-teal-500 ml-2 border border-teal-900 bg-teal-900/20 px-2 py-0.5 rounded">(Current View)</span>}
                    </h3>
                    <button 
                        onClick={handleGeminiAnalysis}
                        className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-teal-900/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span>Analyze View with Gemini</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                    </button>
                </div>
                <div className="p-6 bg-slate-900/50 min-h-[120px]">
                    {aiAnalysis ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <div className="whitespace-pre-wrap font-light text-slate-300 leading-relaxed">
                                {aiAnalysis}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 py-4 gap-2">
                            <p>Click the button above to generate an AI summary of the currently visible signal.</p>
                            <p className="text-xs opacity-60">Zoom into a region to analyze specific events.</p>
                        </div>
                    )}
                </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

const StatCard: React.FC<{label: string, value: string, sub?: string, highlight?: boolean}> = ({label, value, sub, highlight}) => (
    <div className={`bg-slate-800 p-4 rounded-xl border ${highlight ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-700'}`}>
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</div>
        <div className="flex items-baseline gap-1">
            <div className="text-2xl font-bold text-slate-100">{value}</div>
            {sub && <div className="text-sm text-slate-500">{sub}</div>}
        </div>
    </div>
);

export default App;