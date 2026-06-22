import { buildRCP } from "../compiler";

export async function exportRCP(
  userId: string,
  conversationId: string
): Promise<{ filename: string; content: string }> {
  const content = await buildRCP(userId, conversationId);
  return {
    filename: "conversation.rcp",
    content,
  };
}
