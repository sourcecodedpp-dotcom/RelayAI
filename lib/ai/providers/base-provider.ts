export interface GenerateParams {
  prompt: string;
  systemInstruction?: string;
  jsonMode?: boolean;
  temperature?: number;
}

export interface AiResponse {
  text: string;
  latency?: number;
  model: string;
}

export interface ModelConfig {
  model: string;
  maxContextTokens: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
}

export interface AiProvider {
  generate(params: GenerateParams): Promise<AiResponse>;
}
