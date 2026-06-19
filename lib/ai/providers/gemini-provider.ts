import { AiProvider, GenerateParams, AiResponse } from "./base-provider";

export class GeminiProvider implements AiProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-2.5-pro") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(params: GenerateParams): Promise<AiResponse> {
    if (!this.apiKey) {
      throw new Error("Gemini API key is not configured.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody: any = {
      contents: [
        {
          parts: [{ text: params.prompt }],
        },
      ],
      generationConfig: {
        temperature: params.temperature ?? 0.7,
      },
    };

    if (params.systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: params.systemInstruction }],
      };
    }

    if (params.jsonMode) {
      requestBody.generationConfig.responseMimeType = "application/json";
    }

    const startTime = Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    const latency = Date.now() - startTime;

    return {
      text,
      latency,
      model: this.model,
    };
  }
}
