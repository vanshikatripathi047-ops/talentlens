"use client";

/* Representative portraits belong to fictional sample profiles. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, Check, Crosshair, MoveUpRight, Radio } from "lucide-react";
import { compact, imageUrl, money, type Campaign, type Creator } from "./company-data";

type Props = {
  campaigns: Campaign[];
  creators: Creator[];
  saved: string[];
  reach: number;
  engagements: number;
  spend: number;
  onProfile: (id: string) => void;
  onSave: (id: string) => void;
  onDiscover: () => void;
};

export default function InvestmentOverview({ creators, campaigns, saved, reach, engagements, spend, onProfile, onSave, onDiscover }: Props) {
  const [platform, setPlatform] = useState("All");
  const [selectedId, setSelectedId] = useState("");
  const available = creators.filter((creator) => platform === "All" || creator.platform === platform);
  const selected = available.find((creator) => creator.id === selectedId) || available[0];
  if (!selected) return <div className="co-empty">No creator data available.</div>;

  return <div className="lx-overview">
    <div className="lx-metrics">
      {[
        ["Campaign portfolio", String(campaigns.length).padStart(2, "0"), `${campaigns.filter((campaign) => campaign.status === "Active").length} active campaigns`, "01"],
        ["Sample audience reach", compact(reach), "Summed reach / not deduplicated", "02"],
        ["Cost per engagement", engagements ? money(spend / engagements) : "--", "Sample placement spend / response", "03"],
        ["Your shortlist", String(saved.length).padStart(2, "0"), "Potential creator partnerships", "04"],
      ].map(([label, value, note, index]) => <section key={label}><div><span>{label}</span><small>{index}</small></div><strong>{value}</strong><p>{note}</p></section>)}
    </div>

    <div className="lx-intelligence-heading"><div><span className="lx-section-index">01 / CREATOR INTELLIGENCE</span><h2>Where influence meets investment.</h2></div><button className="co-text" onClick={onDiscover}>Explore the directory <ArrowUpRight size={17} /></button></div>
    <div className="lx-intelligence">
      <section className="lx-map-section" aria-label="Creator investment map">
        <div className="lx-map-head"><div><Crosshair size={18} /><span>Investment map</span></div><div className="lx-platform-tabs" aria-label="Map platform">{["All", "Instagram", "YouTube"].map((value) => <button key={value} aria-pressed={platform === value} onClick={() => setPlatform(value)}>{value}</button>)}</div></div>
        <p className="lx-map-description">Engagement rate against indicative placement fee</p>
        <div className="lx-map-wrapper">
          <span className="lx-y-title">ENGAGEMENT</span>
          <div className="lx-y-labels"><span>10%</span><span>8%</span><span>6%</span><span>4%</span></div>
          <div className="lx-map">
            <div className="lx-map-region"><span>Higher response<br />Lower fee</span><MoveUpRight size={16} /></div>
            {[0, 28.57, 57.14, 85.71].map((top) => <div className="lx-horizontal-guide" key={top} style={{ top: `${top}%` }} />)}
            {[0, 33.33, 66.67, 100].map((left) => <div className="lx-vertical-guide" key={left} style={{ left: `${left}%` }} />)}
            {available.map((creator) => <button className={`lx-point ${creator.id === selected.id ? "selected" : ""}`} style={{ left: `${(creator.fee - 20000) / 600}%`, top: `${(10 - creator.engagement) / 7 * 100}%` }} key={creator.id} aria-label={`Inspect ${creator.name}: ${creator.engagement}% engagement, ${money(creator.fee)} indicative fee`} aria-pressed={creator.id === selected.id} title={`${creator.name}: ${creator.engagement}% / ${money(creator.fee)}`} onClick={() => setSelectedId(creator.id)}><span>{creator.name.split(" ").map((word) => word[0]).join("")}</span>{creator.id === selected.id && <strong>{creator.name}<small>{creator.engagement}% / {money(creator.fee)}</small></strong>}</button>)}
          </div>
          <div className="lx-x-labels"><span>INR 20K</span><span>40K</span><span>60K</span><span>80K</span></div>
        </div>
        <div className="lx-map-footer"><span><Radio size={13} />{available.length} sample creators</span><span>Placement fee / INR</span></div>
        <div className="lx-map-legend">{available.map((creator) => <button aria-pressed={creator.id === selected.id} key={creator.id} onClick={() => setSelectedId(creator.id)}><span>{creator.name.split(" ").map((word) => word[0]).join("")}</span>{creator.name}</button>)}</div>
      </section>

      <article className="lx-spotlight">
        <div className="lx-spotlight-image"><img src={imageUrl(selected.photo, 700)} alt={`Representative portrait for ${selected.name}`} /><span className="lx-spotlight-label">CREATOR IN FOCUS</span><button aria-label={`Shortlist ${selected.name}`} title={saved.includes(selected.id) ? "Remove from shortlist" : "Save creator"} aria-pressed={saved.includes(selected.id)} onClick={() => onSave(selected.id)}>{saved.includes(selected.id) ? <Check size={18} /> : <Bookmark size={18} />}</button></div>
        <div className="lx-spotlight-body"><div className="lx-spotlight-meta"><span>{selected.category}</span><span>{selected.platform}</span></div><h2>{selected.name}</h2><p>{selected.handle} / {selected.city}</p><div className="lx-spotlight-stats"><div><strong>{selected.engagement}%</strong><span>Engagement</span></div><div><strong>{money(selected.fee)}</strong><span>Indicative fee</span></div></div><button className="lx-profile-link" onClick={() => onProfile(selected.id)}>Understand the fit <ArrowUpRight size={18} /></button></div>
      </article>
    </div>

    <div className="lx-observation"><span className="lx-observation-mark"><MoveUpRight size={19} /></span><div><strong>The signal behind the selection</strong><p>{selected.name}&apos;s sample audience is {selected.india}% India-based, with {selected.growth}% monthly growth. Review audience fit and content quality alongside engagement before planning a partnership.</p></div><button onClick={() => onProfile(selected.id)} aria-label={`Review ${selected.name}`}><ArrowRight size={20} /></button></div>
  </div>;
}
