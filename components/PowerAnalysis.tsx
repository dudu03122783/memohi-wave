
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
        const size = 300; // Increased size slightly to accommodate labels
        const center = size / 2;
        const radius = size * 0.35; // Slightly reduced radius ratio to give more margin for text
        
        const maxRms = Math.max(...res.phases.map(p => p.rms));
        
        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
                {/* Background Grid */}
                <circle cx={center} cy={center} r={radius} stroke={theme.border.replace('border-', '')} strokeWidth="1" fill="none" opacity="0.2" />
                <circle cx={center} cy={center} r={radius * 0.66} stroke={theme.border.replace('border-', '')} strokeWidth="1" fill="none" opacity="0.2" />
                <circle cx={center} cy={center} r={radius * 0.33} stroke={theme.border.replace('border-', '')} strokeWidth="1" fill="none" opacity="0.2" />
                <line x1={center} y1="0" x2={center} y2={size} stroke={theme.border.replace('border-', '')} strokeWidth="1" opacity="0.2" />
                <line x1="0" y1={center} x2={size} y2={center} stroke={theme.border.replace('border-', '')} strokeWidth="1" opacity="0.2" />

                {res.phases.map((p, idx) => {
                    const normalizedLen = maxRms > 0 ? (p.rms / maxRms) * radius : 0;
                    
                    // Coordinates calculation (Standard math polar: 0 is Right. SVG Y is down)
                    // y = center - sin(angle) * r
                    const x = center + Math.cos(p.angleRad) * normalizedLen;
                    const y = center - Math.sin(p.angleRad) * normalizedLen; 

                    const color = idx === 0 ? '#E17055' : idx === 1 ? '#00B894' : '#0984E3'; // R, G, B colors roughly
                    
                    // Label Position (pushed out further)
                    const labelDist = normalizedLen + 40;
                    const labelX = center + Math.cos(p.angleRad) * labelDist;
                    const labelY = center - Math.sin(p.angleRad) * labelDist;

                    return (
                        <g key={p.phaseId}>
                            <line x1={center} y1={center} x2={x} y2={y} stroke={color} strokeWidth="3" markerEnd={`url(#arrow-${p.phaseId})`} />
                            
                            {/* Data Labels */}
                            <text 
                                x={labelX} 
                                y={labelY} 
                                fill={theme.textMain} 
                                fontSize="10" 
                                textAnchor="middle" 
                                alignmentBaseline="middle"
                                className="font-mono"
                            >
                                <tspan x={labelX} dy="-1.2em" fontWeight="bold" fontSize="12" fill={color}>{p.phaseId}</tspan>
                                <tspan x={labelX} dy="1.3em">{p.rms.toFixed(2)}{metadata.yUnit}</tspan>
                                <tspan x={labelX} dy="1.2em">{p.angleDeg.toFixed(1)}°</tspan>
                            </text>

                            <defs>
                                <marker id={`arrow-${p.phaseId}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
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
                    </div>

                    {/* 2. Phasor Diagram */}
                    <div className={`${theme.bgPanel} p-4 rounded-lg border ${theme.border} flex flex-col items-center justify-center`}>
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
                                    Unit ({metadata.yUnit})
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 min-h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={result.phases[0].harmonics.slice(0, 10)} margin={{top: 15, right: 5, left: -10, bottom: 0}}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                    <XAxis dataKey="order" tick={{fontSize: 10}} tickFormatter={(val) => `${val}x`} stroke={theme.textMuted} />
                                    <YAxis tick={{fontSize: 10}} stroke={theme.textMuted} />
                                    <Tooltip 
                                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px' }}
                                        formatter={(val: number) => [
                                            harmonicMode === 'percent' ? `${val.toFixed(2)}%` : val.toFixed(3), 
                                            harmonicMode === 'percent' ? '% Fund' : metadata.yUnit
                                        ]}
                                        labelFormatter={(label) => `${label}th Order`}
                                    />
                                    <Bar 
                                        dataKey={harmonicMode === 'percent' ? 'percentage' : 'magnitude'} 
                                        name={harmonicMode === 'percent' ? 'Mag %' : `Mag (${metadata.yUnit})`} 
                                        radius={[4, 4, 0, 0]}
                                    >
                                        {result.phases[0].harmonics.slice(0, 10).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#6C5CE7' : '#fdcb6e'} />
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
                        <div className={`text-[10px] text-center mt-2 ${theme.textMuted}`}>Showing harmonics for Phase U relative to fundamental</div>
                    </div>
                </div>
            )}
        </div>
    );
};
