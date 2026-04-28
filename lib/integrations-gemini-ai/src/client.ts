import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? "unused",
    httpOptions: {
          apiVersion: "",
          baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com",
    },
});
