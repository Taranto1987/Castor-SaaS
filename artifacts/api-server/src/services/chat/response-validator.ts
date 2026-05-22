export type ValidationStatus = "ok" | "identity_leak" | "too_long" | "empty";

export interface ValidationResult {
  status: ValidationStatus;
  response: string;
}

const IDENTITY_LEAK_RE =
  /\b(anthropic|claude\b|openai|gpt-[0-9]|chatgpt|large language model|llm)\b/i;

const MAX_CHARS = 2400;

export function validateResponse(raw: string): ValidationResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { status: "empty", response: "" };
  }

  if (IDENTITY_LEAK_RE.test(trimmed)) {
    console.warn("[Validator] identity_leak detected — stripping response");
    return {
      status: "identity_leak",
      response:
        "Sou o assistente da Castor Exclusiva. Como posso te ajudar com produtos ou informações sobre sono?",
    };
  }

  if (trimmed.length > MAX_CHARS) {
    return {
      status: "too_long",
      response: trimmed.slice(0, MAX_CHARS),
    };
  }

  return { status: "ok", response: trimmed };
}
