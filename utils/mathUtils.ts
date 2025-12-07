
import { ChannelStats, FFTAnalysisResult, FrequencyDataPoint, SignalMetadata, WaveformDataPoint, WindowFunctionType } from '../types';

// A simplified FFT implementation for real-valued signals
const fft = (data: number[]): { real: number[]; imag: number[] } => {
  const n = data.length;
  if (n <= 1) return { real: data, imag: new Array(n).fill(0) };

  if ((n & (n - 1)) !== 0) {
    // Zero-pad to nearest power of 2
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
    const padded = new Array(nextPow2).fill(0);
    for (let i = 0; i < n; i++) padded[i] = data[i];
    return fft(padded);
  }

  const half = n / 2;
  const evens: number[] = [];
  const odds: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) evens.push(data[i]);
    else odds.push(data[i]);
  }

  const evenResult = fft(evens);
  const oddResult = fft(odds);

  const real = new Array(n).fill(0);
  const imag = new Array(n).fill(0);

  for (let k = 0; k < half; k++) {
    const angle = (-2 * Math.PI * k) / n;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const tReal = cos * oddResult.real[k] - sin * oddResult.imag[k];
    const tImag = sin * oddResult.real[k] + cos * oddResult.imag[k];

    real[k] = evenResult.real[k] + tReal;
    imag[k] = evenResult.imag[k] + tImag;
    real[k + half] = evenResult.real[k] - tReal;
    imag[k + half] = evenResult.imag[k] - tImag;
  }

  return { real, imag };
};

const applyWindow = (data: number[], type: WindowFunctionType): number[] => {
    const n = data.length;
    if (type === 'rectangular') return data;

    const result = new Array(n);
    for(let i=0; i<n; i++) {
        let multiplier = 1;
        // Normalized 0 to 1 usually, or just apply standard formulas
        // w[n] = ... for 0 <= n <= N-1
        switch(type) {
            case 'hanning':
                multiplier = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
                break;
            case 'hamming':
                multiplier = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
                break;
            case 'blackman':
                multiplier = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
                break;
        }
        result[i] = data[i] * multiplier;
    }
    return result;
};

export const parseOscilloscopeCsv = (text: string): { waveform: WaveformDataPoint[]; metadata: SignalMetadata } => {
  const lines = text.split(/\r?\n/);
  const rawHeader: Record<string, string> = {};
  const waveform: WaveformDataPoint[] = [];
  
  let dataStartIndex = 0;
  let samplingRateHz = 1000; // Default fallback
  let yUnit = 'V'; // Default Unit
  let headerLineIndex = -1;

  // --- 1. Parse Header using Regex for robustness ---
  // We scan the first 50 lines for metadata.
  const headerChunk = lines.slice(0, 50).join('\n');

  // Improved Regex for Unit
  // Matches patterns like: "Data Uint:mv", "Vert Unit:A", "Unit: V", and handles concatenation like "1.00AData Uint:mv"
  // We look for "Unit" or "Uint", optional whitespace/chars, a separator (: or =), and then the unit string.
  const unitMatch = headerChunk.match(/(?:Data|Vert)?\s*(?:Unit|Uint)\s*[:=]\s*([a-zA-ZμµΩ]+)/i);
  if (unitMatch && unitMatch[1]) {
      yUnit = unitMatch[1].trim();
  }

  // Improved Regex for Sampling Rate
  // Matches "Sampling Rate: 1kSa/s", "1000Sa/s", "Sampling Rate:1kSa/s" (no space)
  const rateMatch = headerChunk.match(/Sampling\s*Rate\s*[:=]\s*([\d\.]+)\s*([kM]?Sa\/s)/i);
  if (rateMatch) {
      const val = parseFloat(rateMatch[1]);
      const unit = rateMatch[2].toLowerCase();
      if (unit.includes('ksa')) samplingRateHz = val * 1000;
      else if (unit.includes('msa')) samplingRateHz = val * 1000000;
      else samplingRateHz = val;
  }

  // Extract generic key-values for the rawHeader display
  lines.slice(0, 50).forEach((line, i) => {
      const trimLine = line.trim();
      if (!trimLine) return;
      
      // Heuristic: If line starts with numbers and has commas, it's data
      if (/^\d/.test(trimLine) && trimLine.includes(',')) {
          if (dataStartIndex === 0) dataStartIndex = i;
          return;
      }
      // If line has headers like "Time,Ch0"
      if (trimLine.toLowerCase().startsWith('time') && trimLine.includes(',')) {
          headerLineIndex = i;
          dataStartIndex = i + 1;
          return;
      }

      // Standard Key-Value extraction
      // We also try to handle the messy concatenation for display purposes (best effort)
      // e.g. "Amplitude:50.0A" or "Time Base:2s"
      const parts = trimLine.split(/[:=]/);
      if (parts.length >= 2) {
          // Clean up key/value
          let key = parts[0].trim();
          // If key is stuck to previous value like "2.00AData Uint", just take the last words
          const keyMatch = key.match(/([a-zA-Z\s]+)$/);
          if (keyMatch) key = keyMatch[1].trim();

          const val = parts.slice(1).join(':').trim();
          if (key && val) {
            rawHeader[key] = val;
          }
      }
  });

  if (dataStartIndex === 0) {
      // Fallback search for data start if not found
      for(let i=0; i<lines.length; i++) {
          if (lines[i].includes(',') && !isNaN(parseFloat(lines[i].split(',')[0]))) {
              dataStartIndex = i;
              // Check previous line for header
              if (i > 0 && lines[i-1].toLowerCase().includes('time')) {
                  headerLineIndex = i - 1;
              }
              break;
          }
      }
  }

  // 2. Determine Columns (Time vs Channels)
  let timeColumnIndex = -1;
  
  // Try to detect from header line
  if (headerLineIndex !== -1) {
      const headerCols = lines[headerLineIndex].split(',').map(s => s.trim().toLowerCase());
      const timeIdx = headerCols.findIndex(c => c.includes('time') || c === 's' || c === 'second');
      if (timeIdx !== -1) {
          timeColumnIndex = timeIdx;
      }
  }

  // If no header, analyze first few data rows
  if (timeColumnIndex === -1 && dataStartIndex < lines.length - 5) {
      const firstRow = lines[dataStartIndex].split(',').map(parseFloat);
      const secondRow = lines[dataStartIndex + 1].split(',').map(parseFloat);
      const lastRow = lines[Math.min(dataStartIndex + 20, lines.length-1)].split(',').map(parseFloat);
      
      // Check first column: is it strictly increasing?
      if (!isNaN(firstRow[0]) && !isNaN(secondRow[0]) && !isNaN(lastRow[0])) {
          if (secondRow[0] > firstRow[0] && lastRow[0] > secondRow[0]) {
              // Assume it's time if it looks like a ramp
              timeColumnIndex = 0;
          }
      }
  }

  let channelCount = 0;

  // 3. Parse Data
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    const numericParts = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));
    
    if (numericParts.length > 0) {
      let timeSeconds = 0;
      
      if (timeColumnIndex !== -1 && numericParts.length > timeColumnIndex) {
          timeSeconds = numericParts[timeColumnIndex];
      } else {
          timeSeconds = waveform.length * (1 / samplingRateHz);
      }

      const point: WaveformDataPoint = { time: timeSeconds };
      
      let chIdx = 0;
      numericParts.forEach((val, originalIdx) => {
          if (originalIdx !== timeColumnIndex) {
              point[`ch${chIdx}`] = val;
              chIdx++;
          }
      });

      if (chIdx > channelCount) channelCount = chIdx;
      waveform.push(point);
    }
  }

  const channels = Array.from({ length: channelCount }, (_, i) => `ch${i}`);

  return {
    waveform,
    metadata: {
      timeBase: rawHeader['Time Base'] || 'Unknown',
      samplingRate: rawHeader['Sampling Rate'] || `${samplingRateHz} Hz`,
      samplingRateHz,
      amplitudeScale: rawHeader['Amplitude'] || 'Unknown',
      points: waveform.length,
      yUnit,
      rawHeader,
      channels
    }
  };
};

export const calculateStats = (waveform: WaveformDataPoint[], channels: string[]): ChannelStats[] => {
  if (waveform.length === 0) return [];

  return channels.map(channel => {
      let sum = 0;
      let sumSq = 0;
      let min = Infinity;
      let max = -Infinity;

      // 1. First Pass: Sum, Min, Max
      waveform.forEach(p => {
        const val = p[channel] || 0;
        sum += val;
        sumSq += val * val;
        if (val < min) min = val;
        if (val > max) max = val;
      });

      const average = sum / waveform.length;
      const rms = Math.sqrt(sumSq / waveform.length);

      // 2. Second Pass: AC RMS (Standard Deviation)
      // AC RMS = sqrt( sum( (x - mean)^2 ) / N )
      let sumSqDiff = 0;
      waveform.forEach(p => {
          const val = p[channel] || 0;
          sumSqDiff += Math.pow(val - average, 2);
      });
      const acRms = Math.sqrt(sumSqDiff / waveform.length);

      return {
        channelId: channel,
        min,
        max,
        average,
        rms,
        acRms,
        dominantFrequency: 0 // Will be populated by FFT
      };
  });
};

export const performFFTAnalysis = (
    waveform: WaveformDataPoint[], 
    sampleRateHz: number, 
    channels: string[],
    windowType: WindowFunctionType = 'hanning'
): FFTAnalysisResult => {
    
    const n = waveform.length;
    if (n === 0) {
        return { fftData: [], dominantFreqs: {}, fftPoints: 0, frequencyResolution: 0 };
    }

    const channelMagnitudes: Record<string, number[]> = {};
    const dominantFreqs: Record<string, number> = {};
    
    // Calculate Next Power of 2 for FFT
    const fftLength = Math.pow(2, Math.ceil(Math.log2(n)));
    const frequencyResolution = sampleRateHz / fftLength;

    channels.forEach(channel => {
        let amplitudes = waveform.map(p => p[channel] || 0);
        
        // 1. Apply Window Function
        amplitudes = applyWindow(amplitudes, windowType);

        // 2. FFT (Zero padding happens inside if needed, but we do explicit power of 2 check usually. 
        // Our 'fft' helper handles power of 2 padding internally recursively, but let's rely on that.)
        // Note: 'fft' helper zero pads to next power of 2.
        const { real, imag } = fft(amplitudes);
        
        const magnitudes: number[] = [];
        // Real FFT returns symmetric, we only need first half
        const halfN = Math.floor(real.length / 2);
        
        let maxMag = -1;
        let domFreq = 0;

        for(let i = 0; i < halfN; i++) {
            // Normalize
            // Magnitude = sqrt(r^2 + i^2) * 2 / N
            const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) * (2 / real.length);
            magnitudes.push(mag);

            // Skip DC (index 0) for dominant frequency search
            if (i > 0 && mag > maxMag) {
                maxMag = mag;
                domFreq = i * sampleRateHz / real.length;
            }
        }
        channelMagnitudes[channel] = magnitudes;
        dominantFreqs[channel] = domFreq;
    });

    // Construct FrequencyDataPoint array
    const frequencyData: FrequencyDataPoint[] = [];
    const firstCh = channels[0];
    if (!firstCh) return { fftData: [], dominantFreqs: {}, fftPoints: fftLength, frequencyResolution };

    const numFreqBins = channelMagnitudes[firstCh].length;

    for(let i = 0; i < numFreqBins; i++) {
        const frequency = i * frequencyResolution;
        const point: FrequencyDataPoint = { frequency };
        channels.forEach(ch => {
            point[ch] = channelMagnitudes[ch][i];
        });
        frequencyData.push(point);
    }

    return { 
        fftData: frequencyData, 
        dominantFreqs, 
        fftPoints: fftLength,
        frequencyResolution
    };
};

export const downsampleWaveform = (data: WaveformDataPoint[], targetCount = 2000): WaveformDataPoint[] => {
    if (data.length <= targetCount) return data;
    const step = Math.ceil(data.length / targetCount);
    const result: WaveformDataPoint[] = [];
    for (let i = 0; i < data.length; i += step) {
        result.push(data[i]);
    }
    return result;
};

export const downsampleFFT = (data: FrequencyDataPoint[], targetCount = 1500): FrequencyDataPoint[] => {
    if (data.length <= targetCount) return data;
    const step = Math.floor(data.length / targetCount);
    const result: FrequencyDataPoint[] = [];
    
    const keys = Object.keys(data[0] || {}).filter(k => k !== 'frequency');

    for (let i = 0; i < data.length; i += step) {
        let bestPoint = {...data[i]};
        let maxMagSum = -1;
        
        for (let j = 0; j < step && (i + j) < data.length; j++) {
            const point = data[i+j];
            let sum = 0;
            keys.forEach(k => sum += (point[k] || 0));
            
            if (sum > maxMagSum) {
                maxMagSum = sum;
                bestPoint = point;
            }
        }
        result.push(bestPoint);
    }
    return result;
};
