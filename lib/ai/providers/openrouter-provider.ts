import { AiProvider, GenerateParams, AiResponse } from "./base-provider";

export class OpenRouterProvider implements AiProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "meta-llama/llama-3.1-70b-instruct") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(params: GenerateParams): Promise<AiResponse> {
    if (!this.apiKey) {
      throw new Error("OpenRouter API key is not configured.");
    }

    const url = "https://openrouter.ai/v1/chat/completions";
    const messages: Array<{ role: string; content: string }> = [];

    if (params.systemInstruction) {
      messages.push({ role: "system", content: params.systemInstruction });
    }
    messages.push({ role: "user", content: params.prompt });

    const requestBody: any = {
      model: this.model,
      messages,
      temperature: params.temperature ?? 0.7,
    };

    if (params.jsonMode) {
      requestBody.response_format = { type: "json_object" };
    }

    const startTime = Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Relay AI",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content === undefined || content === null) {
      throw new Error("OpenRouter returned an empty response.");
    }

    const latency = Date.now() - startTime;

    return {
      text: content,
      latency,
      model: this.model,
    };
  }
}
