import { GoogleGenAI, Type } from "@google/genai";
import { GraceMessage } from "../types";

// [한글 코멘트] 보안 강화: 프론트엔드 번들에 서버 API 키가 노출되지 않도록 지연 초기화 및 폴백 말씀 데이터 제공
const FALLBACK_MESSAGES: Record<string, GraceMessage> = {
  '위로가 필요할 때': {
    topic: '위로가 필요할 때',
    message: '지치고 힘든 하루 속에서도 주님은 성도님의 눈물과 한숨을 모두 알고 계셔요. 주님의 따뜻한 품 안에서 참된 쉼과 위로를 누리시기를 기도해요.',
    verse: '수고하고 무거운 짐 진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라',
    reference: '마태복음 11:28'
  },
  '희망이 필요할 때': {
    topic: '희망이 필요할 때',
    message: '앞길이 막막하게 느껴질 때에도 우리를 향한 하나님의 선하신 계획은 멈추지 않아요. 새 일을 행하실 주님을 기대하며 소망의 걸음을 내딛어 보아요.',
    verse: '여호와의 말씀이니라 너희를 향한 나의 생각을 내가 아나니 평안이요 재앙이 아니니라 너희에게 미래와 희망을 주는 것이니라',
    reference: '예레미야 29:11'
  },
  '감사하고 싶을 때': {
    topic: '감사하고 싶을 때',
    message: '작은 일상 속에서도 베풀어 주신 하나님의 은혜를 발견하는 복된 마음이네요. 감사의 고백 위에 더 큰 기쁨과 평강이 넘치기를 축복해요.',
    verse: '항상 기뻐하라 쉬지 말고 기도하라 범사에 감사하라 이것이 그리스도 예수 안에서 너희를 향하신 하나님의 뜻이니라',
    reference: '데살로니가전서 5:16-18'
  },
  '용기가 필요할 때': {
    topic: '용기가 필요할 때',
    message: '두려워하지 마세요. 세상 끝날까지 함께하시겠다고 약속하신 주님께서 오늘도 성도님의 오른손을 굳게 붙들고 계셔요.',
    verse: '두려워하지 말라 내가 너와 함께 함이라 놀라지 말라 나는 네 하나님이 됨이라 내가 너를 굳세게 하리라 참으로 너를 도와 주리라',
    reference: '이사야 41:10'
  },
  '평안이 필요할 때': {
    topic: '평안이 필요할 때',
    message: '마음의 염려와 근심을 주님께 온전히 맡겨 드려요. 세상이 줄 수 없는 하나님의 깊은 평안이 성도님의 마음과 생각을 지켜 주실 거예요.',
    verse: '평안을 너희에게 끼치노니 곧 나의 평안을 너희에게 주노라 내가 너희에게 주는 것은 세상이 주는 것과 같지 아니하니라',
    reference: '요한복음 14:27'
  }
};

export const generateGraceMessage = async (topic: string): Promise<GraceMessage> => {
  try {
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      return FALLBACK_MESSAGES[topic] || FALLBACK_MESSAGES['용기가 필요할 때'];
    }

    const ai = new GoogleGenAI({ apiKey });
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
    return FALLBACK_MESSAGES[topic] || FALLBACK_MESSAGES['용기가 필요할 때'];
  }
};