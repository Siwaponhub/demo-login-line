// Gemini wrapper — ใช้เฉพาะตรวจสลิปโอนเงิน (Vision OCR + verification)
// เพิ่มประสิทธิภาพ + ประหยัด token:
//  - model: gemini-flash-lite-latest (ถูก/เร็ว)
//  - responseSchema → JSON บังคับ ไม่เปลือง token เป็นคำอธิบาย
//  - temperature 0 → คำตอบ deterministic
//  - prompt สั้นที่สุด, ส่งเฉพาะข้อมูลที่จำเป็น
//  - cache ผลลัพธ์ที่ image+expectations เดียวกัน → ไม่ยิงซ้ำ
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = "gemini-flash-lite-latest";

let _client = null;
const getModel = () => {
  if (!API_KEY) throw new Error("VITE_GEMINI_API_KEY ไม่ถูกตั้งค่า");
  if (!_client) _client = new GoogleGenerativeAI(API_KEY);
  return _client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          foundAmount: { type: SchemaType.NUMBER, description: "ยอดเงินบนสลิป" },
          foundAccount: { type: SchemaType.STRING, description: "เลขบัญชี/พร้อมเพย์ปลายทาง" },
          matchAmount: { type: SchemaType.BOOLEAN },
          matchAccount: { type: SchemaType.BOOLEAN },
          suspicious: { type: SchemaType.BOOLEAN, description: "พบสัญญาณตัดต่อหรือไม่" },
          reason: { type: SchemaType.STRING, description: "สรุป 1-2 ประโยค" },
        },
        required: ["matchAmount", "matchAccount", "suspicious", "reason"],
      },
    },
  });
};

// แปลง dataURL → { inlineData: { data, mimeType } }
function dataUrlToInline(dataUrl) {
  const m = /^data:(.+?);base64,(.*)$/.exec(dataUrl || "");
  if (!m) throw new Error("invalid data url");
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

// in-memory cache: hash(image+expectAmount+expectAccount) → result
const _cache = new Map();
const cacheKey = (slipDataUrl, exp) =>
  `${slipDataUrl.length}:${exp.amount}:${exp.account}`;

export async function verifySlip(slipDataUrl, expect) {
  const key = cacheKey(slipDataUrl, expect);
  if (_cache.has(key)) return _cache.get(key);

  const model = getModel();
  const prompt =
    `ตรวจสลิปโอนเงินไทย ส่งคืน JSON\n` +
    `ยอดที่คาดหวัง: ${expect.amount} บาท\n` +
    `บัญชีปลายทางที่คาดหวัง: ${expect.account}`;

  const result = await model.generateContent([prompt, dataUrlToInline(slipDataUrl)]);
  const text = result.response.text();
  const parsed = JSON.parse(text);
  _cache.set(key, parsed);
  return parsed;
}

export const isGeminiEnabled = () => Boolean(API_KEY);
