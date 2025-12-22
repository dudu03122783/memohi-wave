
import React, { useState, useMemo, useEffect } from 'react';
import { WaveformDataPoint, SignalMetadata, ThemeColors, PowerAnalysisResult } from '../types';
import { calculatePowerQuality } from '../utils/mathUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface PowerAnalysisProps {
    waveform: WaveformDataPoint[];
    metadata: SignalMetadata;
    theme: ThemeColors;
    channelNames: Record<string, string>;
    translations: any;
}

export const PowerAnalysis: React.FC<PowerAnalysisProps> = ({ waveform, metadata, theme, channelNames, translations }) => {
    const [chU, setChU] = useState<string>('');
    const [chV, setChV] = useState<string>('');
    const [result, setResult] = useState<PowerAnalysisResult | null>(null);
    const [harmonicMode, setHarmonicMode] = useState<'percent' | 'magnitude'>('percent');
    const [selectedHarmonicPhase, setSelectedHarmonicPhase] = useState<number>(0); // 0=U, 1=V, 2=W

    // Initialize defaults if available
    useEffect(() => {
        if (metadata.channels.length >= 2) {
            if(!chU) setChU(metadata.channels[0]);
            if(!chV) setChV(metadata.channels[1]);
        }
    }, [metadata.channels]);

    const handleAnalyze = () => {
        if (!chU || !chV || waveform.length === 0) return;
        const res = calculatePowerQuality(waveform, metadata.samplingRateHz, chU, chV);
        setResult(res);
    };

    // Phasor Diagram SVG
    const renderPhasor = (res: PowerAnalysisResult) => {
        const size = 320; // Slightly larger for better labels
        const center = size / 2;
        const radius = size * 0.35; 
        
        const maxRms = Math.max(...res.phases.map(p => p.rms));
        // Avoid division by zero
        const displayMax = maxRms > 0 ? maxRms : 1; 
        
        const gridValues = [0.33, 0.66, 1.0]; // Percentages
        
        // Helper to convert theme bg classes to text classes for SVG currentColor usage
        // e.g. "bg-[#fff]" -> "text-[#fff]" or "bg-white" -> "text-white"
        const cardBgTextClass = theme.bgCard.replace('bg-', 'text-');
        const borderTextClass = theme.border.replace('border-', 'text-');

        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto select-none">
                {/* Background Grid System */}
                <g className={theme.textMuted}>
                    {/* Crosshair Axes */}
                    <line x1={center} y1="20" x2={center} y2={size-20} stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.2" />
                    <line x1="20" y1={center} x2={size-20} y2={center} stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.2" />

                    {/* Concentric Circles with Values */}
                    {gridValues.map((pct, i) => {
                        const r = radius * pct;
                        const val = displayMax * pct;
                        return (
                            <g key={pct}>
                                 {/* Circle */}
                                 <circle 
                                    cx={center} 
                                    cy={center} 
                                    r={r} 
                                    stroke="currentColor" 
                                    strokeWidth="1" 
                                    strokeDasharray="4 4" 
                                    fill="none" 
                                    opacity="0.3" 
                                 />
                                 {/* Label - Placed slightly offset from the Y-axis to avoid overlap */}
                                 <text 
                                    x={center + 4} 
                                    y={center - r - 2} 
                                    fontSize="9" 
                                    fill="currentColor" 
                                    opacity="0.6"
                                    className="font-mono"
                                 >
                                    {val.toFixed(1)}
                                 </text>
                            </g>
                        );
                    })}
                </g>

                {/* Vectors */}
                {res.phases.map((p, idx) => {
                    const normalizedLen = displayMax > 0 ? (p.rms / displayMax) * radius : 0;
                    
                    // Coordinates calculation (Standard math polar: 0 is Right. SVG Y is down)
                    // y = center - sin(angle) * r
                    const x = center + Math.cos(p.angleRad) * normalizedLen;
                    const y = center - Math.sin(p.angleRad) * normalizedLen; 

                    const color = idx === 0 ? '#E17055' : idx === 1 ? '#00B894' : '#0984E3'; // U, V, W colors
                    
                    // Label Position (pushed out further)
                    const labelDist = normalizedLen + 35;
                    const labelX = center + Math.cos(p.angleRad) * labelDist;
                    const labelY = center - Math.sin(p.angleRad) * labelDist;

                    return (
                        <g key={p.phaseId}>
                            {/* Vector Line */}
                            <line 
                                x1={center} 
                                y1={center} 
                                x2={x} 
                                y2={y} 
                                stroke={color} 
                                strokeWidth="3" 
                                markerEnd={`url(#arrow-${p.phaseId})`} 
                                opacity="0.9"
                            />
                            
                            {/* Connection line to label (dotted) for clarity */}
                            <line 
                                x1={x} 
                                y1={y} 
                                x2={labelX} 
                                y2={labelY} 
                                stroke={color} 
                                strokeWidth="1" 
                                strokeDasharray="2 2" 
                                opacity="0.4"
                            />

                            {/* Data Labels Group */}
                            <g transform={`translate(${labelX}, ${labelY})`}>
                                {/* Background Box - using currentColor derived from theme.bgCard */}
                                <rect 
                                    x="-26" 
                                    y="-20" 
                                    width="52" 
                                    height="40" 
                                    className={`${cardBgTextClass} ${borderTextClass}`}
                                    fill="currentColor" 
                                    fillOpacity="0.95" 
                                    stroke="currentColor" // Use the border color for stroke
                                    strokeWidth="1"
                                    rx="4" 
                                />
                                {/* Text Content */}
                                <text 
                                    className={`${theme.textMain} font-mono font-bold`}
                                    fill="currentColor"
                                    fontSize="10" 
                                    textAnchor="middle" 
                                    alignmentBaseline="middle"
                                >
                                    <tspan x="0" dy="-0.8em" fill={color} fontWeight="900" fontSize="11">{p.phaseId}</tspan>
                                    <tspan x="0" dy="1.4em">{p.rms.toFixed(1)}</tspan>
                                    <tspan x="0" dy="1.2em">{p.angleDeg.toFixed(0)}°</tspan>
                                </text>
                            </g>

                            <defs>
                                <marker id={`arrow-${p.phaseId}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                                    <path d="M0,0 L0,6 L9,3 z" fill={color} />
                                </marker>
                            </defs>
                        </g>
                    );
                })}
            </svg>
        );
    };

    const colors = ['#E17055', '#00B894', '#0984E3'];
    const phaseLabels = ['U', 'V', 'W'];

    return (
        <div className={`${theme.bgCard} p-5 rounded-xl border ${theme.border} shadow-sm animate-fade-in`}>
            <h3 className={`text-lg font-semibold ${theme.textTitle} mb-4 flex items-center`}>
                 <span className={`w-1.5 h-6 rounded mr-3 bg-amber-500`}></span>
                 {translations.powerAnalysis}
            </h3>

            {/* Config Toolbar */}
            <div className={`flex flex-wrap items-end gap-4 mb-6 ${theme.bgPanel} p-4 rounded-lg border ${theme.border}`}>
                <div className="flex flex-col gap-1">
                    <label className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>{translations.phaseU}</label>
                    <select 
                        value={chU}
                        onChange={e => setChU(e.target.value)}
                        className={`${theme.bgApp} ${theme.textMain} text-sm px-3 py-2 rounded border ${theme.border} outline-none min-w-[120px]`}
                    >
                        {metadata.channels.map(ch => (
                            <option key={ch} value={ch}>{channelNames[ch] || ch}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>{translations.phaseV}</label>
                    <select 
                        value={chV}
                        onChange={e => setChV(e.target.value)}
                        className={`${theme.bgApp} ${theme.textMain} text-sm px-3 py-2 rounded border ${theme.border} outline-none min-w-[120px]`}
                    >
                        {metadata.channels.map(ch => (
                            <option key={ch} value={ch}>{channelNames[ch] || ch}</option>
                        ))}
                    </select>
                </div>
                
                <div className="flex flex-col justify-center">
                    <span className={`text-xs ${theme.textMuted} mb-2`}>Phase W = -(U+V)</span>
                    <button 
                        onClick={handleAnalyze}
                        className={`${theme.button} text-white px-5 py-2 rounded text-sm font-bold shadow-lg transition-transform active:scale-95`}
                    >
                        {translations.calculateButton}
                    </button>
                </div>
            </div>

            {result && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 1. Results Table */}
                    <div className={`${theme.bgPanel} p-4 rounded-lg border ${theme.border} flex flex-col`}>
                         <h4 className={`text-sm font-bold ${theme.textMain} uppercase mb-4 border-b ${theme.border} pb-2`}>{translations.qualityMetrics}</h4>
                         <div className="space-y-4">
                             <div className="flex justify-between items-center">
                                 <span className={theme.textMuted}>{translations.fundFreq}</span>
                                 <span className={`font-mono font-bold text-lg ${theme.textMain}`}>{result.fundamentalFreq.toFixed(2)} Hz</span>
                             </div>
                             <div className="flex justify-between items-center">
                                 <span className={theme.textMuted}>{translations.unbalance}</span>
                                 <span className={`font-mono font-bold ${result.unbalance > 2 ? 'text-red-500' : 'text-green-500'}`}>{result.unbalance.toFixed(2)}%</span>
                             </div>
                             
                             <div className="mt-4">
                                 <div className="grid grid-cols-4 text-[10px] uppercase font-bold text-center mb-2 text-slate-500">
                                     <div className="text-left pl-2">Ph</div>
                                     <div>RMS</div>
                                     <div>Angle</div>
                                     <div>THD</div>
                                 </div>
                                 {result.phases.map((p, i) => (
                                     <div key={p.phaseId} className={`grid grid-cols-4 text-sm font-mono text-center py-2 border-b ${theme.border} last:border-0`} style={{color: colors[i]}}>
                                         <div className="text-left pl-2 font-bold">{p.phaseId}</div>
                                         <div>{p.rms.toFixed(2)}</div>
                                         <div>{p.angleDeg.toFixed(1)}°</div>
                                         <div>{p.thd.toFixed(2)}%</div>
                                     </div>
                                 ))}
                             </div>
                         </div>

                         {/* THD Explanation Block */}
                         <div className={`mt-6 p-3 rounded-lg ${theme.bgApp} border ${theme.border}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={theme.accent}>
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                                <span className={`text-[11px] font-bold ${theme.textMain}`}>{translations.thdTitle || "THD Info"}</span>
                            </div>
                            <p className={`text-[10px] ${theme.textMuted} leading-relaxed mb-2`}>
                                {translations.thdExplanation}
                            </p>
                             <p className={`text-[10px] ${theme.textMain} leading-relaxed font-medium bg-black/10 p-1 rounded`}>
                                {translations.thdStandards}
                            </p>
                        </div>
                    </div>

                    {/* 2. Phasor Diagram */}
                    <div className={`${theme.bgPanel} p-4 rounded-lg border ${theme.border} flex flex-col items-center justify-center overflow-hidden`}>
                        <h4 className={`text-sm font-bold ${theme.textMain} uppercase mb-4 self-start`}>{translations.phasorDiagram}</h4>
                        {renderPhasor(result)}
                    </div>

                    {/* 3. Harmonics Chart */}
                    <div className={`${theme.bgPanel} p-4 rounded-lg border ${theme.border} flex flex-col`}>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className={`text-sm font-bold ${theme.textMain} uppercase`}>{translations.harmonics}</h4>
                            <div className="flex gap-1 text-[10px]">
                                <button 
                                    onClick={() => setHarmonicMode('percent')}
                                    className={`px-2 py-1 rounded border ${harmonicMode === 'percent' ? `${theme.bgApp} border-slate-500 text-white` : `border-transparent ${theme.textMuted}`}`}
                                >
                                    % (THD)
                                </button>
                                <button 
                                    onClick={() => setHarmonicMode('magnitude')}
                                    className={`px-2 py-1 rounded border ${harmonicMode === 'magnitude' ? `${theme.bgApp} border-slate-500 text-white` : `border-transparent ${theme.textMuted}`}`}
                                >
                                    Unit
                                </button>
                            </div>
                        </div>

                        {/* Phase Selector for Harmonics */}
                         <div className="flex items-center gap-2 mb-2">
                             <span className={`text-[10px] ${theme.textMuted} uppercase`}>Show Phase:</span>
                             <div className="flex gap-1">
                                 {phaseLabels.map((ph, idx) => (
                                     <button
                                         key={ph}
                                         onClick={() => setSelectedHarmonicPhase(idx)}
                                         className={`w-6 h-6 rounded text-xs font-bold transition-all ${
                                             selectedHarmonicPhase === idx 
                                             ? `text-white shadow-md scale-110` 
                                             : `${theme.textMuted} opacity-50 hover:opacity-100`
                                         }`}
                                         style={{ backgroundColor: selectedHarmonicPhase === idx ? colors[idx] : undefined, border: selectedHarmonicPhase !== idx ? `1px solid ${theme.border.replace('border-', '')}` : undefined }}
                                     >
                                         {ph}
                                     </button>
                                 ))}
                             </div>
                         </div>

                        <div className="flex-1 min-h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={result.phases[selectedHarmonicPhase].harmonics.slice(0, 15)} margin={{top: 15, right: 5, left: -10, bottom: 0}}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                    <XAxis 
                                        dataKey="order" 
                                        tick={{fontSize: 10}} 
                                        tickFormatter={(val) => `${val}f`} 
                                        stroke={theme.textMuted} 
                                    />
                                    <YAxis tick={{fontSize: 10}} stroke={theme.textMuted} />
                                    <Tooltip 
                                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px' }}
                                        formatter={(val: number) => [
                                            harmonicMode === 'percent' ? `${val.toFixed(2)}%` : val.toFixed(3), 
                                            harmonicMode === 'percent' ? '% Fund' : metadata.yUnit
                                        ]}
                                        labelFormatter={(label) => `${label}f (Harmonic Order)`}
                                    />
                                    <Bar 
                                        dataKey={harmonicMode === 'percent' ? 'percentage' : 'magnitude'} 
                                        name={harmonicMode === 'percent' ? 'Mag %' : `Mag (${metadata.yUnit})`} 
                                        radius={[4, 4, 0, 0]}
                                    >
                                        {result.phases[selectedHarmonicPhase].harmonics.slice(0, 15).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? colors[selectedHarmonicPhase] : '#fdcb6e'} />
                                        ))}
                                        <LabelList 
                                            dataKey={harmonicMode === 'percent' ? 'percentage' : 'magnitude'} 
                                            position="top" 
                                            fill={theme.textMuted} 
                                            fontSize={9}
                                            formatter={(val: number) => harmonicMode === 'percent' ? (val < 1 ? '' : `${val.toFixed(0)}%`) : val.toFixed(2)}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className={`mt-3 p-2 rounded ${theme.bgApp} border ${theme.border}`}>
                            <p className={`text-[9px] ${theme.textMuted} leading-tight`}>
                                {translations.harmonicsExplanation}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
