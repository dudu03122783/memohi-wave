
import React, { useMemo, useState, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  AreaChart,
  Area
} from 'recharts';
import { FrequencyDataPoint, WaveformDataPoint, WindowFunctionType } from '../types';
import { downsampleFFT, downsampleWaveform } from '../utils/mathUtils';

interface DataChartsProps {
  waveform: WaveformDataPoint[];
  fftData: FrequencyDataPoint[];
  unit: string;
  channels: string[];
  
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
  };
}

const CHANNEL_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#f43f5e", // Rose
];

export const DataCharts: React.FC<DataChartsProps> = ({ 
  waveform, 
  fftData, 
  unit, 
  channels,
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
  translations
}) => {
  const [refAreaLeft, setRefAreaLeft] = useState<string | number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | number | null>(null);
  const [yDomain, setYDomain] = useState<[number | 'auto', number | 'auto']>(['auto', 'auto']);
  
  const [chartHeight, setChartHeight] = useState<'sm' | 'md' | 'lg'>('md');
  
  const [interactionMode, setInteractionMode] = useState<'zoom' | 'pan'>('zoom');
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, startTime: number, endTime: number } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const displayWaveform = useMemo(() => downsampleWaveform(waveform, 3000), [waveform]);
  const displayFFT = useMemo(() => downsampleFFT(fftData, 2000), [fftData]);

  const currentStartTime = displayWaveform[0]?.time ?? 0;
  const currentEndTime = displayWaveform[displayWaveform.length - 1]?.time ?? 1;

  const heightClass = {
    sm: 'h-[40vh]',
    md: 'h-[60vh]',
    lg: 'h-[80vh]'
  }[chartHeight];

  const handleMouseDown = (e: any) => {
    if (interactionMode === 'pan') {
       if (chartContainerRef.current) {
           setIsDragging(true);
           dragStartRef.current = {
               x: e.chartX ?? 0, 
               startTime: currentStartTime,
               endTime: currentEndTime
           };
       }
    } else {
       if (e && e.activeLabel) {
         setRefAreaLeft(e.activeLabel);
       }
    }
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
      if (interactionMode === 'pan') {
          setIsDragging(true);
          dragStartRef.current = {
              x: e.clientX,
              startTime: currentStartTime,
              endTime: currentEndTime
          };
      }
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
      if (isDragging && interactionMode === 'pan' && dragStartRef.current && chartContainerRef.current) {
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
          setIsDragging(false);
          dragStartRef.current = null;
      }
  };

  const handleChartMouseMove = (e: any) => {
    if (interactionMode === 'zoom' && refAreaLeft && e && e.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleChartMouseUp = () => {
    if (interactionMode === 'zoom' && refAreaLeft && refAreaRight) {
      let left = Number(refAreaLeft);
      let right = Number(refAreaRight);
      if (left > right) [left, right] = [right, left];
      if (left !== right) {
          onZoomChange(left, right);
      }
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
                 if (p[ch] < min) min = p[ch];
                 if (p[ch] > max) max = p[ch];
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
      
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-xl flex flex-col w-full">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center mb-4 gap-4 border-b border-slate-700 pb-4">
          
          <div className="flex flex-wrap items-center gap-4">
             <h3 className="text-lg font-semibold text-slate-100 flex items-center whitespace-nowrap">
               <span className="w-1.5 h-6 bg-blue-500 rounded mr-3"></span>
               {translations.timeDomain}
             </h3>

             <div className="flex bg-slate-900 rounded-lg border border-slate-700 p-1 ml-2">
                 <button 
                    onClick={() => setInteractionMode('zoom')}
                    className={`p-1.5 rounded transition-colors ${interactionMode === 'zoom' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    title={translations.zoomMode}
                 >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                 </button>
                 <button 
                    onClick={() => setInteractionMode('pan')}
                    className={`p-1.5 rounded transition-colors ${interactionMode === 'pan' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
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
                            ? 'bg-slate-700 border-slate-600 text-slate-200' 
                            : 'bg-slate-800/50 border-slate-700 text-slate-600 opacity-60'
                        }`}
                    >
                        <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: visibleChannels.includes(ch) ? CHANNEL_COLORS[idx % CHANNEL_COLORS.length] : '#475569' }}
                        ></span>
                        {ch}
                    </button>
                ))}
             </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            
            <div className="flex items-center bg-slate-900/50 rounded border border-slate-700 overflow-hidden mr-2">
                <button onClick={() => setChartHeight('sm')} className={`px-2 py-1.5 text-[10px] font-medium border-r border-slate-700 ${chartHeight === 'sm' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>S</button>
                <button onClick={() => setChartHeight('md')} className={`px-2 py-1.5 text-[10px] font-medium border-r border-slate-700 ${chartHeight === 'md' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>M</button>
                <button onClick={() => setChartHeight('lg')} className={`px-2 py-1.5 text-[10px] font-medium ${chartHeight === 'lg' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>L</button>
            </div>

            <div className="flex items-center bg-slate-900/50 rounded border border-slate-700 overflow-hidden">
                <div className="px-2 py-1 text-[10px] text-slate-500 font-bold border-r border-slate-700">Y</div>
                <button onClick={() => zoomY(0.2)} className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                <button onClick={() => zoomY(-0.2)} className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border-l border-slate-700"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                <button onClick={() => setYDomain(['auto', 'auto'])} className="px-2 py-1.5 text-[10px] font-medium hover:bg-slate-700 text-slate-400 hover:text-white border-l border-slate-700 transition-colors">AUTO</button>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1 rounded border border-slate-700">
                <span className="text-[10px] text-slate-500 font-bold">{translations.xZoom}</span>
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
                <button onClick={handleReset} className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded shadow transition-all ml-2">
                    {translations.reset}
                </button>
            )}
          </div>
        </div>
        
        <div 
            className={`${heightClass} w-full relative select-none bg-slate-900/30 rounded-lg border border-slate-700/30 overflow-hidden ${interactionMode === 'pan' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'} transition-all duration-300 ease-in-out`}
            ref={chartContainerRef}
            onMouseDown={handleContainerMouseDown}
            onMouseMove={handleContainerMouseMove}
            onMouseUp={handleContainerMouseUp}
            onMouseLeave={handleContainerMouseUp}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={displayWaveform}
              onMouseDown={handleMouseDown}
              onMouseMove={handleChartMouseMove}
              onMouseUp={handleChartMouseUp}
              margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#64748b" strokeOpacity={0.4} vertical={true} />
              <XAxis 
                dataKey="time" 
                type="number"
                allowDataOverflow
                domain={['dataMin', 'dataMax']}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(val) => val.toFixed(4)}
                axisLine={{ stroke: '#475569' }}
                tickLine={{ stroke: '#475569' }}
              />
              <YAxis 
                domain={yDomain}
                allowDataOverflow={true}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#475569' }}
                tickLine={{ stroke: '#475569' }}
                label={{ value: unit, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                width={50}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                labelFormatter={(label) => `Time: ${Number(label).toFixed(6)}s`}
                formatter={(value: number, name: string) => [value.toFixed(4), `${name.toUpperCase()} (${unit})`]}
                animationDuration={0}
              />
              {channels.map((ch, idx) => (
                 visibleChannels.includes(ch) && (
                  <Line 
                    key={ch}
                    type="monotone" 
                    dataKey={ch} 
                    stroke={CHANNEL_COLORS[idx % CHANNEL_COLORS.length]} 
                    strokeWidth={1.5} 
                    dot={false} 
                    isAnimationActive={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                 )
              ))}
              
              {refAreaLeft && refAreaRight && (
                <ReferenceArea 
                  x1={refAreaLeft} 
                  x2={refAreaRight} 
                  strokeOpacity={0.3} 
                  fill="#3b82f6" 
                  fillOpacity={0.15} 
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {fullTimeRange && (
            <div className="mt-2 flex items-center gap-3 px-2">
                <span className="text-[10px] text-slate-500 font-mono">{fullTimeRange.start.toFixed(3)}s</span>
                <div className="relative flex-1 h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
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
                        className="absolute top-0 h-full bg-blue-600/30 border border-blue-500/50 rounded-full pointer-events-none transition-all duration-75"
                        style={{
                            left: `${((currentStartTime - fullTimeRange.start) / (fullTimeRange.end - fullTimeRange.start)) * 100}%`,
                            width: `${((currentEndTime - currentStartTime) / (fullTimeRange.end - fullTimeRange.start)) * 100}%`
                        }}
                    ></div>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">{fullTimeRange.end.toFixed(3)}s</span>
            </div>
        )}
      </div>

      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col w-full">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center mb-4 gap-4 border-b border-slate-700 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <h3 className="text-lg font-semibold text-slate-100 flex items-center whitespace-nowrap">
                <span className="w-1.5 h-6 bg-purple-500 rounded mr-3"></span>
                {translations.freqDomain}
            </h3>
            
            <div className="flex items-center gap-3 ml-2">
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">{translations.channel}:</label>
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                    {channels.map((ch) => (
                        <button
                            key={ch}
                            onClick={() => onFftChannelChange(ch)}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                selectedFftChannel === ch 
                                ? 'bg-slate-700 text-white shadow-sm' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {ch.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
          </div>

          {/* FFT Controls */}
          <div className="flex flex-wrap items-center gap-3">
              {/* Scope Selector */}
              <div className="flex items-center bg-slate-900/50 rounded border border-slate-700 overflow-hidden">
                  <span className="px-2 py-1 text-[10px] text-slate-500 font-bold border-r border-slate-700">{translations.scope}</span>
                  <button 
                    onClick={() => onFftConfigChange?.({ scope: 'view' })}
                    className={`px-3 py-1 text-[10px] font-medium border-r border-slate-700 ${fftConfig?.scope === 'view' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    {translations.view}
                  </button>
                  <button 
                    onClick={() => onFftConfigChange?.({ scope: 'full' })}
                    className={`px-3 py-1 text-[10px] font-medium ${fftConfig?.scope === 'full' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    {translations.full}
                  </button>
              </div>

              {/* Window Selector */}
              <div className="flex items-center bg-slate-900/50 rounded border border-slate-700 overflow-hidden">
                  <span className="px-2 py-1 text-[10px] text-slate-500 font-bold border-r border-slate-700">{translations.window}</span>
                  <select 
                    value={fftConfig?.window}
                    onChange={(e) => onFftConfigChange?.({ window: e.target.value as WindowFunctionType })}
                    className="bg-transparent text-[10px] font-medium text-slate-300 px-2 py-1 outline-none cursor-pointer hover:text-white"
                  >
                      <option value="rectangular">{translations.windowTypes.rectangular}</option>
                      <option value="hanning">{translations.windowTypes.hanning}</option>
                      <option value="hamming">{translations.windowTypes.hamming}</option>
                      <option value="blackman">{translations.windowTypes.blackman}</option>
                  </select>
              </div>
          </div>
        </div>
        
        <div className="h-[350px] w-full bg-slate-900/30 rounded-lg border border-slate-700/30 relative">
          {/* FFT Info Overlay */}
          {fftMetadata && (
             <div className="absolute top-2 right-2 z-10 flex gap-2">
                 <span className="text-[10px] text-slate-500 bg-slate-900/80 px-2 py-1 rounded border border-slate-700/50">
                     {translations.points}: <span className="text-slate-300 font-mono">{fftMetadata.points}</span>
                 </span>
                 <span className="text-[10px] text-slate-500 bg-slate-900/80 px-2 py-1 rounded border border-slate-700/50">
                     {translations.res}: <span className="text-slate-300 font-mono">{fftMetadata.resolution.toFixed(2)} Hz</span>
                 </span>
             </div>
          )}

          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayFFT} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#64748b" strokeOpacity={0.3} vertical={true} />
              <XAxis 
                dataKey="frequency" 
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : Math.round(val).toString()}
                axisLine={{ stroke: '#475569' }}
                tickLine={{ stroke: '#475569' }}
                label={{ value: translations.freqHz, position: 'insideBottomRight', offset: -5, fill: '#94a3b8', fontSize: 12 }}
              />
              <YAxis 
                 tick={{ fill: '#94a3b8', fontSize: 11 }}
                 axisLine={{ stroke: '#475569' }}
                 tickLine={{ stroke: '#475569' }}
                 label={{ value: translations.magnitude, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                 width={50}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px', backdropFilter: 'blur(4px)' }}
                labelFormatter={(label) => `Freq: ${Number(label).toFixed(1)}Hz`}
                formatter={(value: number, name: string) => [value.toFixed(4), name.toUpperCase()]}
              />
              {selectedFftChannel && (
                  <Area 
                    type="monotone" 
                    dataKey={selectedFftChannel} 
                    stroke={CHANNEL_COLORS[channels.indexOf(selectedFftChannel) % CHANNEL_COLORS.length]} 
                    fill={CHANNEL_COLORS[channels.indexOf(selectedFftChannel) % CHANNEL_COLORS.length]} 
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
