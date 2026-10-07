import type { Campaign, CampaignResult, Creator } from "./company-data";

type DirectoryCreator = {
  id: string; name: string; category: string; city: string; bio: string; photo_url: string; cover_url: string; indicative_fee: string | null;
  accounts: { platform: string; handle: string; metrics: { observed_on: string; followers: number; engagement_rate: string; growth_rate: string; average_reach: number } | null;
    audience: { locations: { country: string; percent: number }[]; age_groups: { range: string; percent: number }[] } | null }[];
  content: { id: string; title: string; type: string; media_url: string | null; published_at: string | null; reach: number | null; engagements: number | null }[];
  ideas: { id: string; title: string; rationale: string; hashtags: string[] }[];
};
type BackendCampaign = {
  id: string; name: string; budget: string; status: string; creator_ids: string[]; objective: string; category: string;
  start_date: string | null; end_date: string | null; brief: string; deliverables: string; completed_milestones: string[]; is_sample: boolean;
};
type Snapshot = {
  saved?: string[];
  company: { name: string; industry: string; contact: string }; creators: DirectoryCreator[]; campaigns: BackendCampaign[];
  results: { creator_id: string; campaign_id: string; reach: number; engagements: number; spend: string; clicks: number }[];
};

export async function loadSampleWorkspace(signal: AbortSignal, demoOnly = false) {
  const session = demoOnly ? null : await fetch("/api/backend/auth/me", { cache: "no-store", signal });
  if (session && !session.ok && session.status !== 401) throw new Error("Could not check your session. Please retry.");
  const authenticated = session?.ok || false;
  const response = await fetch(authenticated ? "/api/backend/workspace/snapshot" : "/api/demo", { cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Could not load the sample workspace.");
  const snapshot = data as Snapshot;
  const creators: Creator[] = snapshot.creators.map((item) => {
    const account = item.accounts[0];
    return { id: item.id, name: item.name, category: item.category, city: item.city, bio: item.bio,
      photo: item.photo_url, cover: item.cover_url, fee: Number(item.indicative_fee || 0),
      observedOn: account?.metrics?.observed_on || null, locations: account?.audience?.locations || [], ageGroups: account?.audience?.age_groups || [],
      content: item.content.map((post) => ({ id: post.id, title: post.title, type: post.type, mediaUrl: post.media_url || item.cover_url,
        publishedAt: post.published_at, reach: post.reach, engagements: post.engagements })), ideas: item.ideas,
      platform: account?.platform === "youtube" ? "YouTube" : "Instagram", handle: `@${account?.handle || ""}`,
      followers: account?.metrics?.followers || 0, engagement: Number(account?.metrics?.engagement_rate || 0),
      growth: Number(account?.metrics?.growth_rate || 0), reach: account?.metrics?.average_reach || 0,
      india: account?.audience?.locations.find((location) => location.country === "IN")?.percent || 0 };
  });
  const campaigns: Campaign[] = snapshot.campaigns.map((item) => ({ id: item.id, name: item.name, budget: Number(item.budget),
    status: (item.status[0].toUpperCase() + item.status.slice(1)) as Campaign["status"], creators: item.creator_ids,
    objective: item.objective, category: item.category, start: item.start_date || "", end: item.end_date || "",
    brief: item.brief, deliverables: item.deliverables, checked: item.completed_milestones, sample: item.is_sample }));
  const results: CampaignResult[] = snapshot.results.map((item) => ({ creator: item.creator_id, campaign: item.campaign_id,
    reach: item.reach, engagements: item.engagements, clicks: item.clicks, spend: Number(item.spend) }));
  return { company: snapshot.company, creators, campaigns, results, authenticated, saved: snapshot.saved || [] };
}

export async function workspaceRequest(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/backend${path}`, { method, headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "The request could not be saved. Please check the fields and retry.");
  return data;
}
