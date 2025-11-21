import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceArea
} from 'recharts';
import { FrequencyDataPoint, WaveformDataPoint } from '../types';
import { downsampleFFT, downsampleWaveform } from '../utils/mathUtils';

interface DataChartsProps {
  waveform: WaveformDataPoint[];
  fftData: FrequencyDataPoint[];
  unit: string;
  onZoomChange: (startIndex: number, endIndex: number) => void;
  onResetZoom: () => void;
  isZoomed: boolean;
}

export const DataCharts: React.FC<DataChartsProps> = ({ 
  waveform, 
  fftData, 
  unit, 
  onZoomChange, 
  onResetZoom,
  isZoomed
}) => {
  const [refAreaLeft, setRefAreaLeft] = useState<string | number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | number | null>(null);

  // Downsample for rendering performance
  const displayWaveform = useMemo(() => downsampleWaveform(waveform, 2000), [waveform]);
  const displayFFT = useMemo(() => downsampleFFT(fftData, 1500), [fftData]);

  const handleMouseDown = (e: any) => {
    if (e && e.activeLabel) {
      setRefAreaLeft(e.activeLabel);
    }
  };

  const handleMouseMove = (e: any) => {
    if (refAreaLeft && e && e.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleMouseUp = () => {
    if (refAreaLeft && refAreaRight) {
      let left = refAreaLeft;
      let right = refAreaRight;

      // Ensure left is smaller than right
      if (left > right) {
        [left, right] = [right, left];
      }

      // Find approx indices in original data
      // Note: displayWaveform is downsampled, so we map time back to indices
      // The most accurate way is to assume the parent manages based on time.
      
      // We pass the times to the parent, parent finds indices
      const startTime = Number(left);
      const endTime = Number(right);

      // Find nearest indices in the *full* waveform (passed in props)
      // Binary search or simple find for now (simple is fast enough for <100k)
      const startIndex = waveform.findIndex(p => p.time >= startTime);
      let endIndex = waveform.findIndex(p => p.time >= endTime);
      if (endIndex === -1) endIndex = waveform.length - 1;

      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          onZoomChange(startIndex, endIndex);
      }
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  return (
    <div className="grid grid-cols-1 gap-8 mb-8">
      {/* Time Domain Chart */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center">
            <span className="w-2 h-6 bg-blue-500 rounded mr-2"></span>
            Time Domain (Waveform)
          </h3>
          {isZoomed && (
            <button 
              onClick={onResetZoom}
              className="px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-blue-300 rounded border border-slate-600 transition-colors"
            >
              Reset Zoom
            </button>
          )}
        </div>
        
        <div className="h-[300px] w-full relative select-none">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={displayWaveform}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="time" 
                label={{ value: 'Time (s)', position: 'insideBottomRight', offset: -5, fill: '#94a3b8' }} 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(val) => val.toFixed(4)}
                type="number"
                domain={['dataMin', 'dataMax']}
                allowDataOverflow
              />
              <YAxis 
                label={{ value: unit, angle: -90, position: 'insideLeft', fill: '#94a3b8' }} 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                domain={['auto', 'auto']}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                labelFormatter={(label) => `Time: ${Number(label).toFixed(6)}s`}
                formatter={(value: number) => [value.toFixed(4), unit]}
                animationDuration={100}
              />
              <Line 
                type="monotone" 
                dataKey="amplitude" 
                stroke="#3b82f6" 
                strokeWidth={1.5} 
                dot={false} 
                isAnimationActive={false}
              />
              {refAreaLeft && refAreaRight && (
                <ReferenceArea 
                  x1={refAreaLeft} 
                  x2={refAreaRight} 
                  strokeOpacity={0.3} 
                  fill="#3b82f6" 
                  fillOpacity={0.3} 
                />
              )}
            </LineChart>
          </ResponsiveContainer>
           <div className="absolute top-2 right-10 text-xs text-slate-500 bg-slate-900/80 px-2 rounded pointer-events-none">
            Drag to Zoom / FFT Analysis
          </div>
        </div>
      </div>

      {/* Frequency Domain Chart */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center">
            <span className="w-2 h-6 bg-purple-500 rounded mr-2"></span>
            Frequency Domain (FFT)
          </h3>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayFFT}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="frequency" 
                label={{ value: 'Freq (Hz)', position: 'insideBottomRight', offset: -5, fill: '#94a3b8' }}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : Math.round(val).toString()}
              />
              <YAxis 
                 tick={{ fill: '#94a3b8', fontSize: 12 }}
                 label={{ value: 'Mag', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                labelFormatter={(label) => `Freq: ${Number(label).toFixed(1)}Hz`}
                formatter={(value: number) => [value.toFixed(4), unit]}
              />
              <Area 
                type="monotone" 
                dataKey="magnitude" 
                stroke="#a855f7" 
                fill="#a855f7" 
                fillOpacity={0.3} 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};