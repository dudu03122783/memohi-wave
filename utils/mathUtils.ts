import { FrequencyDataPoint, SignalMetadata, SignalStats, WaveformDataPoint } from '../types';

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

export const parseOscilloscopeCsv = (text: string): { waveform: WaveformDataPoint[]; metadata: SignalMetadata } => {
  const lines = text.split(/\r?\n/);
  const rawHeader: Record<string, string> = {};
  const waveform: WaveformDataPoint[] = [];
  
  let dataStartIndex = 0;
  let samplingRateHz = 1000; // Default fallback
  let yUnit = 'V'; // Default Unit

  // 1. Parse Header
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Heuristic: Detect split between header and data
    // Data usually looks like "2.00E+03, 1.00E+03"
    // Header usually contains colons or text
    if (line.includes(',') && !isNaN(parseFloat(line.split(',')[0]))) {
      dataStartIndex = i;
      break;
    }

    // Clean messy lines often found in scope exports (e.g., "1.00AData Uint:mv")
    // We try to extract key-values even if they are mashed together
    let cleanLine = line;
    
    // Regex to capture "Key:Value" pattern
    if (line.includes(':')) {
        // Try to isolate the key/value part if it's prefixed by garbage numbers
        // e.g. "1.00AData Uint:mv" -> "Data Uint:mv"
        const match = line.match(/([a-zA-Z\s]+):(.+)/);
        if (match) {
           const key = match[1].trim();
           const val = match[2].trim();
           rawHeader[key] = val;

            // Extract Sampling Rate
            if (key.toLowerCase().includes('sampling rate')) {
                const rateStr = val.toLowerCase();
                if (rateStr.includes('ksa/s')) {
                    samplingRateHz = parseFloat(rateStr) * 1000;
                } else if (rateStr.includes('msa/s')) {
                    samplingRateHz = parseFloat(rateStr) * 1000000;
                } else if (rateStr.includes('sa/s')) {
                    samplingRateHz = parseFloat(rateStr);
                }
            }
            
            // Extract Unit (handling typos like 'Uint')
            if (key.toLowerCase().includes('unit') || key.toLowerCase().includes('uint')) {
                yUnit = val;
            }
        }
    }
  }

  // 2. Parse Data
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    if (parts.length >= 2) {
      // Reconstruct Time. Some formats have bad X-axis data in col 0.
      // We rely on index * 1/samplingRate for high precision time.
      const amp = parseFloat(parts[1]);
      
      if (!isNaN(amp)) {
         const timeSeconds = waveform.length * (1 / samplingRateHz);
         waveform.push({
           time: timeSeconds,
           amplitude: amp
         });
      }
    }
  }

  return {
    waveform,
    metadata: {
      timeBase: rawHeader['Time Base'] || 'Unknown',
      samplingRate: rawHeader['Sampling Rate'] || 'Unknown',
      samplingRateHz,
      amplitudeScale: rawHeader['Amplitude'] || 'Unknown',
      points: waveform.length,
      yUnit,
      rawHeader
    }
  };
};

export const calculateStats = (waveform: WaveformDataPoint[]): SignalStats => {
  if (waveform.length === 0) return { min: 0, max: 0, average: 0, rms: 0, dominantFrequency: 0 };

  let sum = 0;
  let sumSq = 0;
  let min = Infinity;
  let max = -Infinity;

  waveform.forEach(p => {
    sum += p.amplitude;
    sumSq += p.amplitude * p.amplitude;
    if (p.amplitude < min) min = p.amplitude;
    if (p.amplitude > max) max = p.amplitude;
  });

  return {
    min,
    max,
    average: sum / waveform.length,
    rms: Math.sqrt(sumSq / waveform.length),
    dominantFrequency: 0 // Calculated later via FFT
  };
};

export const performFFTAnalysis = (waveform: WaveformDataPoint[], sampleRateHz: number): { fftData: FrequencyDataPoint[], dominantFreq: number } => {
    // Extract amplitudes
    const amplitudes = waveform.map(p => p.amplitude);
    
    // Run FFT
    const { real, imag } = fft(amplitudes);
    
    // Compute magnitudes and map to frequency
    const magnitudes: number[] = [];
    const n = real.length;
    // Only need first half (Nyquist)
    const halfN = Math.floor(n / 2);
    
    for(let i = 0; i < halfN; i++) {
        // Magnitude = sqrt(real^2 + imag^2)
        // Normalize magnitude by N/2 for physical amplitude
        const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) * (2/n);
        magnitudes.push(mag);
    }
    
    // Create frequency points
    const frequencyData: FrequencyDataPoint[] = [];
    let maxMag = -1;
    let dominantFreq = 0;

    // Ignore DC component (index 0) for dominant frequency calculation
    for(let i = 0; i < halfN; i++) {
        const frequency = i * sampleRateHz / n;
        const magnitude = magnitudes[i];
        
        frequencyData.push({ frequency, magnitude });

        if (i > 0 && magnitude > maxMag) {
            maxMag = magnitude;
            dominantFreq = frequency;
        }
    }

    return { fftData: frequencyData, dominantFreq };
};

// Downsample for UI charting performance (Recharts chokes on >5k points)
export const downsampleWaveform = (data: WaveformDataPoint[], targetCount = 2000): WaveformDataPoint[] => {
    if (data.length <= targetCount) return data;
    const step = Math.ceil(data.length / targetCount);
    const result: WaveformDataPoint[] = [];
    for (let i = 0; i < data.length; i += step) {
        result.push(data[i]);
    }
    return result;
};

export const downsampleFFT = (data: FrequencyDataPoint[], targetCount = 1000): FrequencyDataPoint[] => {
    if (data.length <= targetCount) return data;
    const step = Math.floor(data.length / targetCount);
    const result: FrequencyDataPoint[] = [];
    
    for (let i = 0; i < data.length; i += step) {
        let maxMag = -1;
        let bestPoint = data[i];
        
        // Max-pooling decimation for FFT to preserve peaks
        for (let j = 0; j < step && (i + j) < data.length; j++) {
            if (data[i+j].magnitude > maxMag) {
                maxMag = data[i+j].magnitude;
                bestPoint = data[i+j];
            }
        }
        result.push(bestPoint);
    }
    return result;
};