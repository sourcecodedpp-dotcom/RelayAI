/**
 * Command Logger — Fire-and-Forget Command History Writer
 *
 * Stores commands separately from conversations.
 * Only records: userId, command text, missionId, intent, outcomeType.
 * No raw prompts or model responses stored.
 */

import { db } from "@/lib/db/firestore";

export class CommandLogger {
  /**
   * Logs a command to the command_history collection.
   * Fire-and-forget — does not block the response pipeline.
   */
  static logCommand(
    userId: string,
    command: string,
    missionId: string | null,
    intent: string,
    outcomeType: "redirect" | "display" | "action" | "error",
    targetContactId?: string | null
  ): void {
    // Fire-and-forget: we don't await this
    db.collection("command_history")
      .add({
        userId,
        command,
        missionId: missionId || null,
        intent,
        outcomeType,
        targetContactId: targetContactId || null,
        createdAt: new Date().toISOString(),
      })
      .then((ref) => {
        console.log(
          `[CommandLogger] Logged command "${command.substring(0, 40)}..." → ${ref.id}`
        );
      })
      .catch((err) => {
        console.warn("[CommandLogger] Failed to log command:", err);
      });
  }
}

export default CommandLogger;
