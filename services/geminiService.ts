import { GoogleGenAI, Type } from "@google/genai";
import { GraceMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateGraceMessage = async (topic: string): Promise<GraceMessage> => {
  try {
    const prompt = `
      기독교인에게 힘이 되는 짧은 격려의 메시지와 그에 어울리는 성경 구절(개역개정)을 하나 추천해주세요.
      주제: ${topic}
      
      응답은 반드시 JSON 형식이어야 합니다.
      말투는 따뜻하고 부드러운 '해요체'를 사용해주세요.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            message: { type: Type.STRING, description: "2-3 sentences of encouraging Christian message" },
            verse: { type: Type.STRING, description: "The Bible verse text in Korean" },
            reference: { type: Type.STRING, description: "Book Chapter:Verse (e.g., 시편 23:1)" }
          },
          required: ["topic", "message", "verse", "reference"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    return JSON.parse(text) as GraceMessage;

  } catch (error) {
    console.error("Error generating grace message:", error);
    // Fallback in case of API error or quota limit
    return {
      topic: topic,
      message: "잠시 연결이 원활하지 않지만, 주님의 은혜가 성도님과 함께하시길 기도합니다.",
      verse: "두려워하지 말라 내가 너와 함께 함이라 놀라지 말라 나는 네 하나님이 됨이라",
      reference: "이사야 41:10"
    };
  }
};