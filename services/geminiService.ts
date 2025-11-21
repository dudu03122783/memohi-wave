import { GoogleGenAI } from "@google/genai";
import { SignalMetadata, SignalStats } from "../types";

export const analyzeSignalWithGemini = async (
  metadata: SignalMetadata,
  stats: SignalStats,
  snippet: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is missing in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are an expert electrical engineer and signal processing specialist.
    Analyze the following oscilloscope data summary and provide insights on the signal characteristics.
    
    **Signal Metadata:**
    - Sample Rate: ${metadata.samplingRate}
    - Data Points: ${metadata.points}
    - Time Base: ${metadata.timeBase}
    
    **Calculated Statistics:**
    - Minimum Amplitude: ${stats.min.toFixed(2)}
    - Maximum Amplitude: ${stats.max.toFixed(2)}
    - Average (DC Offset): ${stats.average.toFixed(2)}
    - RMS Value: ${stats.rms.toFixed(2)}
    - Dominant Frequency Component: ${stats.dominantFrequency.toFixed(2)} Hz
    
    **Raw Data Snippet (First 20 points):**
    ${snippet}
    
    **Instructions:**
    1. Describe the likely nature of this signal based on the stats (e.g., AC, DC, Noise, Sine wave, Pulse).
    2. Comment on the signal quality or any anomalies if visible from the stats (e.g., significant offset, high peak-to-average ratio).
    3. Suggest what physical phenomenon this might represent given typical oscilloscope applications (e.g., current sensor, voltage ripple).
    4. Keep the response concise (under 200 words) and professional. Use Markdown formatting.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to analyze signal with Gemini.");
  }
};