
import { GoogleGenAI } from "@google/genai";
import { SignalMetadata, ChannelStats, Language } from "../types";

export const analyzeSignalWithGemini = async (
  metadata: SignalMetadata,
  stats: ChannelStats[],
  snippet: string,
  language: Language = 'en'
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is missing in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Format stats per channel for prompt
  const statsDescription = stats.map(s => `
    **Channel ${s.channelId.toUpperCase()} Stats:**
    - Min: ${s.min.toFixed(2)}
    - Max: ${s.max.toFixed(2)}
    - Average: ${s.average.toFixed(2)}
    - RMS: ${s.rms.toFixed(2)}
    - Dominant Freq: ${s.dominantFrequency.toFixed(2)} Hz
  `).join('\n');

  const langInstruction = language === 'zh' 
    ? "Please provide the response strictly in Simplified Chinese (简体中文)." 
    : "Please provide the response in English.";

  const prompt = `
    You are an expert electrical engineer and signal processing specialist.
    Analyze the following oscilloscope data summary and provide insights on the signal characteristics.
    
    **Signal Metadata:**
    - Sample Rate: ${metadata.samplingRate}
    - Data Points: ${metadata.points}
    - Time Base: ${metadata.timeBase}
    - Channels: ${metadata.channels.join(', ')}
    
    ${statsDescription}
    
    **Raw Data Snippet (First few points, columns are Time, Ch0, Ch1...):**
    ${snippet}
    
    **Instructions:**
    1. Describe the likely nature of the signal(s) based on the stats. Compare channels if multiple exist.
    2. Comment on the signal quality or any anomalies.
    3. Suggest what physical phenomenon this might represent (e.g., 3-phase power, input/output signals, noise).
    4. Keep the response concise (under 200 words) and professional. Use Markdown formatting.
    5. ${langInstruction}
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
