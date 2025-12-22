
import React, { useState, useRef, useEffect } from 'react';
import { ParsedData, AnalysisStatus, ChannelStats, WindowFunctionType, SignalMetadata, Language, ThemeKey, ThemeColors } from './types';
import { calculateStats, parseOscilloscopeCsv, performFFTAnalysis } from './utils/mathUtils';
import { analyzeSignalWithGemini } from './services/geminiService';
import { DataCharts } from './components/DataCharts';
import { MetadataCard } from './components/MetadataCard';
import { PowerAnalysis } from './components/PowerAnalysis';

// Theme Definitions
const THEMES: Record<ThemeKey, ThemeColors> = {
  'quiet-light': {
    name: 'Quiet Light',
    bgApp: 'bg-[#F5F5F5]',
    bgCard: 'bg-[#FFFFFF]',
    bgPanel: 'bg-[#FAFAFA]',
    border: 'border-[#E0E0E0]',
    textMain: 'text-[#333333]',
    textTitle: 'text-[#111111]',
    textMuted: 'text-[#777777]',
    accent: 'text-[#6C5CE7]',
    button: 'bg-[#6C5CE7] hover:bg-[#5849BE]',
    chartColors: ["#6C5CE7", "#00B894", "#E17055", "#0984E3", "#FD79A8", "#FDCB6E"]
  },
  'vs-light': {
    name: 'Visual Studio Light',
    bgApp: 'bg-[#F3F3F3]',
    bgCard: 'bg-[#FFFFFF]',
    bgPanel: 'bg-[#F9F9F9]',
    border: 'border-[#CCCCCC]',
    textMain: 'text-[#1E1E1E]',
    textTitle: 'text-[#000000]',
    textMuted: 'text-[#717171]',
    accent: 'text-[#007ACC]',
    button: 'bg-[#007ACC] hover:bg-[#0063A5]',
    chartColors: ["#007ACC", "#048632", "#A31515", "#7D4792", "#D16969", "#D7BA7D"]
  },
  'solarized-light': {
    name: 'Solarized Light',
    bgApp: 'bg-[#FDF6E3]',
    bgCard: 'bg-[#EEE8D5]',
    bgPanel: 'bg-[#FDF6E3]/50',
    border: 'border-[#D2D0C3]',
    textMain: 'text-[#586E75]', // Base01
    textTitle: 'text-[#073642]', // Base02
    textMuted: 'text-[#93A1A1]', // Base1
    accent: 'text-[#268BD2]', // Blue
    button: 'bg-[#268BD2] hover:bg-[#2075C7]',
    chartColors: ["#268BD2", "#859900", "#DC322F", "#D33682", "#6C71C4", "#B58900"]
  },
  'dracula': {
    name: 'Dracula',
    bgApp: 'bg-[#282A36]',
    bgCard: 'bg-[#44475A]',
    bgPanel: 'bg-[#282A36]/60',
    border: 'border-[#6272A4]',
    textMain: 'text-[#F8F8F2]',
    textTitle: 'text-[#FFFFFF]',
    textMuted: 'text-[#BD93F9]',
    accent: 'text-[#FF79C6]',
    button: 'bg-[#BD93F9] hover:bg-[#A97BF7] text-[#282A36]',
    chartColors: ["#BD93F9", "#50FA7B", "#FF79C6", "#FFB86C", "#8BE9FD", "#FF5555"]
  },
  'monokai-black': {
    name: 'Monokai Black',
    bgApp: 'bg-[#121212]',
    bgCard: 'bg-[#1E1E1E]',
    bgPanel: 'bg-[#272822]',
    border: 'border-[#49483E]',
    textMain: 'text-[#F8F8F2]',
    textTitle: 'text-[#F92672]',
    textMuted: 'text-[#75715E]',
    accent: 'text-[#A6E22E]',
    button: 'bg-[#A6E22E] hover:bg-[#8cc41f] text-[#272822]',
    chartColors: ["#F92672", "#A6E22E", "#66D9EF", "#FD971F", "#AE81FF", "#F8F8F2"]
  }
};

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
    rms: "有效值 (DC)",
    acRms: "有效值 (AC)",
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
    errorAnalysis: "生成分析时出错。",
    resetApp: "导入新文件",
    themes: "主题",
    dataConversion: "数据换算",
    sourceChannel: "源通道",
    factor: "系数",
    newUnit: "新单位",
    applyMath: "应用换算",
    mathChannel: "数学通道",
    cursors: "光标测量",
    cursorTime: "时间 (纵向)",
    cursorAmp: "幅值 (横向)",
    cursorNone: "关闭",
    cursorSet: "点击图表设置",
    renameHint: "点击名称可重命名",
    powerAnalysis: "三相电流质量分析 (电机)",
    phaseU: "U相 (输入)",
    phaseV: "V相 (输入)",
    qualityMetrics: "质量指标",
    fundFreq: "基波频率",
    unbalance: "不平衡度",
    phasorDiagram: "相量图",
    harmonics: "谐波分析",
    calculateButton: "开始计算 (本地)",
    thdTitle: "关于 THD (总谐波失真)",
    thdExplanation: "THD 反映了信号波形相对于纯正弦波的畸变程度。它是所有谐波成分有效值与基波有效值之比。THD 越低，波形越纯净，电机运行效率越高且发热越少。",
    thdStandards: "参考标准：通常 IEEE 519 建议电压 THD < 5%。对于电机电流，一般负载下 THD < 10% 是可接受的，但越低越好。",
    harmonicsExplanation: "该柱状图将畸变的波形分解为不同频率的正弦波。'1f' 是基波（有用能量，如 50/60Hz），'3f'、'5f' 等是奇次谐波（干扰）。谐波过高会导致电机震动和过热。"
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
    rms: "RMS (DC)",
    acRms: "RMS (AC)",
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
    errorAnalysis: "Error generating analysis.",
    resetApp: "Import New",
    themes: "Themes",
    dataConversion: "Data Conversion",
    sourceChannel: "Source Ch",
    factor: "Factor",
    newUnit: "New Unit",
    applyMath: "Apply Math",
    mathChannel: "Math Ch",
    cursors: "Cursors",
    cursorTime: "Time (Vert)",
    cursorAmp: "Amp (Horiz)",
    cursorNone: "Off",
    cursorSet: "Click Chart to Set",
    renameHint: "Click name to rename",
    powerAnalysis: "3-Phase Power Analysis (Motor)",
    phaseU: "Phase U (Input)",
    phaseV: "Phase V (Input)",
    qualityMetrics: "Quality Metrics",
    fundFreq: "Fund. Freq",
    unbalance: "Unbalance",
    phasorDiagram: "Phasor Diagram",
    harmonics: "Harmonics",
    calculateButton: "Calculate (Local)",
    thdTitle: "About THD (Total Harmonic Distortion)",
    thdExplanation: "THD measures the distortion of the waveform compared to a pure sine wave. It is the ratio of the RMS amplitude of a set of higher harmonic frequencies to the RMS amplitude of the first harmonic. Lower is better.",
    thdStandards: "Standard Ref: IEEE 519 recommends Voltage THD < 5%. For motor currents, THD < 10% is often acceptable at load, though lower is better for efficiency.",
    harmonicsExplanation: "This chart decomposes the signal into constituent sine waves. '1f' is the fundamental (useful power). '3f', '5f' etc. are harmonics (pollution). High harmonics cause heating and vibration."
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
  const [currentThemeKey, setCurrentThemeKey] = useState<ThemeKey>('quiet-light');
  
  const theme = THEMES[currentThemeKey];
  const t = TRANSLATIONS[lang];

  // View State
  const [visibleChannels, setVisibleChannels] = useState<string[]>([]);
  const [selectedFftChannel, setSelectedFftChannel] = useState<string | null>(null);
  const [channelNames, setChannelNames] = useState<Record<string, string>>({});
  const [channelUnits, setChannelUnits] = useState<Record<string, string>>({}); // Store unit per channel
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");

  // Math State
  const [mathSourceCh, setMathSourceCh] = useState<string>('');
  const [mathFactor, setMathFactor] = useState<string>('1.0');
  const [mathUnit, setMathUnit] = useState<string>('');
  const [mathCount, setMathCount] = useState(0);

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
    setMathCount(0);
    setChannelNames({});
    setChannelUnits({});

    try {
      const text = await file.text();
      const { waveform, metadata } = parseOscilloscopeCsv(text);
      const stats = calculateStats(waveform, metadata.channels);
      
      const { fftData, dominantFreqs, fftPoints, frequencyResolution } = performFFTAnalysis(
          waveform, 
          metadata.samplingRateHz, 
          metadata.channels, 
          fftConfig.window
      );
      
      stats.forEach(s => {
          s.dominantFrequency = dominantFreqs[s.channelId];
      });

      const fullData: ParsedData = {
        metadata,
        waveform,
        fftData,
        stats,
        fftMetadata: {
            scope: 'view',
            window: fftConfig.window,
            points: fftPoints,
            resolution: frequencyResolution
        }
      };
      
      // Initialize units for original channels
      const initialUnits: Record<string, string> = {};
      metadata.channels.forEach(ch => initialUnits[ch] = metadata.yUnit);
      setChannelUnits(initialUnits);

      setVisibleChannels(metadata.channels);
      setSelectedFftChannel(metadata.channels[0] || null);
      setMathSourceCh(metadata.channels[0] || '');

      setOriginalData(fullData);
      setDisplayedData(fullData);
      setStatus(AnalysisStatus.COMPLETED);
    } catch (error) {
      console.error("Parsing error", error);
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const resetApp = () => {
    setOriginalData(null);
    setDisplayedData(null);
    setStatus(AnalysisStatus.IDLE);
    setAiAnalysis("");
    setIsZoomed(false);
    setMathCount(0);
    setChannelNames({});
    setChannelUnits({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRenaming = (channelId: string) => {
      setEditingChannel(channelId);
      setTempName(channelNames[channelId] || channelId);
  };

  const saveChannelName = () => {
      if (editingChannel) {
          setChannelNames(prev => ({ ...prev, [editingChannel]: tempName }));
          setEditingChannel(null);
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
      currentConfig: typeof fftConfig,
      sourceData: ParsedData = originalData!
  ) => {
      if (!sourceData) return;

      const { fftData, dominantFreqs, fftPoints, frequencyResolution } = recalculateFFT(newWaveform, sourceData.metadata, currentConfig);

      newStats.forEach(s => {
          s.dominantFrequency = dominantFreqs[s.channelId];
      });

      setDisplayedData({
          metadata: {
              ...sourceData.metadata,
              points: newWaveform.length 
          },
          waveform: newWaveform,
          fftData,
          stats: newStats,
          channels: sourceData.metadata.channels,
          fftMetadata: {
              scope: currentConfig.scope,
              window: currentConfig.window,
              points: fftPoints,
              resolution: frequencyResolution
          }
      } as ParsedData); 
  };

  const handleApplyMath = () => {
    if (!originalData || !mathSourceCh || isNaN(parseFloat(mathFactor))) return;

    const factor = parseFloat(mathFactor);
    const newChName = `Math${mathCount + 1}`;
    
    // 1. Update original waveform with new channel data
    const newWaveform = originalData.waveform.map(point => ({
        ...point,
        [newChName]: (point[mathSourceCh] || 0) * factor
    }));

    // 2. Update channels list
    const newChannels = [...originalData.metadata.channels, newChName];

    // 3. Update stats
    const newStats = calculateStats(newWaveform, newChannels);

    // 4. Create new full data object
    const newMetadata = { ...originalData.metadata, channels: newChannels };
    const newOriginalData: ParsedData = {
        ...originalData,
        waveform: newWaveform,
        metadata: newMetadata,
        stats: newStats
    };

    // 5. Update state
    setOriginalData(newOriginalData);
    setMathCount(prev => prev + 1);
    setVisibleChannels(prev => [...prev, newChName]);
    if (!selectedFftChannel) setSelectedFftChannel(newChName);
    
    // Update Units
    const finalUnit = mathUnit.trim() || originalData.metadata.yUnit;
    setChannelUnits(prev => ({ ...prev, [newChName]: finalUnit }));

    // 6. Refresh view
    updateDisplayedData(newWaveform, newStats, fftConfig, newOriginalData);
    setIsZoomed(false);
  };

  const handleFftConfigChange = (newConfig: Partial<typeof fftConfig>) => {
      const updatedConfig = { ...fftConfig, ...newConfig };
      setFftConfig(updatedConfig);
      
      if (displayedData && originalData) {
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
    <div className={`min-h-screen flex flex-col ${theme.bgApp} ${theme.textMain} font-sans transition-colors duration-300`}>
      <header className={`${theme.bgCard} border-b ${theme.border} sticky top-0 z-20 shadow-md transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${theme.button} p-2 rounded-lg shadow-lg`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M2 12h3l2 9 5-18 4 13h6"/></svg>
            </div>
            <h1 className={`text-xl font-bold ${theme.textTitle}`}>
              OscilloView AI
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Theme Switcher */}
             <div className="hidden sm:flex items-center gap-1 bg-black/20 rounded-lg p-1">
                {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
                    <button
                        key={k}
                        onClick={() => setCurrentThemeKey(k)}
                        className={`w-4 h-4 rounded-full border border-white/20 hover:scale-110 transition-transform ${currentThemeKey === k ? 'ring-2 ring-white' : ''}`}
                        style={{ backgroundColor: THEMES[k].chartColors[0] }}
                        title={THEMES[k].name}
                    />
                ))}
             </div>

             {originalData && (
                 <button 
                    onClick={resetApp}
                    className={`px-3 py-1.5 text-xs font-bold ${theme.bgPanel} ${theme.textTitle} rounded border ${theme.border} hover:bg-white/10`}
                 >
                    {t.resetApp}
                 </button>
             )}

             <div className={`flex ${theme.bgApp} rounded-md border ${theme.border} p-0.5`}>
                <button 
                    onClick={() => setLang('zh')} 
                    className={`px-2 py-1 text-xs font-bold rounded ${lang === 'zh' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}
                >
                    中文
                </button>
                <button 
                    onClick={() => setLang('en')} 
                    className={`px-2 py-1 text-xs font-bold rounded ${lang === 'en' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}
                >
                    EN
                </button>
             </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[95%] mx-auto px-4 py-6 flex-1">
        {/* Upload Section - Only Show when IDLE or ERROR */}
        {(status === AnalysisStatus.IDLE || status === AnalysisStatus.ERROR) && (
            <div className="mb-6 animate-fade-in">
                <div className={`${theme.bgCard} rounded-xl border-2 border-dashed ${theme.border} hover:border-${theme.accent.split('-')[1]}-500 p-12 text-center transition-all duration-200 group cursor-pointer relative max-w-2xl mx-auto`}>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        accept=".csv,.txt" 
                        onChange={handleFileChange} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
                        <div className={`p-4 ${theme.bgPanel} rounded-full group-hover:scale-110 transition-transform`}>
                            <svg className={theme.textMuted} xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </div>
                        <div>
                            <p className={`${theme.textTitle} text-lg font-medium`}>{t.clickUpload}</p>
                            <p className={`${theme.textMuted} text-sm mt-1`}>Supports CSV, TXT exports from Oscilloscopes</p>
                        </div>
                    </div>
                </div>
                {status === AnalysisStatus.ERROR && (
                    <div className="text-red-500 text-center mt-4">Error parsing file. Please check the format.</div>
                )}
            </div>
        )}

        {status === AnalysisStatus.ANALYZING && (
             <div className="flex justify-center py-12">
                 <div className="flex flex-col items-center gap-4">
                    <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme.textMain.replace('text', 'border')}`}></div>
                    <span className={`${theme.textMuted} text-sm animate-pulse`}>{t.analyzing}</span>
                 </div>
             </div>
        )}

        {displayedData && originalData && status === AnalysisStatus.COMPLETED && (
          <div className="space-y-6 animate-fade-in">
            
            <MetadataCard metadata={originalData.metadata} labels={t} theme={theme} />

            {/* Math Tool */}
            <div className={`${theme.bgCard} p-4 rounded-xl border ${theme.border} shadow-sm transition-colors duration-300`}>
                <h3 className={`text-sm font-bold ${theme.textMuted} uppercase tracking-wider mb-4 flex items-center gap-2`}>
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10h12"/><path d="M4 14h12"/><path d="M9 18l6-12"/></svg>
                   {t.dataConversion}
                </h3>
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex flex-col gap-1">
                        <label className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>{t.sourceChannel}</label>
                        <select 
                            value={mathSourceCh}
                            onChange={e => setMathSourceCh(e.target.value)}
                            className={`${theme.bgPanel} ${theme.textMain} text-sm px-3 py-2 rounded border ${theme.border} outline-none min-w-[100px]`}
                        >
                            {originalData.metadata.channels.map(ch => (
                                <option key={ch} value={channelNames[ch] || ch}>{channelNames[ch] || ch}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>{t.factor} (*)</label>
                        <input 
                            type="number" 
                            step="0.001"
                            value={mathFactor}
                            onChange={e => setMathFactor(e.target.value)}
                            className={`${theme.bgPanel} ${theme.textMain} text-sm px-3 py-2 rounded border ${theme.border} outline-none w-24`}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                         <label className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>{t.newUnit}</label>
                         <input 
                            type="text" 
                            value={mathUnit}
                            onChange={e => setMathUnit(e.target.value)}
                            placeholder={originalData.metadata.yUnit}
                            className={`${theme.bgPanel} ${theme.textMain} text-sm px-3 py-2 rounded border ${theme.border} outline-none w-24`}
                        />
                    </div>
                    
                    <button 
                        onClick={handleApplyMath}
                        className={`${theme.button} text-white px-4 py-2 rounded text-sm font-semibold shadow-lg transition-transform active:scale-95`}
                    >
                        {t.applyMath}
                    </button>
                </div>
            </div>

            <PowerAnalysis 
                waveform={displayedData.waveform}
                metadata={displayedData.metadata}
                theme={theme}
                channelNames={channelNames}
                translations={t}
            />

            <DataCharts 
                waveform={displayedData.waveform}
                fftData={displayedData.fftData}
                unit={displayedData.metadata.yUnit}
                channels={displayedData.metadata.channels}
                channelUnits={channelUnits}
                customChannelNames={channelNames}
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
                theme={theme}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`${theme.bgCard} p-5 rounded-xl border ${theme.border} shadow-sm`}>
                 <div className="flex justify-between items-center mb-4">
                     <h3 className={`text-lg font-semibold ${theme.textTitle} flex items-center`}>
                         <span className={`w-1.5 h-6 rounded mr-3 bg-current ${theme.accent}`}></span>
                         {t.channelStats}
                     </h3>
                     <span className={`text-[10px] ${theme.textMuted}`}>{t.renameHint}</span>
                 </div>
                 <div className="grid grid-cols-1 gap-4">
                    {displayedData.stats.map(stat => (
                        visibleChannels.includes(stat.channelId) && (
                            <div key={stat.channelId} className={`${theme.bgPanel} p-4 rounded-lg border ${theme.border}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        {editingChannel === stat.channelId ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="text" 
                                                    value={tempName}
                                                    onChange={(e) => setTempName(e.target.value)}
                                                    onBlur={saveChannelName}
                                                    onKeyDown={(e) => e.key === 'Enter' && saveChannelName()}
                                                    autoFocus
                                                    className={`text-sm font-bold ${theme.textMain} bg-white px-2 py-0.5 rounded border border-blue-400 outline-none w-32 shadow-lg`}
                                                />
                                                <button onClick={saveChannelName} className="text-green-500 hover:text-green-600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => startRenaming(stat.channelId)}>
                                                <span 
                                                    className={`text-sm font-bold ${theme.textMain} uppercase group-hover:underline decoration-dashed decoration-2 underline-offset-4 decoration-${theme.accent.split('-')[1]}-400`}
                                                    title={t.renameHint}
                                                >
                                                    {channelNames[stat.channelId] || `${t.channel} ${stat.channelId}`}
                                                </span>
                                                <svg className={`w-3.5 h-3.5 ${theme.textMuted} opacity-0 group-hover:opacity-100 transition-opacity`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </div>
                                        )}
                                    </div>
                                    <span className={`text-xs ${theme.textMain} px-2 py-0.5 rounded border ${theme.border} bg-black/20`}>
                                        {t.domFreq}: {stat.dominantFrequency.toFixed(2)} Hz
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                                    <div>
                                        <span className={`${theme.textMuted} text-[10px] uppercase block mb-0.5`}>{t.peakMax}</span>
                                        <span className={`font-mono ${theme.textMain}`}>{stat.max.toFixed(3)} {channelUnits[stat.channelId] || displayedData.metadata.yUnit}</span>
                                    </div>
                                    <div>
                                        <span className={`${theme.textMuted} text-[10px] uppercase block mb-0.5`}>{t.peakMin}</span>
                                        <span className={`font-mono ${theme.textMain}`}>{stat.min.toFixed(3)} {channelUnits[stat.channelId] || displayedData.metadata.yUnit}</span>
                                    </div>
                                    <div>
                                        <span className={`${theme.textMuted} text-[10px] uppercase block mb-0.5`}>{t.average}</span>
                                        <span className={`font-mono ${theme.textMain}`}>{stat.average.toFixed(3)} {channelUnits[stat.channelId] || displayedData.metadata.yUnit}</span>
                                    </div>
                                    <div>
                                        <span className={`${theme.textMuted} text-[10px] uppercase block mb-0.5`}>{t.rms}</span>
                                        <span className={`font-mono ${theme.textMain}`}>{stat.rms.toFixed(3)} {channelUnits[stat.channelId] || displayedData.metadata.yUnit}</span>
                                    </div>
                                    <div>
                                        <span className={`${theme.textMuted} text-[10px] uppercase block mb-0.5 text-blue-400 font-bold`}>{t.acRms}</span>
                                        <span className={`font-mono ${theme.textMain}`}>{stat.acRms.toFixed(3)} {channelUnits[stat.channelId] || displayedData.metadata.yUnit}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    ))}
                 </div>
              </div>

              <div className={`${theme.bgCard} p-5 rounded-xl border ${theme.border} shadow-sm flex flex-col`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-lg font-semibold ${theme.textTitle} flex items-center`}>
                        <span className={`w-1.5 h-6 rounded mr-3 bg-red-500`}></span>
                        {t.aiInsight}
                    </h3>
                    <span className={`text-xs ${theme.textMuted} font-medium ${theme.bgApp} px-2 py-1 rounded`}>
                        {isZoomed ? t.currentView : t.full}
                    </span>
                </div>
                
                <div className={`flex-1 ${theme.bgPanel} rounded-lg border ${theme.border} p-4 min-h-[200px] relative`}>
                    {aiAnalysis ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <div className={`whitespace-pre-wrap ${theme.textMain} leading-relaxed`}>{aiAnalysis}</div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 opacity-60">
                            <svg className={`w-12 h-12 ${theme.textMuted} mb-3`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            <p className={`${theme.textMuted} text-sm font-medium mb-1`}>{t.aiPlaceholder}</p>
                            <p className={`${theme.textMuted} text-xs`}>{t.aiHint}</p>
                        </div>
                    )}
                </div>
                
                <button 
                    onClick={handleGeminiAnalysis}
                    disabled={!process.env.API_KEY}
                    className={`mt-4 w-full py-2.5 ${theme.button} disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2`}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    {t.analyzeButton}
                </button>
              </div>
            </div>

          </div>
        )}
      </main>

      <footer className={`w-full py-4 text-center border-t ${theme.border} mt-auto`}>
         <span className={`text-[10px] font-mono ${theme.textMuted} opacity-70`}>
           made by chaizhh@mese-cn.com
         </span>
      </footer>
    </div>
  );
};

export default App;
