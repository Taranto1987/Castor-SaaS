import { runTrafficManagerCycle } from "./traffic-manager-agent";

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

let isRunning = false;

async function executeCycle() {
  if (isRunning) {
    console.log("[TrafficManager] Ciclo anterior ainda em execução, pulando.");
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    console.log("[TrafficManager] Iniciando ciclo de monitoramento...");
    const result = await runTrafficManagerCycle("scheduled");

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const actionsCount = result.actions.length;

    if (result.anomalyDetected) {
      console.log(
        `[TrafficManager] Anomalia detectada (${result.vigiLevel}) — ${actionsCount} ação(ões) executada(s) em ${elapsed}s`,
      );
    } else {
      console.log(
        `[TrafficManager] Ciclo ok (${result.vigiLevel}) — ${elapsed}s`,
      );
    }
  } catch (e) {
    console.error("[TrafficManager] Erro no ciclo:", e);
  } finally {
    isRunning = false;
  }
}

export function iniciarSchedulerTrafficManager() {
  const hasGeminiKey = !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

  if (!hasGeminiKey || !hasAnthropicKey) {
    console.log(
      "[TrafficManager] Scheduler desativado — configure AI_INTEGRATIONS_GEMINI_API_KEY e ANTHROPIC_API_KEY",
    );
    return;
  }

  // Primeiro ciclo com delay de 30s para o servidor estabilizar
  setTimeout(() => {
    executeCycle();
  }, 30_000);

  setInterval(executeCycle, INTERVAL_MS);

  console.log(
    `[TrafficManager] Scheduler iniciado — ciclos a cada ${INTERVAL_MS / 60_000} min`,
  );
}
