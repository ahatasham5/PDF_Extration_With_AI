
import { GoogleGenAI, Type } from "@google/genai";
import { EvaluationReport } from "../types";

export const processAndEvaluate = async (
  studentScript: { base64: string; mimeType: string },
  answerKey: { base64: string; mimeType: string }
): Promise<EvaluationReport> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    You are an expert exam evaluator. I am providing two documents (images or PDFs):
    1. A Student's Answer Script.
    2. An Official Model Answer Key.

    Your task is to:
    1. PREPROCESS: Extract the text from both documents.
    2. ALIGN: Match the student's handwritten or typed answers to the corresponding questions in the model answer key.
    3. EVALUATE: Grade each of the student's answers based on the model key. Be fair and provide constructive feedback.

    Please provide the output as a JSON object following the specified schema.
    Ensure you capture the student's answer exactly as written (handle handwriting extraction carefully from images or documents).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: studentScript.base64,
              mimeType: studentScript.mimeType,
            },
          },
          {
            inlineData: {
              data: answerKey.base64,
              mimeType: answerKey.mimeType,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                questionNumber: { type: Type.STRING },
                questionText: { type: Type.STRING },
                modelAnswer: { type: Type.STRING },
                studentAnswer: { type: Type.STRING },
                score: { type: Type.NUMBER },
                maxScore: { type: Type.NUMBER },
                feedback: { type: Type.STRING },
              },
              required: ["id", "questionNumber", "questionText", "modelAnswer", "studentAnswer", "score", "maxScore", "feedback"]
            },
          },
          totalScore: { type: Type.NUMBER },
          maxPossibleScore: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          improvementAreas: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["items", "totalScore", "maxPossibleScore", "summary", "improvementAreas"]
      },
    },
  });

  try {
    const result = JSON.parse(response.text || "{}");
    return result as EvaluationReport;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Failed to process evaluation report.");
  }
};
