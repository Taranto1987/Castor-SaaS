import { db, chatEventsTable } from "@workspace/db";
import type { ChatEventType } from "./types";

export function emitEvent(event: ChatEventType): void {
  const { type, sessionId, lojaId, ...payload } = event as {
    type: string;
    sessionId: string;
    lojaId: number;
    [key: string]: unknown;
  };

  setImmediate(async () => {
    try {
      await db.insert(chatEventsTable).values({
        eventType: type,
        sessionId,
        lojaId,
        payload,
      });
    } catch (err) {
      console.error("[Events] Failed to persist event:", type, err);
    }
  });
}
