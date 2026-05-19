export type IntentLevel = "low" | "medium" | "high" | "closing";

export type ChatEventType =
  | {
      type: "session_started";
      sessionId: string;
      lojaId: number;
      messageCount: number;
    }
  | {
      type: "intent_classified";
      sessionId: string;
      lojaId: number;
      intent: IntentLevel;
      pains: string[];
      objections: string[];
    }
  | {
      type: "pain_detected";
      sessionId: string;
      lojaId: number;
      pain: string;
    }
  | {
      type: "objection_detected";
      sessionId: string;
      lojaId: number;
      objection: string;
    }
  | {
      type: "high_intent_detected";
      sessionId: string;
      lojaId: number;
    }
  | {
      type: "lead_captured";
      sessionId: string;
      lojaId: number;
      hasName: boolean;
      hasPhone: boolean;
      productIds: number[];
    }
  | {
      type: "product_recommended";
      sessionId: string;
      lojaId: number;
      productIds: number[];
    }
  | {
      type: "abandonment_detected";
      sessionId: string;
      lojaId: number;
    };
