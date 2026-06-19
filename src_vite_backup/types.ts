export interface User {
  name: string;
  company: string;
  avatar: string;
}

export interface GoalMetrics {
  reached: number;
  responses: number;
  meetings: number;
  target: number;
}

export interface Goal {
  id: string;
  name: string;
  desc: string;
  icon: string;
  progress: number;
  metrics: GoalMetrics;
  recommendedActions: string[];
}

export type RelationshipStatus = 'undiscovered' | 'researched' | 'outreach' | 'active' | 'scheduled' | 'stale';

export interface TimelineItem {
  type: 'received' | 'sent' | 'note' | 'meeting';
  label: string;
  date: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  status: RelationshipStatus;
  relevance: number;
  relevanceReason: string;
  whyMatter: string;
  goalId: string;
  tags: string[];
  insights: string[];
  timeline: TimelineItem[];
  draftOutreach: string;
  nextAction: string;
}

export interface BriefingItem {
  id: string;
  type: 'reply' | 'followup' | 'discovery' | 'milestone';
  title: string;
  desc: string;
  meta: string;
  targetId: string;
}
