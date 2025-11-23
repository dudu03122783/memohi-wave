
import React, { useState, useRef, useEffect } from 'react';
import { ParsedData, AnalysisStatus, ChannelStats, WindowFunctionType, SignalMetadata, Language } from './types';
import { calculateStats, parseOscilloscopeCsv, performFFTAnalysis } from './utils/mathUtils';
import { analyzeSignalWithGemini } from './services/geminiService';
import { DataCharts } from './components/DataCharts';
import { MetadataCard } from './components/MetadataCard';

const TRANSLATIONS = {
  zh: {
    multiChannel: "多通道",
    clickUpload: "点击上传 CSV 数据",
    analyzing: "正在分析...",
    signalMetadata: "信号元数据",
    timeBase: "时基",
    samplingRate: "采样率",
    dataPoints: "数据点数",
    verticalUnit: "垂直单位",
    amplitude: "幅度",
    channelStats: "通道统计",
    peakMax: "最大值",
    peakMin: "最小值",
    average: "平均值",
    rms: "有效值",
    domFreq: "主频",
    aiInsight: "AI 信号洞察",
    currentView: "当前视图",
    analyzeButton: "使用 Gemini 分析视图",
    aiPlaceholder: "点击上方按钮生成当前可见信号的 AI 摘要。",
    aiHint: "缩放至特定区域以分析特定事件。",
    timeDomain: "时域",
    zoomMode: "缩放模式 (框选)",
    panMode: "平移模式 (拖拽)",
    xZoom: "水平缩放",
    reset: "重置",
    freqDomain: "频域 (FFT)",
    channel: "通道",
    scope: "范围",
    view: "视图",
    full: "全览",
    window: "窗函数",
    points: "点数",
    res: "分辨率",
    freqHz: "频率 (Hz)",
    magnitude: "幅度",
    windowTypes: {
      rectangular: "矩形窗 (无)",
      hanning: "汉宁窗",
      hamming: "汉明窗",
      blackman: "布莱克曼窗"
    },
    analyzingPrompt: "正在生成当前视图的 AI 分析... 请稍候。",
    errorAnalysis: "生成分析时出错。"
  },
  en: {
    multiChannel: "Multi-Channel",
    clickUpload: "Click to upload CSV Data",
    analyzing: "Analyzing...",
    signalMetadata: "Signal Metadata",
    timeBase: "Time Base",
    samplingRate: "Sampling Rate",
    dataPoints: "Data Points",
    verticalUnit: "Vertical Unit",
    amplitude: "Amplitude",
    channelStats: "Channel Stats",
    peakMax: "Peak Max",
    peakMin: "Peak Min",
    average: "Average",
    rms: "RMS",
    domFreq: "Dom. Freq",
    aiInsight: "AI Signal Insight",
    currentView: "Current View",
    analyzeButton: "Analyze View with Gemini",
    aiPlaceholder: "Click the button above to generate an AI summary of the currently visible signal.",
    aiHint: "Zoom into a region to analyze specific events.",
    timeDomain: "Time Domain",
    zoomMode: "Zoom Mode (Draw Box)",
    panMode: "Pan Mode (Drag Hand)",
    xZoom: "X ZOOM",
    reset: "RESET",
    freqDomain: "Frequency Domain (FFT)",
    channel: "Channel",
    scope: "SCOPE",
    view: "VIEW",
    full: "FULL",
    window: "WINDOW",
    points: "Points",
    res: "Res",
    freqHz: "Freq (Hz)",
    magnitude: "Magnitude",
    windowTypes: {
      rectangular: "Rectangular (None)",
      hanning: "Hanning",
      hamming: "Hamming",
      blackman: "Blackman"
    },
    analyzingPrompt: "Generating AI analysis for the current view... please wait.",
    errorAnalysis: "Error generating analysis."
  }
};

const App: React.FC = () => {
  const [originalData, setOriginalData] = useState<ParsedData | null>(null);
  const [displayedData, setDisplayedData] = useState<ParsedData | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [lang, setLang] = useState<Language>('zh');
  
  const t = TRANSLATIONS[lang];

  // View State
  const [visibleChannels, setVisibleChannels] = useState<string[]>([]);
  const [selectedFftChannel, setSelectedFftChannel] = useState<string | null>(null);

  // FFT Configuration
  const [fftConfig, setFftConfig] = useState<{
    scope: 'view' | 'full';
    window: WindowFunctionType;
  }>({ scope: 'view', window: 'hanning' });

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
      
      // 2. Stats per channel
      const stats = calculateStats(waveform, metadata.channels);
      
      // 3. FFT on full signal (Initial default)
      const { fftData, dominantFreqs, fftPoints, frequencyResolution } = performFFTAnalysis(
          waveform, 
          metadata.samplingRateHz, 
          metadata.channels, 
          fftConfig.window
      );
      
      // Update stats with dominant freq
      stats.forEach(s => {
          s.dominantFrequency = dominantFreqs[s.channelId];
      });

      const fullData: ParsedData = {
        metadata,
        waveform,
        fftData,
        stats,
        fftMetadata: {
            scope: 'view', // Default when not zoomed means view == full
            window: fftConfig.window,
            points: fftPoints,
            resolution: frequencyResolution
        }
      };

      // Initialize view state
      setVisibleChannels(metadata.channels);
      setSelectedFftChannel(metadata.channels[0] || null);

      setOriginalData(fullData);
      setDisplayedData(fullData);
      
      setStatus(AnalysisStatus.COMPLETED);
    } catch (error) {
      console.error("Parsing error", error);
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const recalculateFFT = (
      targetWaveform: typeof displayedData.waveform, 
      metadata: typeof displayedData.metadata,
      currentConfig: typeof fftConfig
  ) => {
      const sourceWaveform = currentConfig.scope === 'full' && originalData 
          ? originalData.waveform 
          : targetWaveform;

      const { fftData, dominantFreqs, fftPoints, frequencyResolution } = performFFTAnalysis(
          sourceWaveform, 
          metadata.samplingRateHz, 
          metadata.channels, 
          currentConfig.window
      );
      return { fftData, dominantFreqs, fftPoints, frequencyResolution };
  };

  const updateDisplayedData = (
      newWaveform: typeof displayedData.waveform, 
      newStats: ChannelStats[],
      currentConfig: typeof fftConfig
  ) => {
      if (!originalData) return;

      const { fftData, dominantFreqs, fftPoints, frequencyResolution } = recalculateFFT(newWaveform, originalData.metadata, currentConfig);

      // Update stats dominant frequency based on the FFT analysis (View or Full)
      newStats.forEach(s => {
          s.dominantFrequency = dominantFreqs[s.channelId];
      });

      setDisplayedData({
          metadata: {
              ...originalData.metadata,
              points: newWaveform.length 
          },
          waveform: newWaveform,
          fftData,
          stats: newStats,
          channels: originalData.metadata.channels,
          fftMetadata: {
              scope: currentConfig.scope,
              window: currentConfig.window,
              points: fftPoints,
              resolution: frequencyResolution
          }
      } as ParsedData); 
  };

  const handleFftConfigChange = (newConfig: Partial<typeof fftConfig>) => {
      const updatedConfig = { ...fftConfig, ...newConfig };
      setFftConfig(updatedConfig);
      
      if (displayedData && originalData) {
          // Re-run analysis on existing displayed waveform
          updateDisplayedData(displayedData.waveform, displayedData.stats, updatedConfig);
      }
  };

  const handleZoom = (startTime: number, endTime: number) => {
    if (!originalData) return;

    if (startTime >= endTime) return;

    let startIndex = originalData.waveform.findIndex(p => p.time >= startTime);
    if (startIndex === -1) {
        if (startTime <= originalData.waveform[0].time) startIndex = 0;
        else startIndex = originalData.waveform.length - 1;
    }
    
    let endIndex = originalData.waveform.findIndex(p => p.time >= endTime);
    if (endIndex === -1) {
         if (endTime >= originalData.waveform[originalData.waveform.length-1].time) {
             endIndex = originalData.waveform.length - 1;
         } else {
             endIndex = 0;
         }
    }
    
    startIndex = Math.max(0, startIndex);
    endIndex = Math.min(originalData.waveform.length - 1, endIndex);

    if (startIndex >= endIndex) return;

    const slicedWaveform = originalData.waveform.slice(startIndex, endIndex + 1);
    if (slicedWaveform.length < 2) return; 

    const newStats = calculateStats(slicedWaveform, originalData.metadata.channels);

    updateDisplayedData(slicedWaveform, newStats, fftConfig);

    setIsZoomed(true);
    setAiAnalysis(""); 
  };

  const handleResetZoom = () => {
    if (originalData) {
        // Reset to full view
        updateDisplayedData(originalData.waveform, originalData.stats, fftConfig);
        setIsZoomed(false);
        setAiAnalysis("");
    }
  };

  const toggleChannelVisibility = (channel: string) => {
      setVisibleChannels(prev => 
          prev.includes(channel) 
              ? prev.filter(c => c !== channel)
              : [...prev, channel]
      );
  };

  const handleGeminiAnalysis = async () => {
    if (!displayedData) return;
    
    try {
        setAiAnalysis(t.analyzingPrompt);
        const snippet = displayedData.waveform.slice(0, 10).map(p => {
            const channelsStr = displayedData.metadata.channels.map(ch => `${ch}:${p[ch].toFixed(2)}`).join(', ');
            return `${p.time.toFixed(5)}s: ${channelsStr}`;
        }).join('\n');
        
        const analysis = await analyzeSignalWithGemini(displayedData.metadata, displayedData.stats as any, snippet, lang);
        setAiAnalysis(analysis);
    } catch (e) {
        console.error(e);
        setAiAnalysis(t.errorAnalysis);
    }
  };

  useEffect(() => {
      if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-blue-500 selection:text-white">
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
             <div className="flex bg-slate-900 rounded-md border border-slate-700 p-0.5">
                <button 
                    onClick={() => setLang('zh')} 
                    className={`px-2 py-1 text-xs font-bold rounded ${lang === 'zh' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    中文
                </button>
                <button 
                    onClick={() => setLang('en')} 
                    className={`px-2 py-1 text-xs font-bold rounded ${lang === 'en' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    EN
                </button>
             </div>
             <span className="text-xs font-medium px-2 py-1 bg-slate-700 rounded border border-slate-600 text-slate-400">{t.multiChannel}</span>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[95%] mx-auto px-4 py-6">
        <div className="mb-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center border-dashed border-2 hover:border-blue-500 hover:bg-slate-750 transition-all duration-200 group cursor-pointer relative max-w-2xl mx-auto">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".csv,.txt" 
                    onChange={handleFileChange} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                    <div className="p-2 bg-slate-700 rounded-full group-hover:bg-blue-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <div className="text-slate-300 font-medium">{t.clickUpload}</div>
                </div>
            </div>
        </div>

        {status === AnalysisStatus.ANALYZING && (
             <div className="flex justify-center py-12">
                 <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <span className="text-slate-400 text-sm animate-pulse">{t.analyzing}</span>
                 </div>
             </div>
        )}

        {displayedData && originalData && status === AnalysisStatus.COMPLETED && (
          <div className="space-y-6 animate-fade-in">
            
            <MetadataCard metadata={originalData.metadata} labels={t} />

            <DataCharts 
                waveform={displayedData.waveform}
                fftData={displayedData.fftData}
                unit={displayedData.metadata.yUnit}
                channels={displayedData.metadata.channels}
                fullTimeRange={originalData ? { start: originalData.waveform[0].time, end: originalData.waveform[originalData.waveform.length-1].time } : null}
                visibleChannels={visibleChannels}
                onToggleChannel={toggleChannelVisibility}
                selectedFftChannel={selectedFftChannel}
                onFftChannelChange={setSelectedFftChannel}
                onZoomChange={handleZoom}
                onResetZoom={handleResetZoom}
                isZoomed={isZoomed}
                fftConfig={fftConfig}
                onFftConfigChange={handleFftConfigChange}
                fftMetadata={displayedData.fftMetadata}
                translations={t}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-sm">
                 <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center">
                     <span className="w-1.5 h-6 bg-emerald-500 rounded mr-3"></span>
                     {t.channelStats}
                 </h3>
                 <div className="grid grid-cols-1 gap-4">
                    {displayedData.stats.map(stat => (
                        visibleChannels.includes(stat.channelId) && (
                            <div key={stat.channelId} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm font-bold text-slate-300 uppercase">{t.channel} {stat.channelId}</span>
                                    <span className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/50">
                                        {t.domFreq}: {stat.dominantFrequency.toFixed(2)} Hz
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-slate-500 text-[10px] uppercase block mb-0.5">{t.peakMax}</span>
                                        <span className="font-mono text-slate-200">{stat.max.toFixed(3)} {displayedData.metadata.yUnit}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 text-[10px] uppercase block mb-0.5">{t.peakMin}</span>
                                        <span className="font-mono text-slate-200">{stat.min.toFixed(3)} {displayedData.metadata.yUnit}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 text-[10px] uppercase block mb-0.5">{t.average}</span>
                                        <span className="font-mono text-slate-200">{stat.average.toFixed(3)} {displayedData.metadata.yUnit}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 text-[10px] uppercase block mb-0.5">{t.rms}</span>
                                        <span className="font-mono text-slate-200">{stat.rms.toFixed(3)} {displayedData.metadata.yUnit}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    ))}
                 </div>
              </div>

              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-100 flex items-center">
                        <span className="w-1.5 h-6 bg-rose-500 rounded mr-3"></span>
                        {t.aiInsight}
                    </h3>
                    <span className="text-xs text-slate-500 font-medium bg-slate-900 px-2 py-1 rounded">
                        {isZoomed ? t.currentView : t.full}
                    </span>
                </div>
                
                <div className="flex-1 bg-slate-900/50 rounded-lg border border-slate-700/50 p-4 min-h-[200px] relative">
                    {aiAnalysis ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <div className="whitespace-pre-wrap text-slate-300 leading-relaxed">{aiAnalysis}</div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 opacity-60">
                            <svg className="w-12 h-12 text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            <p className="text-slate-400 text-sm font-medium mb-1">{t.aiPlaceholder}</p>
                            <p className="text-slate-600 text-xs">{t.aiHint}</p>
                        </div>
                    )}
                </div>
                
                <button 
                    onClick={handleGeminiAnalysis}
                    disabled={!process.env.API_KEY}
                    className="mt-4 w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg shadow-lg shadow-blue-900/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    {t.analyzeButton}
                </button>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default App;
