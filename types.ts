

export interface WaveformDataPoint {
  time: number;
  [key: string]: number; // ch0, ch1, etc.
}

export interface FrequencyDataPoint {
  frequency: number;
  [key: string]: number; // ch0, ch1, etc. for magnitudes
}

export interface ChannelStats {
  channelId: string;
  min: number;
  max: number;
  average: number;
  rms: number;
  acRms: number; // AC Coupled RMS (Standard Deviation)
  dominantFrequency: number;
}

export interface SignalMetadata {
  timeBase?: string;
  samplingRate?: string;
  samplingRateHz: number;
  amplitudeScale?: string;
  points: number;
  yUnit: string;
  rawHeader: Record<string, string>;
  channels: string[]; // e.g. ['ch0', 'ch1']
}

export type WindowFunctionType = 'rectangular' | 'hanning' | 'hamming' | 'blackman';
export type Language = 'zh' | 'en';
export type ThemeKey = 'quiet-light' | 'vs-light' | 'solarized-light' | 'dracula' | 'monokai-black';

export interface ThemeColors {
    name: string;
    bgApp: string;
    bgCard: string;
    bgPanel: string;
    border: string;
    textMain: string;
    textTitle: string;
    textMuted: string;
    accent: string;
    button: string;
    chartColors: string[];
}

export interface FFTAnalysisResult {
    fftData: FrequencyDataPoint[];
    dominantFreqs: Record<string, number>;
    fftPoints: number;
    frequencyResolution: number;
}

export interface ParsedData {
  metadata: SignalMetadata;
  waveform: WaveformDataPoint[];
  fftData: FrequencyDataPoint[];
  stats: ChannelStats[];
  fftMetadata?: {
      window: WindowFunctionType;
      scope: 'view' | 'full';
      points: number;
      resolution: number;
  };
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface HarmonicInfo {
    order: number;
    frequency: number;
    magnitude: number;
    percentage: number; // Relative to fundamental
}

export interface PhaseResult {
    phaseId: string; // 'U', 'V', 'W'
    rms: number;
    frequency: number;
    angleRad: number;
    angleDeg: number;
    thd: number; // Total Harmonic Distortion %
    harmonics: HarmonicInfo[];
}

export interface PowerAnalysisResult {
    fundamentalFreq: number;
    phases: PhaseResult[];
    unbalance: number; // Max deviation from avg RMS %
}
