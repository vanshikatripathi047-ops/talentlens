export type Creator = {
  id: string;
  name: string;
  handle: string;
  category: string;
  platform: "Instagram" | "YouTube";
  city: string;
  followers: number;
  engagement: number;
  growth: number;
  fee: number;
  reach: number;
  india: number;
  photo: string;
  cover: string;
  bio: string;
  observedOn: string | null;
  locations: { country: string; percent: number }[];
  ageGroups: { range: string; percent: number }[];
  content: { id: string; title: string; type: string; mediaUrl: string; publishedAt: string | null; reach: number | null; engagements: number | null }[];
  ideas: { id: string; title: string; rationale: string; hashtags: string[] }[];
};

export type Campaign = {
  id: string;
  name: string;
  budget: number;
  status: "Draft" | "Planning" | "Active" | "Completed";
  creators: string[];
  objective: string;
  category: string;
  start: string;
  end: string;
  brief: string;
  deliverables: string;
  checked: string[];
  sample?: boolean;
};

export type CampaignResult = { creator: string; campaign: string; reach: number; engagements: number; spend: number; clicks: number };
export const steps = ["Brief approved", "Creators confirmed", "Content approved", "Published", "Results reviewed"];
export const categories = ["Lifestyle", "Technology", "Fitness", "Travel", "Beauty", "Food"];
export const compact = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
export const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
export function imageUrl(id: string, width = 600) {
  const url = new URL(id.startsWith("https://") ? id : `https://images.unsplash.com/${id}`);
  if (url.hostname === "images.unsplash.com") {
    url.searchParams.set("w", String(width));
    url.searchParams.set("auto", "format");
    url.searchParams.set("fit", "crop");
    url.searchParams.set("q", "80");
  }
  return url.toString();
}

export function score(creator: Creator, category: string) {
  const engagement = Math.min(100, creator.engagement * 10);
  const growth = Math.min(100, creator.growth * 5);
  const relevance = category === "All categories" || category === creator.category ? 100 : 35;
  return { engagement, growth, relevance, total: Math.round(engagement * 0.4 + growth * 0.2 + creator.india * 0.2 + relevance * 0.2) };
}

export function campaignMetrics(campaign: Campaign, creators: Creator[]) {
  const participants = creators.filter((creator) => campaign.creators.includes(creator.id));
  return { participants, plannedFees: participants.reduce((sum, creator) => sum + creator.fee, 0),
    plannedReach: participants.reduce((sum, creator) => sum + creator.reach, 0) };
}
