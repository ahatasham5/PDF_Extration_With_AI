
import { GoogleGenAI } from "@google/genai";

export async function extractContentFromPage(base64Image: string): Promise<string> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = "Extract all text and meaningful data from this document page. Use Markdown for formatting tables or headers if present. Be thorough and accurate.";
  
  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64Image,
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [imagePart, { text: prompt }] },
    });

    return response.text || "No content extracted.";
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
}
