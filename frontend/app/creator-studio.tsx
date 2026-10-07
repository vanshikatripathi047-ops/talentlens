"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, Camera, ChevronRight, Lightbulb, Megaphone, Users } from "lucide-react";
import { loadSampleWorkspace } from "./company-api";
import { compact, imageUrl, money } from "./company-data";

type Snapshot = Awaited<ReturnType<typeof loadSampleWorkspace>>;
const navigation = [
  { label: "Overview", icon: BarChart3 }, { label: "Content", icon: Camera },
  { label: "Audience", icon: Users }, { label: "Sponsors", icon: Megaphone }, { label: "Ideas", icon: Lightbulb },
];

export default function CreatorStudio({ onCompany }: { onCompany: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [creatorId, setCreatorId] = useState("");
  const [page, setPage] = useState("Overview");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadSampleWorkspace(controller.signal, true).then(setSnapshot).catch((problem) => {
      if (!controller.signal.aborted) setError(problem.message);
    });
    return () => controller.abort();
  }, [reload]);
  const creator = snapshot?.creators.find((item) => item.id === creatorId) || snapshot?.creators[0];
  if (!snapshot || !creator) return <div className="co-empty" role="status"><BarChart3 size={30} /><h2>{error ? "Creator studio unavailable" : "Loading creator studio"}</h2>{error && <><p>{error}</p><button className="co-primary" onClick={() => { setError(""); setReload((value) => value + 1); }}>Retry <ArrowRight size={16} /></button></>}</div>;
  const content = creator.content.filter((post) => post.publishedAt);
  const campaigns = snapshot.campaigns.filter((campaign) => campaign.creators.includes(creator.id));
  const results = snapshot.results.filter((result) => result.creator === creator.id);
  const spend = results.reduce((sum, result) => sum + result.spend, 0);
  const reach = content.reduce((sum, post) => sum + (post.reach || 0), 0);
  const engagements = content.reduce((sum, post) => sum + (post.engagements || 0), 0);
  return <div className="co-shell">
    <aside className="co-sidebar"><button className="co-brand" onClick={() => setPage("Overview")}><span className="co-brand-mark"><BarChart3 size={21} /></span>TalentLens<span>.</span></button>
      <div className="co-company"><span className="co-company-avatar">{creator.name[0]}</span><div><strong>{creator.name}</strong><small>Creator studio</small></div></div>
      <p className="co-nav-label">CREATOR WORKSPACE</p><nav>{navigation.map(({ label, icon: Icon }) => <button key={label} className={`co-nav ${page === label ? "active" : ""}`} onClick={() => setPage(label)}><Icon size={18} />{label}</button>)}</nav>
      <div className="co-sidebar-foot"><div className="co-demo-label"><span />Read-only creator demo</div></div>
    </aside>
    <div className="co-main"><header className="co-topbar"><div className="co-breadcrumb">Creator studio<ChevronRight size={13} /><strong>{page}</strong></div><div className="co-top-actions"><select aria-label="Sample creator" value={creator.id} onChange={(event) => { setCreatorId(event.target.value); setSelected([]); }}>{snapshot.creators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="co-secondary" onClick={onCompany}>Company workspace <ArrowRight size={16} /></button></div></header>
      <main className="co-content"><div className="co-page-head"><div><p className="co-eyebrow">TALENTLENS / CREATOR INTELLIGENCE</p><h1>{page === "Overview" ? creator.name : page}</h1><p>{creator.handle} / {creator.category} / {creator.platform}</p></div></div>
        <div className="co-sample-note"><span /><strong>Sample data</strong><span className="co-note-divider" />{creator.observedOn ? `Metrics observed ${creator.observedOn}` : "No metrics available"} / no live platform connection</div>
        {page === "Overview" && <><div className="co-stats">{[["Followers", compact(creator.followers)], ["Engagement", `${creator.engagement}%`], ["Monthly growth", `${creator.growth}%`], ["Sample sponsor spend", money(spend)]].map(([label, value]) => <div className="co-stat" key={label}><div>{label}</div><strong>{value}</strong><small>Illustrative analytics</small></div>)}</div>
          <section className="co-section"><div className="co-section-head"><h2>Content performance</h2><button className="co-text" onClick={() => setPage("Content")}>All content <ArrowRight size={16} /></button></div><div className="co-creator-grid">{content.map((post) => <article className="co-creator-card" key={post.id}><img className="cs-content-image" src={imageUrl(post.mediaUrl)} alt={post.title} /><div className="co-card-body"><h3>{post.title}</h3><p>{compact(post.reach || 0)} reach / {compact(post.engagements || 0)} engagements</p></div></article>)}</div></section>
          <section className="co-section"><div className="co-section-head"><h2>Next in your content calendar</h2><button className="co-text" onClick={() => setPage("Ideas")}>All ideas <ArrowRight size={16} /></button></div>{creator.ideas.slice(0, 1).map((idea) => <div className="co-decision" key={idea.id}><Lightbulb size={22} /><div><h3>{idea.title}</h3><p>{idea.rationale}</p></div></div>)}</section></>}
        {page === "Content" && <><div className="co-stats"><div className="co-stat"><div>Content records</div><strong>{content.length}</strong></div><div className="co-stat"><div>Summed reach</div><strong>{compact(reach)}</strong><small>Not deduplicated</small></div><div className="co-stat"><div>Engagements</div><strong>{compact(engagements)}</strong></div><div className="co-stat"><div>Engagement / reach</div><strong>{reach ? `${(engagements / reach * 100).toFixed(1)}%` : "--"}</strong></div></div>
          <div className="co-table-wrap"><table className="co-table"><thead><tr><th>Content</th><th>Date</th><th>Reach</th><th>Engagements</th><th>Compare</th></tr></thead><tbody>{content.map((post) => <tr key={post.id}><td>{post.title}</td><td>{post.publishedAt?.slice(0, 10)}</td><td>{compact(post.reach || 0)}</td><td>{compact(post.engagements || 0)}</td><td><input type="checkbox" aria-label={`Compare ${post.title}`} checked={selected.includes(post.id)} disabled={selected.length >= 3 && !selected.includes(post.id)} onChange={() => setSelected((items) => items.includes(post.id) ? items.filter((id) => id !== post.id) : [...items, post.id])} /></td></tr>)}</tbody></table></div>
          {selected.length > 1 && <section className="co-section"><h2>Content comparison</h2><div className="co-compare-grid">{content.filter((post) => selected.includes(post.id)).map((post) => <article key={post.id}><h3>{post.title}</h3><div className="co-compare-row"><span>Reach</span><strong>{compact(post.reach || 0)}</strong></div><div className="co-compare-row"><span>Engagement / reach</span><strong>{post.reach ? `${((post.engagements || 0) / post.reach * 100).toFixed(1)}%` : "--"}</strong></div></article>)}</div></section>}</>}
        {page === "Audience" && <div className="co-profile-grid">{[{ title: "Top locations", items: creator.locations.map((item) => ({ label: item.country, percent: item.percent })) }, { title: "Age distribution", items: creator.ageGroups.map((item) => ({ label: item.range, percent: item.percent })) }].map((group) => <section key={group.title}><h2>{group.title}</h2>{group.items.map((item) => <div className="co-audience-row" key={item.label}><div><span>{item.label}</span><strong>{item.percent}%</strong></div><meter min={0} max={100} value={item.percent} aria-label={`${item.label} audience share`} /></div>)}</section>)}</div>}
        {page === "Sponsors" && <section className="co-section"><h2>Sample brand partnerships</h2>{campaigns.length ? <div className="co-table-wrap"><table className="co-table"><thead><tr><th>Brand</th><th>Campaign</th><th>Status</th><th>Deliverables</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td>{snapshot.company.name}</td><td>{campaign.name}</td><td><span className={`co-badge ${campaign.status.toLowerCase()}`}>{campaign.status}</span></td><td>{campaign.deliverables}</td></tr>)}</tbody></table></div> : <div className="co-empty">No sample partnerships for this creator.</div>}</section>}
        {page === "Ideas" && <section className="co-section"><h2>Next-video ideas</h2>{creator.ideas.map((idea) => <div className="cs-idea" key={idea.id}><Lightbulb size={22} /><div><h3>{idea.title}</h3><p>{idea.rationale}</p><div className="cs-hashtags">{idea.hashtags.map((tag) => <span key={tag}>{tag}</span>)}</div></div></div>)}</section>}
      </main>
    </div>
  </div>;
}
