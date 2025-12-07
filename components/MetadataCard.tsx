
import React from 'react';
import { SignalMetadata, ThemeColors } from '../types';

interface MetadataCardProps {
  metadata: SignalMetadata;
  theme: ThemeColors;
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

export const MetadataCard: React.FC<MetadataCardProps> = ({ metadata, labels, theme }) => {
  return (
    <div className={`${theme.bgCard} p-4 rounded-xl border ${theme.border} shadow-sm transition-colors duration-300`}>
      <h3 className={`text-sm font-bold ${theme.textMuted} uppercase tracking-wider mb-3 flex items-center gap-2`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        {labels.signalMetadata}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className={`${theme.bgPanel} p-3 rounded border ${theme.border} transition-colors duration-300`}>
          <div className={`text-[10px] ${theme.textMuted} uppercase font-semibold`}>{labels.timeBase}</div>
          <div className={`text-sm ${theme.textMain} font-mono`}>{metadata.timeBase || 'N/A'}</div>
        </div>
        <div className={`${theme.bgPanel} p-3 rounded border ${theme.border} transition-colors duration-300`}>
          <div className={`text-[10px] ${theme.textMuted} uppercase font-semibold`}>{labels.samplingRate}</div>
          <div className={`text-sm ${theme.textMain} font-mono`}>{metadata.samplingRate || `${metadata.samplingRateHz} Hz`}</div>
        </div>
        <div className={`${theme.bgPanel} p-3 rounded border ${theme.border} transition-colors duration-300`}>
          <div className={`text-[10px] ${theme.textMuted} uppercase font-semibold`}>{labels.dataPoints}</div>
          <div className={`text-sm ${theme.textMain} font-mono`}>{metadata.points.toLocaleString()}</div>
        </div>
        <div className={`${theme.bgPanel} p-3 rounded border ${theme.border} transition-colors duration-300`}>
          <div className={`text-[10px] ${theme.textMuted} uppercase font-semibold`}>{labels.verticalUnit}</div>
          <div className={`text-sm ${theme.textMain} font-mono`}>{metadata.yUnit || 'V'}</div>
        </div>
        {metadata.amplitudeScale && (
             <div className={`${theme.bgPanel} p-3 rounded border ${theme.border} transition-colors duration-300`}>
                <div className={`text-[10px] ${theme.textMuted} uppercase font-semibold`}>{labels.amplitude}</div>
                <div className={`text-sm ${theme.textMain} font-mono`}>{metadata.amplitudeScale}</div>
             </div>
        )}
        
        {Object.entries(metadata.rawHeader).map(([key, val]) => {
            if (['Time Base', 'Sampling Rate', 'Points', 'Unit', 'Uint', 'Amplitude'].some(k => key.includes(k))) return null;
            return (
                <div key={key} className={`${theme.bgPanel} p-3 rounded border ${theme.border} transition-colors duration-300`}>
                    <div className={`text-[10px] ${theme.textMuted} uppercase font-semibold truncate`} title={key}>{key}</div>
                    <div className={`text-sm ${theme.textMain} font-mono truncate`} title={val}>{val}</div>
                </div>
            );
        })}
      </div>
    </div>
  );
};
