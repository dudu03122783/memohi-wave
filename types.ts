export interface WaveformDataPoint {
  time: number;
  amplitude: number;
}

export interface FrequencyDataPoint {
  frequency: number;
  magnitude: number;
}

export interface SignalMetadata {
  timeBase?: string;
  samplingRate?: string;
  samplingRateHz: number;
  amplitudeScale?: string;
  points: number;
  yUnit: string; // Added unit field
  rawHeader: Record<string, string>;
}

export interface ParsedData {
  metadata: SignalMetadata;
  waveform: WaveformDataPoint[];
  fftData: FrequencyDataPoint[];
  stats: SignalStats;
}

export interface SignalStats {
  min: number;
  max: number;
  average: number;
  rms: number;
  dominantFrequency: number;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}