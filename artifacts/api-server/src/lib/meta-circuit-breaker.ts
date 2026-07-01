export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface Breaker {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  openedAt: number;
}

const FAILURE_THRESHOLD = 5;
const SUCCESS_THRESHOLD = 2;
const HALF_OPEN_TIMEOUT_MS = 60_000;

const breakers = new Map<number, Breaker>();

function get(lojaId: number): Breaker {
  let b = breakers.get(lojaId);
  if (!b) {
    b = { state: "CLOSED", failureCount: 0, successCount: 0, openedAt: 0 };
    breakers.set(lojaId, b);
  }
  return b;
}

function currentState(b: Breaker): CircuitState {
  if (b.state === "OPEN" && Date.now() - b.openedAt >= HALF_OPEN_TIMEOUT_MS) {
    b.state = "HALF_OPEN";
    b.successCount = 0;
  }
  return b.state;
}

export function canCall(lojaId: number): boolean {
  return currentState(get(lojaId)) !== "OPEN";
}

export function onSuccess(lojaId: number): void {
  const b = get(lojaId);
  b.failureCount = 0;
  if (b.state === "HALF_OPEN") {
    b.successCount++;
    if (b.successCount >= SUCCESS_THRESHOLD) {
      b.state = "CLOSED";
      console.log(JSON.stringify({ event: "meta_circuit_closed", lojaId }));
    }
  }
}

export function onFailure(lojaId: number): void {
  const b = get(lojaId);
  b.failureCount++;
  if (b.state === "HALF_OPEN" || b.failureCount >= FAILURE_THRESHOLD) {
    b.state = "OPEN";
    b.openedAt = Date.now();
    console.log(JSON.stringify({ event: "meta_circuit_opened", lojaId, failureCount: b.failureCount }));
  }
}

export function getState(lojaId: number): CircuitState {
  return currentState(get(lojaId));
}

export function getAllStates(): Record<string, { state: CircuitState; failures: number }> {
  const out: Record<string, { state: CircuitState; failures: number }> = {};
  for (const [id, b] of breakers) {
    out[String(id)] = { state: currentState(b), failures: b.failureCount };
  }
  return out;
}
