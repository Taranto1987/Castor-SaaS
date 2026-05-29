/**
 * Validates required and optional environment variables at startup.
 * Hard-required vars throw immediately — the server must not start without them.
 * Soft-required vars log a warning — features degrade gracefully.
 */

interface EnvSpec {
  name: string;
  required: boolean;
  description: string;
}

const ENV_SPEC: EnvSpec[] = [
  // ── Hard required — server must not start without these ──────────────────
  { name: "DATABASE_URL",  required: true, description: "PostgreSQL connection string" },
  { name: "PORT",          required: true, description: "HTTP port" },

  // ── AI features ───────────────────────────────────────────────────────────
  { name: "ANTHROPIC_API_KEY",              required: false, description: "Claude AI (managed agent + chat)" },
  { name: "CASTOR_AGENT_ID",                required: false, description: "Claude managed agent ID" },
  { name: "CASTOR_ENVIRONMENT_ID",          required: false, description: "Claude managed environment ID" },
  { name: "AI_INTEGRATIONS_OPENAI_API_KEY", required: false, description: "OpenAI fallback (chat ThallesZzz)" },
  { name: "AI_INTEGRATIONS_GEMINI_API_KEY", required: false, description: "Gemini Vision (OCR NF-e)" },

  // ── WhatsApp — Evolution API (primary) ────────────────────────────────────
  { name: "EVOLUTION_API_URL",      required: false, description: "Evolution API base URL" },
  { name: "EVOLUTION_API_KEY",      required: false, description: "Evolution API auth token" },
  { name: "EVOLUTION_WEBHOOK_TOKEN",required: false, description: "Evolution webhook signature validation" },

  // ── WhatsApp — WAHA fallback ──────────────────────────────────────────────
  { name: "WAHA_URL",             required: false, description: "WAHA API base URL" },
  { name: "WAHA_WEBHOOK_SECRET",  required: false, description: "WAHA webhook auth secret" },

  // ── WhatsApp — generic provider layer (transport.ts) ─────────────────────
  { name: "WHATSAPP_PROVIDER",    required: false, description: "Provider selector (default: evolution)" },
  { name: "WHATSAPP_API_URL",     required: false, description: "Generic provider API base URL" },
  { name: "WHATSAPP_API_TOKEN",   required: false, description: "Generic provider API token" },
  { name: "WHATSAPP_INSTANCE_ID", required: false, description: "Generic provider instance ID" },

  // ── CORS + infra ──────────────────────────────────────────────────────────
  { name: "ALLOWED_ORIGINS", required: false, description: "CORS allowlist (comma-separated URLs)" },
];

export function validateEnv(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const spec of ENV_SPEC) {
    const value = process.env[spec.name];
    if (!value || value.trim() === "") {
      if (spec.required) {
        missing.push(`  ✗ ${spec.name} — ${spec.description}`);
      } else {
        warnings.push(`  ⚠ ${spec.name} — ${spec.description} (feature disabled)`);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn("[env] Optional variables not set — some features will be disabled:");
    warnings.forEach(w => console.warn(w));
  }

  if (missing.length > 0) {
    console.error("[env] FATAL: Required environment variables are missing:");
    missing.forEach(m => console.error(m));
    process.exit(1);
  }
}
