import { AiProvider, GenerateParams, AiResponse } from "./base-provider";

export class MercuryProvider implements AiProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.MERCURY_API_KEY || "";
  }

  async generate(params: GenerateParams): Promise<AiResponse> {
    if (!this.apiKey) {
      throw new Error("MERCURY_API_KEY is not configured.");
    }

    const url = "https://api.inceptionlabs.ai/v1/chat/completions";
    const messages: Array<{ role: string; content: string }> = [];

    if (params.systemInstruction) {
      messages.push({ role: "system", content: params.systemInstruction });
    }
    messages.push({ role: "user", content: params.prompt });

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000); // 30 seconds timeout

    try {
      console.log("[STAGE: Mercury request started] Model: mercury-2");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mercury-2",
          reasoning_effort: "low",
          messages,
          temperature: params.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mercury 2 API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Mercury 2 returned an empty completions choice.");
      }

      const latency = Date.now() - startTime;
      console.log(`[STAGE: Mercury response received] Latency: ${latency}ms`);

      return {
        text: content,
        latency,
        model: "mercury-2",
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error("AI request timed out");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
