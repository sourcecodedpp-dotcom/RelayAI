import "@/lib/env";
import { publishRCPEvent, processEvent } from "@/lib/rcp/processor";
import { buildRCP } from "@/lib/rcp/compiler";
import { exportRCP } from "@/lib/rcp/exporters/rcp-exporter";
import { db } from "@/lib/db/firestore";

async function runTests() {
  const userId = "test_user_rcp_123";
  const conversationId = "test_conv_rcp_456";

  console.log("🚀 Starting RCP v1 Test Harness...");

  // Clean up any existing test context docs to start fresh
  const globalRef = db.collection("users").doc(userId).collection("context").doc("global");
  const convRef = db.collection("users").doc(userId).collection("conversations").doc(conversationId).collection("context").doc("rcp");
  
  await globalRef.delete().catch(() => {});
  await convRef.delete().catch(() => {});

  // 1. Dispatch profile_updated event
  console.log("\n--- Test 1: profile_updated event ---");
  await publishRCPEvent(userId, "profile_updated", {
    startup: "Dharaa",
    description: "Climate intelligence platform mapping carbon offsets",
    targetAudience: ["Founders", "Sustainability VCs", "Corporate Buyers"],
  });

  // Verify Global RCP doc got updated
  const globalDocAfterProfile = await globalRef.get();
  console.log("Global context exists:", globalDocAfterProfile.exists);
  console.log("Profile data in DB:", JSON.stringify(globalDocAfterProfile.data()?.profile));
  if (globalDocAfterProfile.data()?.profile?.startup !== "Dharaa") {
    throw new Error("Profile startup did not update correctly!");
  }

  // 2. Dispatch contact_created event
  console.log("\n--- Test 2: contact_created event ---");
  await publishRCPEvent(userId, "contact_created", {
    contactId: "contact_999",
    name: "Tata AIG",
    email: "outreach@tataaig.com",
    company: "Tata AIG Insurance",
    status: "discovered",
  });

  const globalDocAfterContact = await globalRef.get();
  console.log("Prospects list:", globalDocAfterContact.data()?.contacts?.topProspects);
  console.log("Contact status mapping:", globalDocAfterContact.data()?.contacts?.status);
  if (!globalDocAfterContact.data()?.contacts?.topProspects?.includes("Tata AIG")) {
    throw new Error("Contact was not added to topProspects!");
  }

  // 3. Dispatch follow_up_created and completed events
  console.log("\n--- Test 3: follow-up events ---");
  await publishRCPEvent(userId, "follow_up_created", {
    followUpId: "follow_1",
    title: "Send pitch deck to Tata AIG",
    contactId: "contact_999",
  });

  let globalDocAfterFollowUp = await globalRef.get();
  console.log("Pending follow-ups after creation:", globalDocAfterFollowUp.data()?.followUps?.pending);
  console.log("Followups due count:", globalDocAfterFollowUp.data()?.gmail?.followUpsDue);
  if (globalDocAfterFollowUp.data()?.gmail?.followUpsDue !== 1) {
    throw new Error("Follow-ups due count is incorrect!");
  }

  // Complete the follow up
  await publishRCPEvent(userId, "follow_up_completed", {
    followUpId: "follow_1",
    title: "Send pitch deck to Tata AIG",
  });

  globalDocAfterFollowUp = await globalRef.get();
  console.log("Pending follow-ups after completion:", globalDocAfterFollowUp.data()?.followUps?.pending);
  console.log("Followups due count after completion:", globalDocAfterFollowUp.data()?.gmail?.followUpsDue);
  if (globalDocAfterFollowUp.data()?.gmail?.followUpsDue !== 0) {
    throw new Error("Follow-ups due count did not decrement!");
  }

  // 4. Dispatch email_sent event
  console.log("\n--- Test 4: email_sent event ---");
  await publishRCPEvent(userId, "email_sent", {
    recipient: "Tata AIG",
    subject: "Following up on carbon offsets",
    sentAt: "2026-06-21T18:45:00Z",
    status: "awaiting_reply",
    conversationId,
  });

  const globalDocAfterEmail = await globalRef.get();
  console.log("Last outreach timestamp:", globalDocAfterEmail.data()?.gmail?.lastOutreach);
  console.log("Contact Tata AIG status in DB:", globalDocAfterEmail.data()?.contacts?.status?.Tata_AIG);
  if (globalDocAfterEmail.data()?.gmail?.lastOutreach !== "2026-06-21T18:45:00Z") {
    throw new Error("gmail.lastOutreach did not update correctly!");
  }

  // 5. Test Event Deduplication
  console.log("\n--- Test 5: Event Deduplication ---");
  const testEventId = "duplicate_event_test_123";
  const eventRef = db.collection("users").doc(userId).collection("events").doc(testEventId);
  await eventRef.delete().catch(() => {});

  const testEvent = {
    id: testEventId,
    type: "opportunity_created" as const,
    userId,
    timestamp: new Date().toISOString(),
    data: {
      activeCount: 5,
      conversationId,
    },
  };

  // Run processor twice
  await processEvent(testEvent);
  await processEvent(testEvent);

  const globalDocAfterDup = await globalRef.get();
  console.log("Opportunities active count:", globalDocAfterDup.data()?.opportunities?.active);
  if (globalDocAfterDup.data()?.opportunities?.active !== 5) {
    throw new Error("Opportunities count did not set to 5!");
  }

  // 6. Test RCP Compilation & Priorities
  console.log("\n--- Test 6: buildRCP compilation & Priorities ---");
  // Set up conversation context
  await publishRCPEvent(userId, "conversation_updated", {
    conversationId,
    goal: "Find climate-tech investors",
    summary: "Dharaa carbon offsets discussion",
    entities: ["Tata AIG"],
    recentActions: ["Created outreach draft", "Emailed Tata AIG"],
  });

  // Verify compiled RCP output
  const rcpOutput = await buildRCP(userId, conversationId, 8000);
  console.log("\n=== Generated RCP Output ===");
  console.log(rcpOutput);
  console.log("============================");

  if (!rcpOutput.includes("RCP/1.0")) {
    throw new Error("Compiled output does not start with RCP/1.0!");
  }
  if (!rcpOutput.includes("PROFILE")) {
    throw new Error("PROFILE section missing!");
  }
  if (!rcpOutput.includes("CONVERSATION active")) {
    throw new Error("CONVERSATION section missing!");
  }

  // 7. Test Export
  console.log("\n--- Test 7: Export RCP ---");
  const exportResult = await exportRCP(userId, conversationId);
  console.log("Exported file:", exportResult.filename);
  console.log("Exported content length:", exportResult.content.length);

  // Clean up
  console.log("\nCleaning up test collections...");
  await globalRef.delete().catch(() => {});
  await convRef.delete().catch(() => {});
  await eventRef.delete().catch(() => {});

  console.log("\n🎉 RCP v1 Tests Passed Successfully!");
}

runTests().catch((err) => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
