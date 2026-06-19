import { AiProvider } from "./base-provider";
import { MercuryProvider } from "./mercury-provider";

export function getProvider(): AiProvider {
  return new MercuryProvider();
}
