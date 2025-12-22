
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';
import { FrequencyDataPoint, WaveformDataPoint, WindowFunctionType, ThemeColors } from '../types';
import { downsampleFFT, downsampleWaveform } from '../utils/mathUtils';

interface DataChartsProps {
  waveform: WaveformDataPoint[];
  fftData: FrequencyDataPoint[];
  unit: string; // Base unit for left axis
  channels: string[];
  channelUnits?: Record<string, string>; // Map of channel ID to unit
  customChannelNames?: Record<string, string>;
  
  fullTimeRange: { start: number, end: number } | null;

  visibleChannels: string[];
  onToggleChannel: (channel: string) => void;
  selectedFftChannel: string | null;
  onFftChannelChange: (channel: string) => void;

  onZoomChange: (startTime: number, endTime: number) => void;
  onResetZoom: () => void;
  isZoomed: boolean;

  fftConfig?: { scope: 'view' | 'full', window: WindowFunctionType };
  onFftConfigChange?: (config: Partial<{ scope: 'view' | 'full', window: WindowFunctionType }>) => void;
  fftMetadata?: { points: number, resolution: number };
  
  theme: ThemeColors;
  translations: {
     timeDomain: string;
     zoomMode: string;
     panMode: string;
     xZoom: string;
     reset: string;
     freqDomain: string;
     channel: string;
     scope: string;
     view: string;
     full: string;
     window: string;
     points: string;
     res: string;
     freqHz: string;
     magnitude: string;
     windowTypes: Record<string, string>;
     cursors: string;
     cursorTime: string;
     cursorAmp: string;
     cursorNone: string;
     cursorSet: string;
  };
}

export const DataCharts: React.FC<DataChartsProps> = ({ 
  waveform, 
  fftData, 
  unit, 
  channels,
  channelUnits = {},
  customChannelNames = {},
  fullTimeRange,
  visibleChannels,
  onToggleChannel,
  selectedFftChannel,
  onFftChannelChange,
  onZoomChange, 
  onResetZoom,
  isZoomed,
  fftConfig,
  onFftConfigChange,
  fftMetadata,
  theme,
  translations
}) => {
  const [refAreaLeft, setRefAreaLeft] = useState<string | number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | number | null>(null);
  const [yDomain, setYDomain] = useState<[number | 'auto', number | 'auto']>(['auto', 'auto']);
  
  const [chartHeight, setChartHeight] = useState<'sm' | 'md' | 'lg' | 'xl'>('lg');
  
  const [interactionMode, setInteractionMode] = useState<'zoom' | 'pan'>('zoom');
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, startTime: number, endTime: number } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Cursors State
  const [cursorMode, setCursorMode] = useState<'none' | 'time' | 'amplitude'>('none');
  const [timeCursors, setTimeCursors] = useState<{t1: number, t2: number, active: 't1' | 't2'}>({ t1: 0, t2: 0, active: 't1' });
  const [ampCursors, setAmpCursors] = useState<{y1: number, y2: number, active: 'y1' | 'y2'}>({ y1: 0, y2: 0, active: 'y1' });

  const displayWaveform = useMemo(() => downsampleWaveform(waveform, 3000), [waveform]);
  const displayFFT = useMemo(() => downsampleFFT(fftData, 2000), [fftData]);

  const currentStartTime = displayWaveform[0]?.time ?? 0;
  const currentEndTime = displayWaveform[displayWaveform.length - 1]?.time ?? 1;

  // Determine if we need a secondary axis
  // We look for any visible channel that has a unit different from the base 'unit' prop
  const secondaryAxisInfo = useMemo(() => {
     const diffChannel = visibleChannels.find(ch => {
        const chUnit = channelUnits[ch];
        return chUnit && chUnit !== unit;
     });
     
     if (diffChannel) {
        return {
           exists: true,
           unit: channelUnits[diffChannel]
        };
     }
     return { exists: false, unit: '' };
  }, [visibleChannels, channelUnits, unit]);

  // Initialize cursors within view when mode changes
  useEffect(() => {
    if (cursorMode === 'time' && timeCursors.t1 === 0 && timeCursors.t2 === 0) {
        const range = currentEndTime - currentStartTime;
        setTimeCursors(prev => ({ ...prev, t1: currentStartTime + range * 0.25, t2: currentStartTime + range * 0.75 }));
    }
    if (cursorMode === 'amplitude' && ampCursors.y1 === 0 && ampCursors.y2 === 0) {
        // Find visible y range roughly
        let min = Infinity, max = -Infinity;
        displayWaveform.forEach(p => {
            visibleChannels.forEach(ch => {
                const val = p[ch];
                if(val < min) min = val;
                if(val > max) max = val;
            });
        });
        if (min !== Infinity) {
            const range = max - min;
            // Handle flat line case
            if (range === 0) {
                 setAmpCursors(prev => ({ ...prev, y1: min - 1, y2: min + 1 }));
            } else {
                 setAmpCursors(prev => ({ ...prev, y1: min + range * 0.25, y2: min + range * 0.75 }));
            }
        }
    }
  }, [cursorMode, currentStartTime, currentEndTime, displayWaveform, visibleChannels]);

  const heightClass = {
    sm: 'h-[40vh]',
    md: 'h-[60vh]',
    lg: 'h-[80vh]',
    xl: 'h-[92vh]'
  }[chartHeight];

  const getChannelColor = (idx: number) => theme.chartColors[idx % theme.chartColors.length];

  const handleMouseDown = (e: any) => {
    // Only process Recharts mousedown if we are NOT in amplitude mode (amplitude mode handled by container click)
    // and if we are not panning via container
    if (interactionMode === 'pan' && cursorMode === 'none') {
       // Handled by container
    } else {
       if (e && e.activeLabel) {
         setRefAreaLeft(e.activeLabel);
       }
    }
  };

  // Dedicated Handler for Time Cursors (using Chart activeLabel)
  const handleChartClick = (e: any) => {
      if (cursorMode === 'time') {
          if (e && e.activeLabel !== undefined) {
              setTimeCursors(prev => ({
                  ...prev,
                  [prev.active]: Number(e.activeLabel)
              }));
          }
      }
      // Amplitude cursor is now handled by handleContainerClick
  };

  // Universal Container Click Handler (Robust Amplitude Setting)
  const handleContainerClick = (e: React.MouseEvent) => {
      // Ignore if dragging
      if (isDragging) return;

      if (cursorMode === 'amplitude' && chartContainerRef.current) {
          const rect = chartContainerRef.current.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const height = rect.height;
          
          // Recharts Margins (Must match margin prop in LineChart below)
          const marginTop = 10;
          const marginBottom = 10;
          
          const drawHeight = height - marginTop - marginBottom;
          if (drawHeight <= 0) return;

          // Determine current Y Domain
          let min = Infinity, max = -Infinity;
          
          if (typeof yDomain[0] === 'number' && typeof yDomain[1] === 'number') {
              min = yDomain[0];
              max = yDomain[1];
          } else {
              // Auto scale logic (must match what Recharts calculates)
              displayWaveform.forEach(p => {
                  visibleChannels.forEach(ch => {
                      // Only consider base unit channels for cursor scaling if on left axis
                      // This is a simplification for cursors
                      if (!channelUnits[ch] || channelUnits[ch] === unit) {
                          const val = p[ch];
                          if (val < min) min = val;
                          if (val > max) max = val;
                      }
                  });
              });
              
              if (min === Infinity) {
                   // Fallback if only math channels visible
                   displayWaveform.forEach(p => {
                      visibleChannels.forEach(ch => {
                          const val = p[ch];
                          if (val < min) min = val;
                          if (val > max) max = val;
                      });
                   });
              }
          }

          if (min === Infinity || max === -Infinity) return;
          
          // Coordinate system: 0 (top) -> Max, drawHeight (bottom) -> Min
          // relativeY from top of drawing area
          let relativeY = y - marginTop;
          // Clamp
          relativeY = Math.max(0, Math.min(drawHeight, relativeY));

          const ratio = relativeY / drawHeight;
          const value = max - ratio * (max - min);

          setAmpCursors(prev => ({
              ...prev,
              [prev.active]: value
          }));
      }
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
      if (cursorMode === 'none' && interactionMode === 'pan') {
          setIsDragging(true);
          dragStartRef.current = {
              x: e.clientX,
              startTime: currentStartTime,
              endTime: currentEndTime
          };
      }
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
      if (isDragging && interactionMode === 'pan' && cursorMode === 'none' && dragStartRef.current && chartContainerRef.current) {
          const deltaPixels = e.clientX - dragStartRef.current.x;
          const chartWidth = chartContainerRef.current.clientWidth; 
          
          const duration = dragStartRef.current.endTime - dragStartRef.current.startTime;
          const timeShift = -(deltaPixels / chartWidth) * duration; 
          
          const newStart = dragStartRef.current.startTime + timeShift;
          const newEnd = dragStartRef.current.endTime + timeShift;
          
          onZoomChange(newStart, newEnd);
      }
  };

  const handleContainerMouseUp = () => {
      if (isDragging) {
          // Slight delay to prevent click triggering immediately after drag
          setTimeout(() => setIsDragging(false), 50);
          dragStartRef.current = null;
      }
  };

  const handleChartMouseMove = (e: any) => {
    if (cursorMode === 'none' && interactionMode === 'zoom' && refAreaLeft && e && e.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleChartMouseUp = () => {
    if (cursorMode === 'none' && interactionMode === 'zoom' && refAreaLeft && refAreaRight) {
      let left = Number(refAreaLeft);
      let right = Number(refAreaRight);
      if (left > right) [left, right] = [right, left];
      if (left !== right) {
          onZoomChange(left, right);
      }
      setRefAreaLeft(null);
      setRefAreaRight(null);
    } else {
        setRefAreaLeft(null);
        setRefAreaRight(null);
    }
  };

  const handleReset = () => {
      setYDomain(['auto', 'auto']);
      onResetZoom();
  };

  const zoomY = (factor: number) => {
      let min = Infinity, max = -Infinity;
      if (typeof yDomain[0] === 'number') min = yDomain[0];
      if (typeof yDomain[1] === 'number') max = yDomain[1];
      
      if (min === Infinity || max === -Infinity) {
          displayWaveform.forEach(p => {
             visibleChannels.forEach(ch => {
                 // Only scale base unit channels for manual zoom currently
                 if (!channelUnits[ch] || channelUnits[ch] === unit) {
                     if (p[ch] < min) min = p[ch];
                     if (p[ch] > max) max = p[ch];
                 }
             });
          });
      }
      if (min === Infinity) return;

      const range = max - min;
      const delta = range * factor;
      setYDomain([min + delta, max - delta]);
  };

  const handleTimeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const newVal = parseFloat(e.target.value);
     const duration = currentEndTime - currentStartTime;
     onZoomChange(newVal, newVal + duration);
  };

  const handleScaleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const mid = (currentStartTime + currentEndTime) / 2;
      const fullDuration = fullTimeRange ? (fullTimeRange.end - fullTimeRange.start) : (currentEndTime - currentStartTime);
      
      const percent = parseFloat(e.target.value); 
      const fraction = Math.max(0.001, percent / 100);
      const newDuration = fullDuration * fraction;
      
      onZoomChange(mid - newDuration / 2, mid + newDuration / 2);
  };

  const currentScaleValue = fullTimeRange 
    ? (((currentEndTime - currentStartTime) / (fullTimeRange.end - fullTimeRange.start)) * 100) 
    : 100;

  return (
    <div className="flex flex-col gap-6 mb-8 w-full">
      
      <div className={`${theme.bgCard} p-4 rounded-xl border ${theme.border} shadow-xl flex flex-col w-full transition-colors duration-300`}>
        <div className={`flex flex-col lg:flex-row justify-between lg:items-center mb-4 gap-4 border-b ${theme.border} pb-4`}>
          
          <div className="flex flex-wrap items-center gap-4">
             <h3 className={`text-lg font-semibold ${theme.textTitle} flex items-center whitespace-nowrap`}>
               <span className={`w-1.5 h-6 rounded mr-3 bg-current ${theme.accent}`}></span>
               {translations.timeDomain}
             </h3>

             <div className={`flex ${theme.bgApp} rounded-lg border ${theme.border} p-1 ml-2`}>
                 <button 
                    onClick={() => { setInteractionMode('zoom'); setCursorMode('none'); }}
                    className={`p-1.5 rounded transition-colors ${interactionMode === 'zoom' && cursorMode === 'none' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}
                    title={translations.zoomMode}
                 >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                 </button>
                 <button 
                    onClick={() => { setInteractionMode('pan'); setCursorMode('none'); }}
                    className={`p-1.5 rounded transition-colors ${interactionMode === 'pan' && cursorMode === 'none' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}
                    title={translations.panMode}
                 >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
                 </button>
             </div>
             
             <div className="flex flex-wrap gap-2 items-center ml-2">
                {channels.map((ch, idx) => (
                    <button 
                        key={ch} 
                        onClick={() => onToggleChannel(ch)}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
                            visibleChannels.includes(ch) 
                            ? `${theme.bgPanel} ${theme.border} ${theme.textMain}` 
                            : `${theme.bgApp} border-transparent ${theme.textMuted} opacity-60`
                        }`}
                        style={{ borderColor: visibleChannels.includes(ch) ? undefined : 'transparent' }}
                    >
                        <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: visibleChannels.includes(ch) ? getChannelColor(idx) : '#475569' }}
                        ></span>
                        {customChannelNames[ch] || ch}
                        {channelUnits[ch] && channelUnits[ch] !== unit && (
                            <span className="text-[9px] opacity-70 ml-0.5">({channelUnits[ch]})</span>
                        )}
                    </button>
                ))}
             </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            
            <div className={`flex items-center ${theme.bgPanel} rounded border ${theme.border} overflow-hidden mr-2`}>
                <button onClick={() => setChartHeight('sm')} className={`px-2 py-1.5 text-[10px] font-medium border-r ${theme.border} ${chartHeight === 'sm' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}>S</button>
                <button onClick={() => setChartHeight('md')} className={`px-2 py-1.5 text-[10px] font-medium border-r ${theme.border} ${chartHeight === 'md' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}>M</button>
                <button onClick={() => setChartHeight('lg')} className={`px-2 py-1.5 text-[10px] font-medium border-r ${theme.border} ${chartHeight === 'lg' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}>L</button>
                <button onClick={() => setChartHeight('xl')} className={`px-2 py-1.5 text-[10px] font-medium ${chartHeight === 'xl' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}>XL</button>
            </div>

            <div className={`flex items-center ${theme.bgPanel} rounded border ${theme.border} overflow-hidden`}>
                <div className={`px-2 py-1 text-[10px] ${theme.textMuted} font-bold border-r ${theme.border}`}>Y</div>
                <button onClick={() => zoomY(0.2)} className={`p-1.5 hover:${theme.bgCard} ${theme.textMuted} hover:${theme.textMain} transition-colors`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                <button onClick={() => zoomY(-0.2)} className={`p-1.5 hover:${theme.bgCard} ${theme.textMuted} hover:${theme.textMain} transition-colors border-l ${theme.border}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                <button onClick={() => setYDomain(['auto', 'auto'])} className={`px-2 py-1.5 text-[10px] font-medium hover:${theme.bgCard} ${theme.textMuted} hover:${theme.textMain} border-l ${theme.border} transition-colors`}>AUTO</button>
            </div>

            <div className={`flex items-center gap-2 ${theme.bgPanel} px-3 py-1 rounded border ${theme.border}`}>
                <span className={`text-[10px] ${theme.textMuted} font-bold`}>{translations.xZoom}</span>
                <input 
                    type="range" 
                    min="0.1" 
                    max="100" 
                    step="0.1"
                    value={currentScaleValue}
                    onChange={handleScaleSliderChange}
                    className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    title="Scale Time Axis"
                />
            </div>

            {(isZoomed || yDomain[0] !== 'auto') && (
                <button onClick={handleReset} className={`px-3 py-1.5 text-xs font-bold ${theme.button} text-white rounded shadow transition-all ml-2`}>
                    {translations.reset}
                </button>
            )}
          </div>
        </div>
        
        {/* Cursor Toolbar */}
        <div className={`flex items-center gap-4 mb-3 pb-3 border-b ${theme.border}`}>
            <span className={`text-xs font-bold ${theme.textMuted} uppercase`}>{translations.cursors}:</span>
            <div className={`flex ${theme.bgApp} rounded-lg border ${theme.border} p-0.5`}>
                <button 
                    onClick={() => setCursorMode('none')}
                    className={`px-3 py-1 text-xs font-bold rounded ${cursorMode === 'none' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}
                >
                    {translations.cursorNone}
                </button>
                <button 
                    onClick={() => setCursorMode('time')}
                    className={`px-3 py-1 text-xs font-bold rounded ${cursorMode === 'time' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}
                >
                    {translations.cursorTime}
                </button>
                <button 
                    onClick={() => setCursorMode('amplitude')}
                    className={`px-3 py-1 text-xs font-bold rounded ${cursorMode === 'amplitude' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}
                >
                    {translations.cursorAmp}
                </button>
            </div>
            
            {cursorMode !== 'none' && (
                <div className="flex items-center gap-3 animate-fade-in">
                    <span className={`text-[10px] ${theme.textMuted} uppercase font-bold mr-1`}>{translations.cursorSet}:</span>
                    <div className="flex gap-1">
                        <button 
                            onClick={() => cursorMode === 'time' ? setTimeCursors(p => ({...p, active: 't1'})) : setAmpCursors(p => ({...p, active: 'y1'}))}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${
                                (cursorMode === 'time' ? timeCursors.active === 't1' : ampCursors.active === 'y1') 
                                ? `${theme.bgPanel} ${theme.textMain} border-current` 
                                : `${theme.bgApp} ${theme.textMuted} border-transparent`
                            }`}
                        >
                            {cursorMode === 'time' ? 'T1' : 'Y1'}
                        </button>
                        <button 
                             onClick={() => cursorMode === 'time' ? setTimeCursors(p => ({...p, active: 't2'})) : setAmpCursors(p => ({...p, active: 'y2'}))}
                             className={`px-2 py-1 text-xs rounded border transition-colors ${
                                (cursorMode === 'time' ? timeCursors.active === 't2' : ampCursors.active === 'y2') 
                                ? `${theme.bgPanel} ${theme.textMain} border-current` 
                                : `${theme.bgApp} ${theme.textMuted} border-transparent`
                            }`}
                        >
                            {cursorMode === 'time' ? 'T2' : 'Y2'}
                        </button>
                    </div>

                    <div className={`ml-4 flex gap-4 text-xs font-mono ${theme.textMain}`}>
                        {cursorMode === 'time' ? (
                            <>
                                <span>ΔT: {Math.abs(timeCursors.t2 - timeCursors.t1).toFixed(6)} s</span>
                                <span>1/ΔT: {Math.abs(timeCursors.t2 - timeCursors.t1) > 0 ? (1 / Math.abs(timeCursors.t2 - timeCursors.t1)).toFixed(2) : 'Inf'} Hz</span>
                            </>
                        ) : (
                            <>
                                <span>Y1: {ampCursors.y1.toFixed(3)}</span>
                                <span>Y2: {ampCursors.y2.toFixed(3)}</span>
                                <span>ΔY: {Math.abs(ampCursors.y2 - ampCursors.y1).toFixed(3)}</span>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>

        <div 
            className={`${heightClass} w-full relative select-none ${theme.bgPanel} rounded-lg border ${theme.border} overflow-hidden ${interactionMode === 'pan' && cursorMode === 'none' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : (cursorMode !== 'none' ? 'cursor-crosshair' : 'cursor-crosshair')} transition-all duration-300 ease-in-out`}
            ref={chartContainerRef}
            onClick={handleContainerClick}
            onMouseDown={handleContainerMouseDown}
            onMouseMove={handleContainerMouseMove}
            onMouseUp={handleContainerMouseUp}
            onMouseLeave={handleContainerMouseUp}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={displayWaveform}
              onMouseDown={handleMouseDown}
              onClick={handleChartClick}
              onMouseMove={handleChartMouseMove}
              onMouseUp={handleChartMouseUp}
              margin={{ top: 10, right: secondaryAxisInfo.exists ? 40 : 30, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#64748b" strokeOpacity={0.2} vertical={true} />
              <XAxis 
                dataKey="time" 
                type="number"
                allowDataOverflow
                domain={['dataMin', 'dataMax']}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(val) => val.toFixed(4)}
                axisLine={{ stroke: '#475569', opacity: 0.5 }}
                tickLine={{ stroke: '#475569', opacity: 0.5 }}
              />
              {/* Primary Y Axis (Left) */}
              <YAxis 
                yAxisId="left"
                domain={yDomain}
                allowDataOverflow={true}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(val) => Number(val).toFixed(2)}
                axisLine={{ stroke: '#475569', opacity: 0.5 }}
                tickLine={{ stroke: '#475569', opacity: 0.5 }}
                label={{ value: unit, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                width={50}
              />
              
              {/* Secondary Y Axis (Right) - Only if mixed units exist */}
              {secondaryAxisInfo.exists && (
                 <YAxis 
                    yAxisId="right"
                    orientation="right"
                    domain={['auto', 'auto']} // Auto-scale secondary axis for now
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={(val) => Number(val).toFixed(2)}
                    axisLine={{ stroke: '#475569', opacity: 0.5 }}
                    tickLine={{ stroke: '#475569', opacity: 0.5 }}
                    label={{ value: secondaryAxisInfo.unit, angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 12 }}
                    width={50}
                  />
              )}

              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                labelFormatter={(label) => `Time: ${Number(label).toFixed(6)}s`}
                formatter={(value: number, name: string) => {
                    const chUnit = channelUnits[name] || unit;
                    return [`${value.toFixed(4)} ${chUnit}`, (customChannelNames[name] || name).toUpperCase()];
                }}
                animationDuration={0}
              />
              {channels.map((ch, idx) => {
                 if (!visibleChannels.includes(ch)) return null;
                 const isSecondary = channelUnits[ch] && channelUnits[ch] !== unit;
                 
                 return (
                  <Line 
                    key={ch}
                    yAxisId={isSecondary ? "right" : "left"}
                    type="monotone" 
                    dataKey={ch} 
                    stroke={getChannelColor(idx)} 
                    strokeWidth={1.5} 
                    dot={false} 
                    isAnimationActive={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                 );
              })}
              
              {cursorMode === 'time' && (
                  <>
                    <ReferenceLine yAxisId="left" x={timeCursors.t1} stroke={theme.textTitle} strokeDasharray="3 3" label={{ value: 'T1', position: 'insideTopLeft', fill: theme.textTitle, fontSize: 10 }} />
                    <ReferenceLine yAxisId="left" x={timeCursors.t2} stroke={theme.textTitle} strokeDasharray="3 3" label={{ value: 'T2', position: 'insideTopRight', fill: theme.textTitle, fontSize: 10 }} />
                    <ReferenceArea yAxisId="left" x1={timeCursors.t1} x2={timeCursors.t2} fill={theme.accent.split('-')[1] === 'white' ? '#fff' : theme.textMuted} fillOpacity={0.05} />
                  </>
              )}

              {cursorMode === 'amplitude' && (
                  <>
                    <ReferenceLine yAxisId="left" y={ampCursors.y1} stroke={theme.textTitle} strokeDasharray="3 3" label={{ value: 'Y1', position: 'insideRight', fill: theme.textTitle, fontSize: 10 }} />
                    <ReferenceLine yAxisId="left" y={ampCursors.y2} stroke={theme.textTitle} strokeDasharray="3 3" label={{ value: 'Y2', position: 'insideRight', fill: theme.textTitle, fontSize: 10 }} />
                    <ReferenceArea yAxisId="left" y1={ampCursors.y1} y2={ampCursors.y2} fill={theme.accent.split('-')[1] === 'white' ? '#fff' : theme.textMuted} fillOpacity={0.05} />
                  </>
              )}
              
              {refAreaLeft && refAreaRight && (
                <ReferenceArea 
                  yAxisId="left"
                  x1={refAreaLeft} 
                  x2={refAreaRight} 
                  strokeOpacity={0.3} 
                  fill={theme.chartColors[0]} 
                  fillOpacity={0.15} 
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {fullTimeRange && (
            <div className="mt-2 flex items-center gap-3 px-2">
                <span className={`text-[10px] ${theme.textMuted} font-mono`}>{fullTimeRange.start.toFixed(3)}s</span>
                <div className={`relative flex-1 h-4 ${theme.bgApp} rounded-full overflow-hidden border ${theme.border}`}>
                    <input
                        type="range"
                        min={fullTimeRange.start}
                        max={fullTimeRange.end - (currentEndTime - currentStartTime)}
                        step={(fullTimeRange.end - fullTimeRange.start) / 1000}
                        value={currentStartTime}
                        onChange={handleTimeSliderChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                        title="Scrub Time"
                    />
                    <div 
                        className={`absolute top-0 h-full opacity-30 border-r border-white/20 pointer-events-none transition-all duration-75`}
                        style={{
                            backgroundColor: theme.chartColors[0],
                            left: `${((currentStartTime - fullTimeRange.start) / (fullTimeRange.end - fullTimeRange.start)) * 100}%`,
                            width: `${((currentEndTime - currentStartTime) / (fullTimeRange.end - fullTimeRange.start)) * 100}%`
                        }}
                    ></div>
                </div>
                <span className={`text-[10px] ${theme.textMuted} font-mono`}>{fullTimeRange.end.toFixed(3)}s</span>
            </div>
        )}
      </div>

      <div className={`${theme.bgCard} p-4 rounded-xl border ${theme.border} shadow-sm flex flex-col w-full transition-colors duration-300`}>
        <div className={`flex flex-col lg:flex-row justify-between lg:items-center mb-4 gap-4 border-b ${theme.border} pb-4`}>
          <div className="flex flex-wrap items-center gap-4">
            <h3 className={`text-lg font-semibold ${theme.textTitle} flex items-center whitespace-nowrap`}>
                <span className={`w-1.5 h-6 rounded mr-3 bg-current ${theme.accent}`}></span>
                {translations.freqDomain}
            </h3>
            
            <div className="flex items-center gap-3 ml-2">
                <label className={`text-xs ${theme.textMuted} font-medium uppercase tracking-wider`}>{translations.channel}:</label>
                <div className={`flex ${theme.bgApp} rounded-lg p-1 border ${theme.border}`}>
                    {channels.map((ch) => (
                        <button
                            key={ch}
                            onClick={() => onFftChannelChange(ch)}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                selectedFftChannel === ch 
                                ? `${theme.bgPanel} ${theme.textMain} shadow-sm ring-1 ring-inset ring-slate-600` 
                                : `${theme.textMuted} hover:${theme.textMain}`
                            }`}
                        >
                            {(customChannelNames[ch] || ch).toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
          </div>

          {/* FFT Controls */}
          <div className="flex flex-wrap items-center gap-3">
              {/* Scope Selector */}
              <div className={`flex items-center ${theme.bgPanel} rounded border ${theme.border} overflow-hidden`}>
                  <span className={`px-2 py-1 text-[10px] ${theme.textMuted} font-bold border-r ${theme.border}`}>{translations.scope}</span>
                  <button 
                    onClick={() => onFftConfigChange?.({ scope: 'view' })}
                    className={`px-3 py-1 text-[10px] font-medium border-r ${theme.border} ${fftConfig?.scope === 'view' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}
                  >
                    {translations.view}
                  </button>
                  <button 
                    onClick={() => onFftConfigChange?.({ scope: 'full' })}
                    className={`px-3 py-1 text-[10px] font-medium ${fftConfig?.scope === 'full' ? `${theme.button} text-white` : `${theme.textMuted} hover:${theme.textMain}`}`}
                  >
                    {translations.full}
                  </button>
              </div>

              {/* Window Selector */}
              <div className={`flex items-center ${theme.bgPanel} rounded border ${theme.border} overflow-hidden`}>
                  <span className={`px-2 py-1 text-[10px] ${theme.textMuted} font-bold border-r ${theme.border}`}>{translations.window}</span>
                  <select 
                    value={fftConfig?.window}
                    onChange={(e) => onFftConfigChange?.({ window: e.target.value as WindowFunctionType })}
                    className={`bg-transparent text-[10px] font-medium ${theme.textMain} px-2 py-1 outline-none cursor-pointer hover:text-white`}
                  >
                      <option value="rectangular">{translations.windowTypes.rectangular}</option>
                      <option value="hanning">{translations.windowTypes.hanning}</option>
                      <option value="hamming">{translations.windowTypes.hamming}</option>
                      <option value="blackman">{translations.windowTypes.blackman}</option>
                  </select>
              </div>
          </div>
        </div>
        
        <div className={`h-[350px] w-full ${theme.bgPanel} rounded-lg border ${theme.border} relative`}>
          {/* FFT Info Overlay */}
          {fftMetadata && (
             <div className="absolute top-2 right-2 z-10 flex gap-2">
                 <span className={`text-[10px] ${theme.textMuted} bg-black/50 px-2 py-1 rounded border ${theme.border}`}>
                     {translations.points}: <span className={`${theme.textMain} font-mono`}>{fftMetadata.points}</span>
                 </span>
                 <span className={`text-[10px] ${theme.textMuted} bg-black/50 px-2 py-1 rounded border ${theme.border}`}>
                     {translations.res}: <span className={`${theme.textMain} font-mono`}>{fftMetadata.resolution.toFixed(2)} Hz</span>
                 </span>
             </div>
          )}

          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayFFT} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#64748b" strokeOpacity={0.2} vertical={true} />
              <XAxis 
                dataKey="frequency" 
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : Math.round(val).toString()}
                axisLine={{ stroke: '#475569', opacity: 0.5 }}
                tickLine={{ stroke: '#475569', opacity: 0.5 }}
                label={{ value: translations.freqHz, position: 'insideBottomRight', offset: -5, fill: '#94a3b8', fontSize: 12 }}
              />
              <YAxis 
                 tick={{ fill: '#94a3b8', fontSize: 11 }}
                 axisLine={{ stroke: '#475569', opacity: 0.5 }}
                 tickLine={{ stroke: '#475569', opacity: 0.5 }}
                 label={{ value: `${translations.magnitude} (${unit})`, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                 width={50}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px', backdropFilter: 'blur(4px)' }}
                labelFormatter={(label) => `Freq: ${Number(label).toFixed(1)}Hz`}
                formatter={(value: number, name: string) => [value.toFixed(4), (customChannelNames[name] || name).toUpperCase()]}
              />
              {selectedFftChannel && (
                  <Area 
                    type="monotone" 
                    dataKey={selectedFftChannel} 
                    stroke={getChannelColor(channels.indexOf(selectedFftChannel))} 
                    fill={getChannelColor(channels.indexOf(selectedFftChannel))} 
                    fillOpacity={0.2} 
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
