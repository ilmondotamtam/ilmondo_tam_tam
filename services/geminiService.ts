
import { GoogleGenAI } from "@google/genai";

export const summarizeArticle = async (content: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Riassumi questo articolo in massimo 150 caratteri in modo accattivante per un giornale: ${content}`,
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "";
  }
};

export const suggestHeadline = async (content: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Suggerisci un titolo giornalistico forte per questo testo: ${content}`,
    });
    return response.text?.trim() || "Nuova Opinione";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Nuova Opinione";
  }
};
