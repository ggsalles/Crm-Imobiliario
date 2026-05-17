import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const MODEL_NAME = "gemini-3-flash-preview";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing in server environment" },
        { status: 500 }
      );
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error("[API/AI] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.status || 500 }
    );
  }
}
