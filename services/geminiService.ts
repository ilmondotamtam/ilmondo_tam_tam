
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const summarizeArticle = async (content: string): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Riassumi questo articolo in massimo 150 caratteri in modo accattivante: ${content}`,
    });
    return response.text?.trim() || "Nessun riassunto disponibile.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Errore nella generazione del riassunto.";
  }
};

export const suggestHeadline = async (content: string): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Suggerisci un titolo giornalistico forte per questo testo: ${content}`,
    });
    return response.text?.trim() || "Titolo non disponibile.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Titolo Generico";
  }
};
