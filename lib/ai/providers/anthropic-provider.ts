import { AiProvider, GenerateParams, AiResponse } from "./base-provider";

export class AnthropicProvider implements AiProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "claude-3-5-sonnet-latest") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(params: GenerateParams): Promise<AiResponse> {
    if (!this.apiKey) {
      throw new Error("Anthropic API key is not configured.");
    }

    const url = "https://api.anthropic.com/v1/messages";
    const messages: Array<{ role: string; content: string }> = [];
    messages.push({ role: "user", content: params.prompt });

    const requestBody: any = {
      model: this.model,
      messages,
      max_tokens: 4096,
      temperature: params.temperature ?? 0.7,
    };

    if (params.systemInstruction) {
      requestBody.system = params.systemInstruction;
    }

    if (params.jsonMode && requestBody.system) {
      requestBody.system = requestBody.system + "\n\nYou must output ONLY valid raw JSON.";
    }

    const startTime = Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    if (content === undefined || content === null) {
      throw new Error("Anthropic returned an empty response.");
    }

    const latency = Date.now() - startTime;

    return {
      text: content,
      latency,
      model: this.model,
    };
  }
}
