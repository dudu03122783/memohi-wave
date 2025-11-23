
import React from 'react';
import { SignalMetadata } from '../types';

interface MetadataCardProps {
  metadata: SignalMetadata;
  labels: {
    signalMetadata: string;
    timeBase: string;
    samplingRate: string;
    dataPoints: string;
    verticalUnit: string;
    amplitude: string;
    [key: string]: any;
  };
}

export const MetadataCard: React.FC<MetadataCardProps> = ({ metadata, labels }) => {
  // Filter out keys we display explicitly to avoid duplication if we were iterating rawHeader
  // For now, we explicitly show the parsed main fields and then the raw header values that are common
  
  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        {labels.signalMetadata}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">{labels.timeBase}</div>
          <div className="text-sm text-slate-200 font-mono">{metadata.timeBase || 'N/A'}</div>
        </div>
        <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">{labels.samplingRate}</div>
          <div className="text-sm text-slate-200 font-mono">{metadata.samplingRate || `${metadata.samplingRateHz} Hz`}</div>
        </div>
        <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">{labels.dataPoints}</div>
          <div className="text-sm text-slate-200 font-mono">{metadata.points.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">{labels.verticalUnit}</div>
          <div className="text-sm text-slate-200 font-mono">{metadata.yUnit || 'V'}</div>
        </div>
        {metadata.amplitudeScale && (
             <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">{labels.amplitude}</div>
                <div className="text-sm text-slate-200 font-mono">{metadata.amplitudeScale}</div>
             </div>
        )}
        
        {/* Render other interesting raw header fields if they exist and aren't covered above */}
        {Object.entries(metadata.rawHeader).map(([key, val]) => {
            // Skip keys we already handled roughly
            if (['Time Base', 'Sampling Rate', 'Points', 'Unit', 'Uint', 'Amplitude'].some(k => key.includes(k))) return null;
            return (
                <div key={key} className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold truncate" title={key}>{key}</div>
                    <div className="text-sm text-slate-200 font-mono truncate" title={val}>{val}</div>
                </div>
            );
        })}
      </div>
    </div>
  );
};
