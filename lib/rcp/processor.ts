import { db } from "@/lib/db/firestore";
import { RCPEvent, RCPEventType } from "./types";
import { DEFAULT_GLOBAL_RCP } from "./schemas/global";
import { DEFAULT_CONVERSATION_RCP } from "./schemas/conversation";
import { invalidateRCPCache } from "./compiler";

export async function processEvent(event: RCPEvent): Promise<void> {
  const { id: eventId, userId, type, data } = event;
  const now = new Date().toISOString();

  // 1. Event deduplication check
  const eventRef = db.collection("users").doc(userId).collection("events").doc(eventId);
  const eventDoc = await eventRef.get();
  if (eventDoc.exists && eventDoc.data()?.processed) {
    console.log(`[RCP Processor] Event ${eventId} is already processed. Skipping.`);
    return;
  }

  // 2. Get Firestore Document References
  const globalRef = db.collection("users").doc(userId).collection("context").doc("global");
  
  // Scoped to conversation context if conversationId exists
  const getConvRef = (convId: string) => {
    return db
      .collection("users")
      .doc(userId)
      .collection("conversations")
      .doc(convId)
      .collection("context")
      .doc("rcp");
  };

  const getGlobalDoc = async () => {
    const doc = await globalRef.get();
    if (!doc.exists) {
      const initial = { ...DEFAULT_GLOBAL_RCP, updatedAt: now };
      await globalRef.set(initial);
      return initial;
    }
    return doc.data() as any;
  };

  const getConvDoc = async (convId: string) => {
    const ref = getConvRef(convId);
    const doc = await ref.get();
    if (!doc.exists) {
      const def = DEFAULT_CONVERSATION_RCP(convId);
      await ref.set(def);
      return def;
    }
    return doc.data() as any;
  };

  console.log(`[RCP Processor] Processing event ${type} (ID: ${eventId}) for user ${userId}`);

  // 3. Process the event and update only the affected RCP sections
  switch (type) {
    case "email_sent": {
      await getGlobalDoc();
      const updateData: any = {
        "gmail.lastOutreach": data.sentAt || now,
        "updatedAt": now,
      };

      if (data.contactId || data.recipient) {
        const contactKey = (data.contactId || data.recipient).replace(/\./g, "_");
        updateData[`contacts.status.${contactKey}`] = data.status || "awaiting_reply";
      }

      // Remove from pending follow ups if applicable
      if (data.followUpId) {
        const globalData = await getGlobalDoc();
        const pending = globalData.followUps?.pending || [];
        updateData["followUps.pending"] = pending.filter((id: string) => id !== data.followUpId);
      }

      await globalRef.update(updateData);

      if (data.conversationId) {
        await getConvDoc(data.conversationId);
        const actionStr = `Sent email to ${data.recipient || "contact"} regarding "${data.subject || "outreach"}"`;
        const convRef = getConvRef(data.conversationId);
        const convData = await getConvDoc(data.conversationId);
        const actions = [...(convData.recentActions || [])];
        if (!actions.includes(actionStr)) {
          actions.push(actionStr);
          await convRef.update({
            recentActions: actions.slice(-10),
            updatedAt: now,
          });
        }
      }
      break;
    }

    case "email_received": {
      await getGlobalDoc();
      const globalData = await getGlobalDoc();
      const currentUnread = globalData.gmail?.unreadCount || 0;
      await globalRef.update({
        "gmail.unreadCount": typeof data.unreadCount === "number" ? data.unreadCount : currentUnread + 1,
        "updatedAt": now,
      });

      if (data.conversationId) {
        await getConvDoc(data.conversationId);
        const actionStr = `Received email from ${data.sender || "contact"}: "${data.subject || "reply"}"`;
        const convRef = getConvRef(data.conversationId);
        const convData = await getConvDoc(data.conversationId);
        const actions = [...(convData.recentActions || [])];
        const entities = [...(convData.entities || [])];
        
        if (!actions.includes(actionStr)) {
          actions.push(actionStr);
        }
        if (data.sender && !entities.includes(data.sender)) {
          entities.push(data.sender);
        }

        await convRef.update({
          recentActions: actions.slice(-10),
          entities: entities.slice(-20),
          updatedAt: now,
        });
      }
      break;
    }

    case "contact_created": {
      await getGlobalDoc();
      const globalData = await getGlobalDoc();
      const prospects = [...(globalData.contacts?.topProspects || [])];
      if (data.name && !prospects.includes(data.name)) {
        prospects.push(data.name);
      }
      
      const updateData: any = {
        "contacts.topProspects": prospects.slice(0, 10),
        "updatedAt": now,
      };
      if (data.status) {
        const contactKey = (data.contactId || data.name).replace(/\./g, "_");
        updateData[`contacts.status.${contactKey}`] = data.status;
      }
      await globalRef.update(updateData);

      if (data.conversationId) {
        await getConvDoc(data.conversationId);
        const convRef = getConvRef(data.conversationId);
        const convData = await getConvDoc(data.conversationId);
        const entities = [...(convData.entities || [])];
        if (data.name && !entities.includes(data.name)) {
          entities.push(data.name);
        }
        await convRef.update({
          entities: entities.slice(-20),
          updatedAt: now,
        });
      }
      break;
    }

    case "contact_updated": {
      await getGlobalDoc();
      const updateData: any = {
        "updatedAt": now,
      };
      if (data.status || data.relationshipStatus) {
        const contactKey = (data.contactId || data.name || "unknown").replace(/\./g, "_");
        updateData[`contacts.status.${contactKey}`] = data.status || data.relationshipStatus;
      }
      
      if (data.name) {
        const globalData = await getGlobalDoc();
        const prospects = [...(globalData.contacts?.topProspects || [])];
        if (data.isTopProspect && !prospects.includes(data.name)) {
          prospects.push(data.name);
          updateData["contacts.topProspects"] = prospects.slice(0, 10);
        }
      }
      await globalRef.update(updateData);
      break;
    }

    case "opportunity_created": {
      await getGlobalDoc();
      const globalData = await getGlobalDoc();
      const currentActive = globalData.opportunities?.active || 0;
      
      await globalRef.update({
        "opportunities.active": typeof data.activeCount === "number" ? data.activeCount : currentActive + 1,
        "updatedAt": now,
      });

      if (data.conversationId) {
        await getConvDoc(data.conversationId);
        const actionStr = `Opportunity detected: "${data.title || "new lead"}"`;
        const convRef = getConvRef(data.conversationId);
        const convData = await getConvDoc(data.conversationId);
        const actions = [...(convData.recentActions || [])];
        if (!actions.includes(actionStr)) {
          actions.push(actionStr);
          await convRef.update({
            recentActions: actions.slice(-10),
            updatedAt: now,
          });
        }
      }
      break;
    }

    case "follow_up_created": {
      await getGlobalDoc();
      const globalData = await getGlobalDoc();
      const currentDue = globalData.gmail?.followUpsDue || 0;
      const pending = [...(globalData.followUps?.pending || [])];
      
      const followUpTitle = data.title || `Follow-up ${data.followUpId}`;
      if (!pending.includes(followUpTitle)) {
        pending.push(followUpTitle);
      }

      await globalRef.update({
        "gmail.followUpsDue": currentDue + 1,
        "followUps.pending": pending,
        "updatedAt": now,
      });
      break;
    }

    case "follow_up_completed": {
      await getGlobalDoc();
      const globalData = await getGlobalDoc();
      const currentDue = globalData.gmail?.followUpsDue || 0;
      const pending = [...(globalData.followUps?.pending || [])];
      
      const followUpTitle = data.title || `Follow-up ${data.followUpId}`;
      const updatedPending = pending.filter(p => p !== followUpTitle && p !== data.followUpId);

      await globalRef.update({
        "gmail.followUpsDue": Math.max(0, currentDue - 1),
        "followUps.pending": updatedPending,
        "updatedAt": now,
      });
      break;
    }

    case "conversation_updated": {
      if (data.conversationId) {
        await getConvDoc(data.conversationId);
        const convRef = getConvRef(data.conversationId);
        const updateData: any = {
          updatedAt: now,
        };
        if (data.goal !== undefined) updateData.goal = data.goal;
        if (data.summary !== undefined) updateData.summary = data.summary;
        if (data.entities !== undefined) updateData.entities = data.entities;
        if (data.recentActions !== undefined) updateData.recentActions = data.recentActions;

        await convRef.update(updateData);
      }
      break;
    }

    case "profile_updated": {
      await getGlobalDoc();
      const updateData: any = {
        "updatedAt": now,
      };
      if (data.startup !== undefined) updateData["profile.startup"] = data.startup;
      if (data.description !== undefined) updateData["profile.description"] = data.description;
      if (data.targetAudience !== undefined) updateData["profile.targetAudience"] = data.targetAudience;

      await globalRef.update(updateData);
      break;
    }

    default:
      console.warn(`[RCP Processor] Unhandled event type: ${type}`);
  }

  // 4. Invalidate cache on context updates
  invalidateRCPCache(userId, data?.conversationId);

  // 5. Mark the event as processed in Firestore
  await eventRef.set({ processed: true, processedAt: now }, { merge: true });
}

export async function publishRCPEvent(userId: string, type: RCPEventType, data: any) {
  const eventRef = db.collection("users").doc(userId).collection("events").doc();
  const event: RCPEvent = {
    id: eventRef.id,
    type,
    userId,
    timestamp: new Date().toISOString(),
    data,
  };

  await eventRef.set({ ...event, processed: false });
  await processEvent(event);
  return event;
}
