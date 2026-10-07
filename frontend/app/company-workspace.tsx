"use client";

/* Sample media is served directly; no production image pipeline is connected. */
/* eslint-disable @next/next/no-img-element */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Bookmark, CalendarDays, Camera as Instagram, Check, ChevronRight, CircleHelp, Compass, Download, FileText, LayoutDashboard, ListFilter, Megaphone, Plus, Search, Settings, SlidersHorizontal, Sparkles, Target, TrendingUp, Users, X, Video as Youtube } from "lucide-react";
import { campaignMetrics as calculateCampaignMetrics, categories, compact, imageUrl, money, score, steps, type Campaign, type Creator, type CampaignResult } from "./company-data";
import { loadSampleWorkspace, workspaceRequest } from "./company-api";
import CompanySignIn from "./company-sign-in";
import "./company.css";
import "./company-premium.css";
import InvestmentOverview from "./investment-overview";
import "./company-signature.css";

type Page = "overview" | "discover" | "shortlist" | "compare" | "campaigns" | "planner" | "campaign" | "profile" | "results" | "reports" | "settings";
const pages: Page[] = ["overview", "discover", "shortlist", "compare", "campaigns", "planner", "campaign", "profile", "results", "reports", "settings"];
const pageTitles: Record<Page, string> = { overview: "Company overview", discover: "Creator discovery", shortlist: "Your shortlist", compare: "Creator comparison", campaigns: "Campaign workspace", planner: "Campaign planner", campaign: "Campaign detail", profile: "Creator profile", results: "Performance & results", reports: "Executive reports", settings: "Workspace settings" };
const descriptions: Record<Page, string> = { overview: "Your creator portfolio, campaigns, and investment performance.", discover: "Find voices that fit your brand. Understand what makes them stand out.", shortlist: "A considered collection of your next potential partners.", compare: "Trade-offs made clear. Find the right mix for your campaign.", campaigns: "From the first brief to the final result, all in one place.", planner: "Turn an ambition into a clear, costed creator plan.", campaign: "Keep the brief, budget, and next steps aligned.", profile: "The audience behind the influence.", results: "See where your investment is making a difference.", reports: "The story behind the numbers, ready for your next review.", settings: "Your company identity and reporting preferences." };
const navigation = [
  { page: "overview", label: "Overview", icon: LayoutDashboard },
  { page: "discover", label: "Discover creators", icon: Compass },
  { page: "shortlist", label: "Shortlist", icon: Bookmark },
  { page: "compare", label: "Compare", icon: Users },
  { page: "campaigns", label: "Campaigns", icon: Megaphone },
  { page: "results", label: "Performance", icon: BarChart3 },
  { page: "reports", label: "Reports", icon: FileText },
] as const;

function download(name: string, rows: (string | number)[][]) {
  const content = rows.map((row) => row.map((value) => {
    const text = String(value);
    return `"${/^[=+\-@]/.test(text) ? "'" : ""}${text.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Platform({ creator }: { creator: Creator }) {
  const Icon = creator.platform === "Instagram" ? Instagram : Youtube;
  return <span className={`co-platform ${creator.platform.toLowerCase()}`}><Icon size={13} />{creator.platform}</span>;
}

function Stat({ label, value, note, icon }: { label: string; value: string; note: string; icon?: ReactNode }) {
  return <div className="co-stat"><div>{label}{icon}</div><strong>{value}</strong><small>{note}</small></div>;
}

function Empty({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="co-empty"><Compass size={28} /><h2>{title}</h2><p>{description}</p>{action && <button className="co-primary" onClick={onAction}>{action}<ArrowRight size={16} /></button>}</div>;
}

const CompanyContext = createContext<{
  go: (page: Page, id?: string) => void;
  creators: Creator[];
  saved: string[];
  comparison: string[];
  category: string;
  shortlist: (id: string) => void;
  toggleComparison: (id: string) => void;
} | null>(null);

function CreatorCard({ creator }: { creator: Creator }) {
  const { go, saved, comparison, category, shortlist, toggleComparison } = useContext(CompanyContext)!;
  return <article className="co-creator-card">
    <button className="co-card-media" onClick={() => go("profile", String(creator.id))} aria-label={`View ${creator.name}`}><img src={imageUrl(creator.cover)} alt={`${creator.category} sample content`} /><span className="co-category">{creator.category}</span></button>
    <button className="co-save" title={saved.includes(creator.id) ? "Remove from shortlist" : "Save creator"} aria-label={`Shortlist ${creator.name}`} aria-pressed={saved.includes(creator.id)} onClick={() => shortlist(creator.id)}><Bookmark size={17} fill={saved.includes(creator.id) ? "currentColor" : "none"} /></button>
    <div className="co-card-body"><div className="co-identity"><img src={imageUrl(creator.photo, 100)} alt="" /><button onClick={() => go("profile", String(creator.id))}><strong>{creator.name}</strong><small>{creator.handle}</small></button><Platform creator={creator} /></div>
    <p className="co-card-location">{creator.city}, India <span>{money(creator.fee)} / placement</span></p>
    <div className="co-card-metrics"><div><strong>{compact(creator.followers)}</strong><span>Followers</span></div><div><strong>{creator.engagement}%</strong><span>Engagement</span></div><div><strong className="co-green">{score(creator, category).total}<small>/100</small></strong><span>Sample fit</span></div></div>
    <div className="co-card-footer"><label><input type="checkbox" aria-label={`Compare ${creator.name}`} checked={comparison.includes(creator.id)} disabled={comparison.length >= 3 && !comparison.includes(creator.id)} onChange={() => toggleComparison(creator.id)} />Compare</label><button onClick={() => go("profile", String(creator.id))}>View profile <ArrowUpRight size={15} /></button></div></div>
  </article>;
}

function CampaignList({ items }: { items: Campaign[] }) {
  const { go, creators } = useContext(CompanyContext)!;
  return <div className="co-table-wrap"><table className="co-table"><thead><tr><th>Campaign</th><th>Status</th><th>Creators</th><th>Budget</th><th>Progress</th><th>Timeline</th><th /></tr></thead><tbody>{items.map((campaign) => <tr key={campaign.id}><td><button className="co-name-button" onClick={() => go("campaign", campaign.id)}>{campaign.name}<small>{campaign.objective}{campaign.sample ? " / Sample" : " / Local draft"}</small></button></td><td><span className={`co-badge ${campaign.status.toLowerCase()}`}>{campaign.status}</span></td><td><div className="co-avatar-stack">{creators.filter((creator) => campaign.creators.includes(creator.id)).map((creator) => <img key={creator.id} src={imageUrl(creator.photo, 80)} alt={creator.name} title={creator.name} />)}{!campaign.creators.length && <span>Unassigned</span>}</div></td><td>{money(campaign.budget)}</td><td><div className="co-progress"><span style={{ width: `${campaign.checked.length * 20}%` }} /></div><small>{campaign.checked.length} / 5 milestones</small></td><td className="co-muted">{campaign.start || "Not scheduled"}<small>{campaign.end || ""}</small></td><td><button className="co-icon" title="Open campaign" aria-label={`Open ${campaign.name}`} onClick={() => go("campaign", campaign.id)}><ArrowUpRight size={17} /></button></td></tr>)}</tbody></table></div>;
}

export default function CompanyWorkspace({ onCreator }: { onCreator: () => void }) {
  const [page, setPage] = useState<Page>("overview");
  const [entity, setEntity] = useState("");
  const [creators, setCreators] = useState<Creator[]>([]);
  const [sampleResults, setSampleResults] = useState<CampaignResult[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [comparison, setComparison] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [company, setCompany] = useState({ name: "", industry: "", contact: "" });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("All platforms");
  const [category, setCategory] = useState("All categories");
  const [maxFee, setMaxFee] = useState(100000);
  const [sort, setSort] = useState("fit");
  const [layout, setLayout] = useState("cards");
  const [status, setStatus] = useState("All statuses");
  const [resultCampaign, setResultCampaign] = useState("all");
  const [planCreators, setPlanCreators] = useState<string[]>([]);
  const [planCategory, setPlanCategory] = useState("Lifestyle");
  const [planBudget, setPlanBudget] = useState(150000);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let mounted = true;
    const readHash = () => {
      const [route, id = ""] = window.location.hash.slice(1).split("/");
      setPage(pages.includes(route as Page) ? route as Page : "overview");
      try { setEntity(decodeURIComponent(id)); }
      catch { setEntity(""); }
    };
    const controller = new AbortController();
    queueMicrotask(readHash);
    loadSampleWorkspace(controller.signal).then((snapshot) => {
      if (!mounted) return;
      setCreators(snapshot.creators);
      setCampaigns(snapshot.campaigns);
      setCompany(snapshot.company);
      setSampleResults(snapshot.results);
      setAuthenticated(snapshot.authenticated);
      setSaved(snapshot.saved);
      setComparison((items) => items.length ? items.filter((id) => snapshot.creators.some((creator) => creator.id === id)) : snapshot.creators.slice(0, 2).map((creator) => creator.id));
      setReady(true);
      setLoadError("");
    }).catch((error: unknown) => {
      if (mounted) {
        const detail = error instanceof Error ? error.message : "Could not load sample data.";
        setLoadError(detail);
        setMessage(detail);
      }
    });
    window.addEventListener("hashchange", readHash);
    return () => { mounted = false; controller.abort(); window.removeEventListener("hashchange", readHash); };
  }, [reload]);

  function go(next: Page, id = "") {
    setPage(next);
    setEntity(id);
    window.location.hash = `${next}${id ? `/${encodeURIComponent(id)}` : ""}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function persist(action: () => Promise<unknown>) {
    if (!authenticated) { setSignIn(true); return; }
    if (busy) return;
    setBusy(true);
    try { await action(); setReload((value) => value + 1); }
    catch (problem) { setMessage(problem instanceof Error ? problem.message : "Changes could not be saved."); }
    finally { setBusy(false); }
  }
  function shortlist(id: string) {
    void persist(() => workspaceRequest(`/workspace/shortlist/${id}`, saved.includes(id) ? "DELETE" : "PUT"));
  }
  function toggleComparison(id: string) {
    setComparison((items) => items.includes(id) ? items.filter((item) => item !== id) : items.length < 3 ? [...items, id] : items);
  }
  function plan(ids = saved) { if (!authenticated) { setSignIn(true); return; } setPlanCreators(ids); go("planner"); }
  function updateCampaign(id: string, values: Partial<Campaign>) {
    void persist(() => workspaceRequest(`/workspace/campaigns/${id}`, "PATCH", {
      ...(values.status ? { status: values.status.toLowerCase() } : {}),
      ...(values.checked ? { completed_milestones: values.checked } : {}),
    }));
  }
  function removeCampaign(id: string) { if (!authenticated) { setSignIn(true); return; } setDeleteId(id); deleteDialog.current?.showModal(); }
  const activeCampaign = campaigns.find((item) => item.id === entity);
  const profile = creators.find((creator) => creator.id === entity);
  const campaignMetrics = (campaign: Campaign) => calculateCampaignMetrics(campaign, creators);
  const filteredCreators = creators.filter((creator) => `${creator.name} ${creator.handle} ${creator.category} ${creator.city}`.toLowerCase().includes(query.toLowerCase()) && (platform === "All platforms" || creator.platform === platform) && (category === "All categories" || creator.category === category) && creator.fee <= maxFee && (page !== "shortlist" || saved.includes(creator.id))).sort((a, b) => sort === "fee" ? a.fee - b.fee : sort === "engagement" ? b.engagement - a.engagement : sort === "followers" ? b.followers - a.followers : score(b, category).total - score(a, category).total);
  const selectedCreators = creators.filter((creator) => comparison.includes(creator.id));
  const planFees = creators.filter((creator) => planCreators.includes(creator.id)).reduce((sum, creator) => sum + creator.fee, 0);
  const results = sampleResults.filter((result) => campaigns.some((campaign) => campaign.id === result.campaign) && (page !== "results" || resultCampaign === "all" || result.campaign === resultCampaign));
  const reach = results.reduce((sum, result) => sum + result.reach, 0);
  const engagements = results.reduce((sum, result) => sum + result.engagements, 0);
  const spend = results.reduce((sum, result) => sum + result.spend, 0);

  function exportCreators() {
    download("talentlens-sample-creators.csv", [["Sample data", "Not verified profiles"], ["Name", "Platform", "Category", "Followers", "Engagement %", "Indicative fee INR", "Illustrative score"], ...filteredCreators.map((c) => [c.name, c.platform, c.category, c.followers, c.engagement, c.fee, score(c, category).total])]);
    setMessage("Creator CSV exported.");
  }
  function exportResults() {
    download("talentlens-sample-performance.csv", [["Sample results only", "No live platform data"], ["Campaign", "Creator", "Reach", "Engagements", "Spend INR", "Clicks"], ...results.map((result) => [campaigns.find((campaign) => campaign.id === result.campaign)?.name || result.campaign, creators.find((c) => c.id === result.creator)?.name || "", result.reach, result.engagements, result.spend, result.clicks])]);
    setMessage("Performance CSV exported.");
  }

  if (!ready) return <div className="co-empty" role="status"><BarChart3 size={30} /><h2>{loadError ? "Workspace unavailable" : "Loading your workspace"}</h2>{loadError && <><p>{loadError}</p><button className="co-primary" onClick={() => { setLoadError(""); setReload((value) => value + 1); }}>Retry <ArrowRight size={16} /></button></>}</div>;

  return <CompanyContext.Provider value={{ creators, go, saved, comparison, category, shortlist, toggleComparison }}><div className="co-shell">
    <aside className="co-sidebar"><button className="co-brand" onClick={() => go("overview")}><span className="co-brand-mark"><BarChart3 size={21} /></span>TalentLens<span>.</span></button><div className="co-company"><span className="co-company-avatar">{company.name.slice(0, 1)}</span><div><strong>{company.name}</strong><small>Company workspace</small></div></div><p className="co-nav-label">WORKSPACE</p><nav>{navigation.map(({ page: route, label, icon: Icon }) => <button className={`co-nav ${page === route || (route === "campaigns" && ["campaign", "planner"].includes(page)) || (route === "discover" && page === "profile") ? "active" : ""}`} key={route} onClick={() => go(route)}><Icon size={18} />{label}{route === "shortlist" && <span>{saved.length}</span>}</button>)}</nav><div className="co-sidebar-foot"><button className={`co-nav ${page === "settings" ? "active" : ""}`} onClick={() => go("settings")}><Settings size={18} />Workspace settings</button><div className="co-demo-label"><span />Demo environment</div><button className="co-account" onClick={() => go("settings")}><span className="co-company-avatar">{company.name.slice(0, 1)}</span><div><strong>{authenticated ? "Company administrator" : "Demo workspace"}</strong><small>{authenticated ? "Company account" : "Read-only access"}</small></div><ChevronRight size={15} /></button></div></aside>
    <div className="co-main"><header className="co-topbar"><div className="co-breadcrumb">Workspace<ChevronRight size={13} /><strong>{pageTitles[page]}</strong></div><div className="co-top-actions"><button className="co-secondary" disabled={busy} onClick={() => authenticated ? void workspaceRequest("/auth/logout", "POST").then(() => setReload((value) => value + 1)).catch((error) => setMessage(error.message)) : setSignIn(true)}>{authenticated ? "Sign out" : "Sign in"}</button><span className="co-live-label"><span />Sample data</span><select aria-label="Workspace role" value="brand" onChange={onCreator}><option value="brand">Company workspace</option><option value="creator">Creator studio</option></select><button className="co-icon" title="Data information" aria-label="Data information" onClick={() => setMessage("Sample analytics are served from PostgreSQL. Sign in to save your company plans.")}><CircleHelp size={18} /></button></div></header>
    <main className="co-content"><div className="co-page-head"><div><p className="co-eyebrow">TALENTLENS / COMPANY INTELLIGENCE</p><h1>{page === "overview" ? "Partnership overview" : pageTitles[page]}</h1><p>{descriptions[page]}</p></div><div className="co-head-actions">{["overview", "campaigns"].includes(page) && <button className="co-primary" onClick={() => plan()}><Plus size={17} />Create campaign</button>}{["discover", "shortlist"].includes(page) && <button className="co-secondary" onClick={exportCreators}><Download size={16} />Export creators</button>}{page === "results" && <button className="co-secondary" onClick={exportResults}><Download size={16} />Export results</button>}{page === "reports" && <button className="co-primary" onClick={() => window.print()}><Download size={16} />Print / Save PDF</button>}</div></div>
    <div className="co-sample-note"><span /><strong>{authenticated ? "Company workspace" : "Read-only demo"}</strong><span className="co-note-divider" />Profiles, rates, and results are sample data from PostgreSQL.</div>
    {message && <div className="co-toast" role="status"><Check size={16} />{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}><X size={16} /></button></div>}

    {page === "overview" && <>
      <InvestmentOverview creators={creators} campaigns={campaigns} saved={saved} reach={reach} engagements={engagements} spend={spend} onProfile={(id) => go("profile", String(id))} onSave={shortlist} onDiscover={() => go("discover")} />
      <section className="co-section"><div className="co-section-head"><div><h2>Campaigns in motion</h2><p>The brief, the people, and what comes next.</p></div><button className="co-text" onClick={() => go("campaigns")}>All campaigns <ArrowRight size={15} /></button></div>{campaigns.length ? <CampaignList items={campaigns.slice(0, 3)} /> : <Empty title="Your next campaign starts here" description="Create a brief and assemble your creator team." action="Create campaign" onAction={() => plan()} />}</section>
      <section className="co-section"><div className="co-section-head"><div><h2>Fresh perspectives for your brand</h2><p>Sample creator selection across lifestyle, fitness, and beauty.</p></div><button className="co-text" onClick={() => go("discover")}>Discover all <ArrowRight size={15} /></button></div><div className="co-creator-grid">{creators.filter((_, index) => index % 2 === 0).slice(0, 3).map((creator) => <CreatorCard key={creator.id} creator={creator} />)}</div></section>
    </>}

    {["discover", "shortlist"].includes(page) && <>
      <div className="co-discovery-tools"><label className="co-search"><Search size={18} /><input aria-label="Search creators" placeholder="Search by creator, niche, or city" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Sort creators" value={sort} onChange={(event) => setSort(event.target.value)}><option value="fit">Highest sample fit</option><option value="engagement">Highest engagement</option><option value="fee">Lowest indicative fee</option><option value="followers">Largest audience</option></select><div className="co-segments" aria-label="Discovery layout"><button aria-pressed={layout === "cards"} onClick={() => setLayout("cards")} title="Card view"><LayoutDashboard size={17} /></button><button aria-pressed={layout === "table"} onClick={() => setLayout("table")} title="Table view"><ListFilter size={17} /></button></div></div>
      <div className="co-filter-band"><SlidersHorizontal size={16} /><select aria-label="Platform filter" value={platform} onChange={(event) => setPlatform(event.target.value)}><option>All platforms</option><option>Instagram</option><option>YouTube</option></select><select aria-label="Category filter" value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select><label>Max. placement fee <input aria-label="Maximum placement fee" type="range" min={20000} max={100000} step={5000} value={maxFee} onChange={(event) => setMaxFee(Number(event.target.value))} /><strong>{money(maxFee)}</strong></label><button className="co-text" onClick={() => { setQuery(""); setPlatform("All platforms"); setCategory("All categories"); setMaxFee(100000); }}>Reset</button></div>
      <div className="co-section-head"><p>{filteredCreators.length} sample creators <span className="co-muted">/ fit weighted for India and {category === "All categories" ? "all categories" : category.toLowerCase()}</span></p>{page === "shortlist" && saved.length > 0 && <button className="co-primary" onClick={() => plan()}>Plan with shortlist <ArrowRight size={16} /></button>}</div>
      {!filteredCreators.length ? <Empty title="No matching creators" description="Adjust your filters, or discover more creators for your shortlist." action="Explore discovery" onAction={() => { setQuery(""); setPlatform("All platforms"); setCategory("All categories"); setMaxFee(100000); go("discover"); }} /> : layout === "cards" ? <div className="co-creator-grid">{filteredCreators.map((creator) => <CreatorCard creator={creator} key={creator.id} />)}</div> : <div className="co-table-wrap"><table className="co-table"><thead><tr><th>Creator</th><th>Category</th><th>Followers</th><th>Engagement</th><th>Indicative fee</th><th>Sample fit</th><th>Actions</th></tr></thead><tbody>{filteredCreators.map((creator) => <tr key={creator.id}><td><button className="co-table-identity" onClick={() => go("profile", String(creator.id))}><img src={imageUrl(creator.photo, 80)} alt="" /><span>{creator.name}<small>{creator.platform}</small></span></button></td><td>{creator.category}</td><td>{compact(creator.followers)}</td><td>{creator.engagement}%</td><td>{money(creator.fee)}</td><td className="co-green">{score(creator, category).total}/100</td><td><div className="co-table-actions"><button className="co-icon" aria-label={`Shortlist ${creator.name}`} aria-pressed={saved.includes(creator.id)} onClick={() => shortlist(creator.id)} title="Toggle shortlist"><Bookmark size={16} fill={saved.includes(creator.id) ? "currentColor" : "none"} /></button><input type="checkbox" aria-label={`Compare ${creator.name}`} checked={comparison.includes(creator.id)} disabled={comparison.length >= 3 && !comparison.includes(creator.id)} onChange={() => toggleComparison(creator.id)} /></div></td></tr>)}</tbody></table></div>}
      {comparison.length > 0 && <div className="co-comparison-bar"><div><Users size={18} /><strong>{comparison.length} / 3 selected</strong><span>{selectedCreators.map((creator) => creator.name.split(" ")[0]).join(" + ")}</span></div><button className="co-primary" onClick={() => go("compare")}>Compare creators <ArrowRight size={16} /></button></div>}
    </>}

    {page === "profile" && (profile ? <>
      <button className="co-back" onClick={() => go("discover")}><ArrowLeft size={15} />Back to discovery</button><section className="co-profile-header"><img className="co-profile-photo" src={imageUrl(profile.photo, 250)} alt={`Representative portrait of ${profile.name}`} /><div><div className="co-profile-heading"><h2>{profile.name}</h2><Platform creator={profile} /></div><p className="co-muted">{profile.handle} / {profile.city}, India / {profile.category}</p><p className="co-bio">{profile.bio}</p><small className="co-muted">Fictional profile / representative stock imagery</small></div><div className="co-profile-actions"><button className="co-primary" onClick={() => plan([profile.id])}>Plan a partnership <ArrowRight size={16} /></button><button className="co-secondary" onClick={() => shortlist(profile.id)}><Bookmark size={16} />{saved.includes(profile.id) ? "Remove from shortlist" : "Save to shortlist"}</button></div></section>
      <div className="co-stats"><Stat label="Followers" value={compact(profile.followers)} note={`${profile.platform} sample audience`} /><Stat label="Engagement rate" value={`${profile.engagement}%`} note="Illustrative engagements / followers" /><Stat label="Monthly growth" value={`+${profile.growth}%`} note="Sample monthly change" /><Stat label="Indicative placement" value={money(profile.fee)} note="Sample fee, not a quotation" /></div>
      <div className="co-profile-grid"><section><div className="co-section-head"><div><h2>The audience behind the content</h2><p>Illustrative audience distribution</p></div><Users size={20} /></div>{profile.locations.map(({ country: label, percent: value }) => <div className="co-audience-row" key={label}><div><span>{label}</span><strong>{value}%</strong></div><meter min={0} max={100} value={Number(value)} aria-label={`${label} audience share`} /></div>)}<div className="co-demographics"><div><span>Largest age group</span><strong>{[...profile.ageGroups].sort((a, b) => b.percent - a.percent)[0]?.range || "--"} years</strong><small>{[...profile.ageGroups].sort((a, b) => b.percent - a.percent)[0]?.percent ?? "--"}% of sample audience</small></div><div><span>Average reach</span><strong>{compact(profile.reach)}</strong><small>Per sample placement</small></div></div></section><section className="co-score-panel"><p className="co-eyebrow">EXPLAINABLE SAMPLE FIT</p><div className="co-score-value">{score(profile, category).total}<span>/100</span></div><p>India audience / {category.toLowerCase()}</p>{[["Engagement", score(profile, category).engagement, "40%"], ["Growth", score(profile, category).growth, "20%"], ["India audience", profile.india, "20%"], ["Category relevance", score(profile, category).relevance, "20%"]].map(([label, value, weight]) => <div className="co-score-row" key={label}><span>{label}<small>{weight} weight</small></span><strong>{Math.round(Number(value))}/100</strong></div>)}<small>Weighted illustration using sample inputs. Audience authenticity is unverified; this is not an investment recommendation.</small></section></div>
      <section className="co-section"><div className="co-section-head"><div><h2>Content direction</h2><p>Sample content records / not verified platform posts</p></div><span className="co-small-pill">{profile.category}</span></div><div className="co-content-concepts">{profile.content.map((post) => <article key={post.id}><img src={imageUrl(post.mediaUrl)} alt={post.title} /><div><span>{post.type.toUpperCase()} / SAMPLE</span><h3>{post.title}</h3><p>{post.reach === null ? "Editorial concept" : `${compact(post.reach)} reach / ${compact(post.engagements || 0)} engagements`}</p></div></article>)}</div></section>
    </> : <Empty title="Creator not found" description="This profile is not part of the sample directory." action="Back to discovery" onAction={() => go("discover")} />)}

    {page === "compare" && <><div className="co-section-head"><p className="co-muted">Select up to three creators / no audience-overlap data available</p><button className="co-secondary" onClick={() => go("discover")}><Plus size={16} />Change selection</button></div>{selectedCreators.length < 2 ? <Empty title="A better decision, side by side" description="Select two or three creators from discovery to compare their strengths." action="Select creators" onAction={() => go("discover")} /> : <><div className="co-compare-grid">{selectedCreators.map((creator) => <article key={creator.id}><button className="co-compare-remove" aria-label={`Remove ${creator.name} from comparison`} onClick={() => toggleComparison(creator.id)}><X size={16} /></button><img src={imageUrl(creator.photo, 150)} alt="" /><h2>{creator.name}</h2><Platform creator={creator} />{[["Category", creator.category], ["Followers", compact(creator.followers)], ["Engagement", `${creator.engagement}%`], ["Monthly growth", `${creator.growth}%`], ["India audience", `${creator.india}%`], ["Indicative fee", money(creator.fee)], ["Sample fit", `${score(creator, category).total}/100`]].map(([label, value]) => <div className="co-compare-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}<button className="co-text" onClick={() => go("profile", String(creator.id))}>View full profile <ArrowUpRight size={15} /></button></article>)}</div><div className="co-decision"><Sparkles size={20} /><div><h3>The trade-off</h3><p>{[...selectedCreators].sort((a, b) => b.engagement - a.engagement)[0].name} leads engagement; {[...selectedCreators].sort((a, b) => a.fee - b.fee)[0].name} has the lowest indicative fee. Combined audience size is not unique reach.</p></div><button className="co-primary" onClick={() => plan(comparison)}>Plan with these creators <ArrowRight size={15} /></button></div></>}</>}

    {page === "campaigns" && <><div className="co-stats">{["Draft", "Planning", "Active", "Completed"].map((value) => <Stat key={value} label={value} value={String(campaigns.filter((c) => c.status === value).length).padStart(2, "0")} note="Campaigns in this stage" />)}</div><div className="co-section-head"><h2>Campaign portfolio</h2><select aria-label="Campaign status filter" value={status} onChange={(event) => setStatus(event.target.value)}>{["All statuses", "Draft", "Planning", "Active", "Completed"].map((value) => <option key={value}>{value}</option>)}</select></div>{campaigns.filter((c) => status === "All statuses" || status === c.status).length ? <CampaignList items={campaigns.filter((c) => status === "All statuses" || status === c.status)} /> : <Empty title="No campaigns in this stage" description="Start a new brief or choose a different status." action="Create campaign" onAction={() => plan()} />}</>}

    {page === "planner" && <form className="co-planner" onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const start = String(data.get("start"));
      const end = String(data.get("end"));
      if (start && end && end < start) { setMessage("End date must be on or after the start date."); return; }
      if (planFees > planBudget) { setMessage("Selected placement fees exceed the budget. Increase it or remove a creator."); return; }
      void persist(async () => { const campaign = await workspaceRequest("/workspace/campaigns", "POST", { name: String(data.get("name")).trim(), budget: planBudget.toFixed(2), creator_ids: planCreators, objective: String(data.get("objective")), category: planCategory, start_date: start || null, end_date: end || null, brief: String(data.get("brief")).trim(), deliverables: String(data.get("deliverables")).trim() }); go("campaign", campaign.id); setMessage("Campaign draft saved to PostgreSQL."); });



    }}><div className="co-plan-fields"><section><div className="co-number-heading"><span>01</span><div><h2>Set the direction</h2><p>Start with a clear outcome.</p></div></div><label>Campaign name<input name="name" required maxLength={100} pattern=".*\S.*" placeholder="e.g. The everyday collection launch" /></label><div className="co-form-grid"><label>Objective<select name="objective"><option>Brand awareness</option><option>Engagement</option><option>Product consideration</option><option>Traffic</option></select></label><label>Category<select value={planCategory} onChange={(event) => setPlanCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label></div><label>Campaign brief<textarea name="brief" required maxLength={2000} rows={4} placeholder="The product, audience, message, and what success looks like." /></label></section><section><div className="co-number-heading"><span>02</span><div><h2>Budget & timeline</h2><p>Make space for both production and promotion.</p></div></div><label>Total budget (INR)<input type="number" required min={1} max={1000000000} value={planBudget} onChange={(event) => setPlanBudget(Number(event.target.value))} /></label><div className="co-form-grid"><label>Start date<input type="date" name="start" required /></label><label>End date<input type="date" name="end" required /></label></div><label>Deliverables<input name="deliverables" required maxLength={200} placeholder="e.g. 2 reels and 3 stories per creator" /></label></section><section><div className="co-number-heading"><span>03</span><div><h2>Assemble your creator team</h2><p>Sample rates per placement; final costs depend on agreed deliverables.</p></div></div>{creators.map((creator) => <label className="co-select-creator" key={creator.id}><input type="checkbox" checked={planCreators.includes(creator.id)} onChange={() => setPlanCreators((items) => items.includes(creator.id) ? items.filter((id) => id !== creator.id) : [...items, creator.id])} /><img src={imageUrl(creator.photo, 80)} alt="" /><span><strong>{creator.name}</strong><small>{creator.category} / {creator.platform}</small></span><strong>{money(creator.fee)}</strong></label>)}</section></div><aside className="co-plan-summary"><p className="co-eyebrow">YOUR PLAN, AT A GLANCE</p><h2>Investment outline</h2><div className="co-summary-line"><span>Total budget</span><strong>{money(planBudget || 0)}</strong></div><div className="co-summary-line"><span>{planCreators.length} creator placements</span><strong>{money(planFees)}</strong></div><div className={`co-summary-total ${planFees > planBudget ? "over" : ""}`}><span>Unallocated budget</span><strong>{money((planBudget || 0) - planFees)}</strong></div><p>Rates are illustrative. This outline excludes taxes, additional deliverables, production, and paid amplification.</p><button className="co-primary" type="submit">Save campaign draft <ArrowRight size={16} /></button><button type="button" className="co-text" onClick={() => go("campaigns")}>Cancel</button></aside></form>}

    {page === "campaign" && (activeCampaign ? <>
      <button className="co-back" onClick={() => go("campaigns")}><ArrowLeft size={15} />Back to campaigns</button><div className="co-campaign-title"><div><span className={`co-badge ${activeCampaign.status.toLowerCase()}`}>{activeCampaign.status}</span><h2>{activeCampaign.name}</h2><p>{activeCampaign.objective} / {activeCampaign.category}</p></div><select aria-label="Campaign status" value={activeCampaign.status} onChange={(event) => updateCampaign(activeCampaign.id, { status: event.target.value as Campaign["status"] })}>{["Draft", "Planning", "Active", "Completed"].map((value) => <option key={value}>{value}</option>)}</select></div><div className="co-stats"><Stat label="Total budget" value={money(activeCampaign.budget)} note="Planned investment" /><Stat label="Indicative creator fees" value={money(campaignMetrics(activeCampaign).plannedFees)} note="One sample placement per creator" /><Stat label="Creator partners" value={String(activeCampaign.creators.length)} note="Assigned to this brief" /><Stat label="Timeline" value={activeCampaign.start.slice(5) || "--"} note={`Through ${activeCampaign.end || "not scheduled"}`} /></div><div className="co-campaign-grid"><section><h2>The brief</h2><p className="co-brief">{activeCampaign.brief}</p><div className="co-summary-line"><span>Deliverables</span><strong>{activeCampaign.deliverables}</strong></div><h2 className="co-subhead">Creator team</h2>{campaignMetrics(activeCampaign).participants.length ? campaignMetrics(activeCampaign).participants.map((creator) => <button key={creator.id} className="co-team-row" onClick={() => go("profile", String(creator.id))}><img src={imageUrl(creator.photo, 80)} alt="" /><span><strong>{creator.name}</strong><small>{creator.platform} / {creator.category}</small></span><span>{money(creator.fee)}</span><ArrowUpRight size={16} /></button>) : <p className="co-muted">No creator partners assigned to this draft.</p>}</section><section className="co-milestones"><h2>Campaign milestones</h2><p className="co-muted">Track readiness manually.</p>{steps.map((step) => <label key={step}><input type="checkbox" checked={activeCampaign.checked.includes(step)} onChange={() => updateCampaign(activeCampaign.id, { checked: activeCampaign.checked.includes(step) ? activeCampaign.checked.filter((value) => value !== step) : [...activeCampaign.checked, step] })} /><span>{step}</span></label>)}<button className="co-text" onClick={() => { setResultCampaign(activeCampaign.id); go("results"); }}>View campaign results <ArrowRight size={16} /></button></section></div><div className="co-delete-band"><p>{activeCampaign.sample ? "Sample campaign" : "Company campaign"} / stored in PostgreSQL</p><button className="co-danger" onClick={() => removeCampaign(activeCampaign.id)}>Delete campaign</button></div>
    </> : <Empty title="Campaign not found" description="This campaign may have been removed from the local workspace." action="View campaigns" onAction={() => go("campaigns")} />)}

    {page === "results" && <><div className="co-section-head"><span className="co-small-pill">Illustrative campaign results</span><select aria-label="Results campaign" value={resultCampaign} onChange={(event) => setResultCampaign(event.target.value)}><option value="all">All campaigns</option>{campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.name}</option>)}</select></div>{results.length ? <><div className="co-stats"><Stat label="Accounts reached" value={compact(reach)} note="Summed sample reach, not deduplicated" /><Stat label="Engagements" value={compact(engagements)} note="Sample likes, comments, saves, shares" /><Stat label="Creator spend" value={money(spend)} note="Illustrative placement costs" /><Stat label="Cost per engagement" value={money(spend / engagements)} note="Sample spend / sample engagements" /></div><section className="co-section"><div className="co-section-head"><div><h2>Creator contribution</h2><p>Performance by sample placement</p></div><TrendingUp size={20} /></div><div className="co-table-wrap"><table className="co-table"><thead><tr><th>Creator</th><th>Campaign</th><th>Reach</th><th>Engagements</th><th>Clicks</th><th>Spend</th><th>Cost / engagement</th></tr></thead><tbody>{results.map((result) => <tr key={`${result.campaign}-${result.creator}`}><td><button className="co-name-button" onClick={() => go("profile", String(result.creator))}>{creators.find((c) => c.id === result.creator)?.name}</button></td><td>{campaigns.find((c) => c.id === result.campaign)?.name}</td><td>{compact(result.reach)}</td><td>{compact(result.engagements)}</td><td>{compact(result.clicks)}</td><td>{money(result.spend)}</td><td className="co-green">{money(result.spend / result.engagements)}</td></tr>)}</tbody></table></div></section><div className="co-decision"><Target size={22} /><div><h3>What these numbers can tell you</h3><p>Engagement cost helps compare sample placements. Revenue attribution, unique reach, and return on investment require connected conversion and audience data.</p></div><button className="co-secondary" onClick={() => go("reports")}>Open executive report <ArrowRight size={16} /></button></div></> : <Empty title="Results are not available yet" description="This campaign has no sample outcomes. Changing its status does not create performance data." action="View campaigns" onAction={() => go("campaigns")} />}</>}

    {page === "reports" && <section className="co-report"><div className="co-report-title"><div><p className="co-eyebrow">TALENTLENS / SAMPLE EXECUTIVE REPORT</p><h2>{company.name}</h2><p>Creator investment review / August - September 2026</p></div><span className="co-report-mark"><BarChart3 size={28} /></span></div><div className="co-report-summary"><p className="co-eyebrow">EXECUTIVE PERSPECTIVE</p><h3>Audience response gives investment its context.</h3><p>The sample portfolio delivered {compact(reach)} summed reach and {compact(engagements)} engagements at {engagements ? money(spend / engagements) : "--"} per engagement. All results below are illustrative and exclude revenue attribution.</p></div><div className="co-stats"><Stat label="Sample reach" value={compact(reach)} note="Not deduplicated" /><Stat label="Sample engagements" value={compact(engagements)} note="Across selected sample results" /><Stat label="Sample spend" value={money(spend)} note="Creator placements only" /></div><h3>Campaign investment overview</h3><CampaignList items={campaigns} /><div className="co-report-notes"><section><p className="co-eyebrow">NEXT DECISION</p><h3>Test response before scaling spend.</h3><p>Use a focused pilot to compare creator formats, then bring verified audience and conversion data into the next review.</p></section><section><p className="co-eyebrow">DATA CONFIDENCE</p><h3>Sample inputs / unverified</h3><p>Profiles, fees, and outcomes are illustrative. This report is a product demonstration, not a record of company performance.</p></section></div><div className="co-report-footer">Prepared for {company.name}<span>TalentLens / Sample data</span></div></section>}

    {page === "settings" && <div className="co-settings"><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void persist(async () => { await workspaceRequest("/workspace/company", "PUT", { name: String(data.get("name")).trim(), industry: String(data.get("industry")), contact_email: String(data.get("contact")) || null }); setMessage("Company preferences saved to PostgreSQL."); }); }}><h2>Company profile</h2><p className="co-muted">Used in this workspace and executive reports.</p><label>Company name<input name="name" required maxLength={80} pattern=".*\S.*" defaultValue={company.name} /></label><label>Industry<select name="industry" defaultValue={company.industry}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Reporting contact<input type="email" name="contact" required defaultValue={company.contact} /></label><button className="co-primary" type="submit">Save preferences <Check size={16} /></button></form><section><h2>Sample workspace</h2><button className="co-secondary" disabled={busy} onClick={() => void persist(async () => { await workspaceRequest("/workspace/sample-data", "POST"); setMessage("Sample campaigns loaded into your company workspace."); })}>Load sample campaigns <Plus size={16} /></button><h2 className="co-subhead">Platform connections</h2><p className="co-muted">No social platform is connected yet.</p>{["Instagram", "YouTube"].map((value) => <div className="co-connection" key={value}>{value === "Instagram" ? <Instagram size={21} /> : <Youtube size={21} />}<strong>{value}</strong><span className="co-small-pill">Not connected</span></div>)}<div className="co-settings-note"><CalendarDays size={20} /><div><h3>Data freshness</h3><p>Sample analytics are loaded from PostgreSQL. No live platform imports are scheduled.</p></div></div></section></div>}

    <footer className="co-footer"><span>TalentLens <span>/</span> Better-informed partnerships.</span><span>Company intelligence <span>/</span> Sample data</span></footer></main></div>
    {signIn && <CompanySignIn onClose={() => setSignIn(false)} onSignedIn={() => { setSignIn(false); setReload((value) => value + 1); }} />}
    <dialog ref={deleteDialog} className="co-delete-dialog" onCancel={() => setDeleteId(null)}><h2>Delete this campaign?</h2><p>This permanently removes the campaign and its results from your company workspace.</p><div><button className="co-secondary" onClick={() => { deleteDialog.current?.close(); setDeleteId(null); }}>Keep campaign</button><button className="co-danger" onClick={() => { if (deleteId) void persist(async () => { await workspaceRequest(`/workspace/campaigns/${deleteId}`, "DELETE"); deleteDialog.current?.close(); setDeleteId(null); go("campaigns"); setMessage("Campaign removed from PostgreSQL."); }); }}>Delete campaign</button></div></dialog>
  </div></CompanyContext.Provider>;
}
