import { GlobalRCP } from "../types";

export const DEFAULT_GLOBAL_RCP: GlobalRCP = {
  version: "1.0",
  updatedAt: new Date().toISOString(),
  profile: {},
  gmail: {
    unreadCount: 0,
    followUpsDue: 0,
  },
  contacts: {
    topProspects: [],
    status: {},
  },
  opportunities: {
    active: 0,
  },
  followUps: {
    pending: [],
  },
};

export function validateGlobalRCP(data: any): GlobalRCP {
  return {
    version: "1.0",
    updatedAt: data?.updatedAt || new Date().toISOString(),
    profile: {
      startup: data?.profile?.startup || "",
      description: data?.profile?.description || "",
      targetAudience: Array.isArray(data?.profile?.targetAudience) ? data.profile.targetAudience : [],
    },
    gmail: {
      unreadCount: typeof data?.gmail?.unreadCount === "number" ? data.gmail.unreadCount : 0,
      followUpsDue: typeof data?.gmail?.followUpsDue === "number" ? data.gmail.followUpsDue : 0,
      lastOutreach: data?.gmail?.lastOutreach || undefined,
    },
    contacts: {
      topProspects: Array.isArray(data?.contacts?.topProspects) ? data.contacts.topProspects : [],
      status: data?.contacts?.status || {},
    },
    opportunities: {
      active: typeof data?.opportunities?.active === "number" ? data.opportunities.active : 0,
    },
    followUps: {
      pending: Array.isArray(data?.followUps?.pending) ? data.followUps.pending : [],
    },
  };
}
