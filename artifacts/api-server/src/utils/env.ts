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
  { name: "DATABASE_URL",                       required: true,  description: "PostgreSQL connection string" },
  { name: "PORT",                               required: true,  description: "HTTP port" },
  { name: "ANTHROPIC_API_KEY",                  required: false, description: "Claude AI (agent/WhatsApp)" },
  { name: "AI_INTEGRATIONS_OPENAI_API_KEY",     required: false, description: "OpenAI (chat ThallesZzz)" },
  { name: "WHATSAPP_PROVIDER",    required: false, description: "WhatsApp provider (default: evolution)" },
  { name: "WHATSAPP_API_URL",     required: false, description: "WhatsApp provider API base URL" },
  { name: "WHATSAPP_API_TOKEN",   required: false, description: "WhatsApp provider API token" },
  { name: "WHATSAPP_INSTANCE_ID", required: false, description: "WhatsApp instance/session ID" },
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
