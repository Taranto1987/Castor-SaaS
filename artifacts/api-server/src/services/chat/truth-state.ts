import type { CapsuleState } from "../memory/capsule";
import type { ChatMessage } from "./lead-extractor";

export interface TruthState {
  lojaId: number;
  customerId: number | null;
  sessionId: string;
  anonymousId: string | null;
  memory: CapsuleState | null;
  isReturningCustomer: boolean;
  productContext: string;
  conversationHistory: ChatMessage[];
}
