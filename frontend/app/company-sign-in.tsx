"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { categories } from "./company-data";
import { workspaceRequest } from "./company-api";

export default function CompanySignIn({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="co-auth-dialog" onCancel={onClose} aria-labelledby="co-auth-title">
    <button className="co-icon co-auth-close" aria-label="Close sign-in" onClick={onClose}><X size={18} /></button>
    <p className="co-eyebrow">TALENTLENS / COMPANY WORKSPACE</p><h2 id="co-auth-title">{register ? "Create your company account" : "Welcome back"}</h2>
    <div className="co-segments"><button aria-pressed={!register} onClick={() => { setRegister(false); setError(""); }}>Sign in</button><button aria-pressed={register} onClick={() => { setRegister(true); setError(""); }}>Create account</button></div>
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError("");
      const data = new FormData(event.currentTarget);
      const credentials = { email: String(data.get("email")), password: String(data.get("password")) };
      try {
        if (register) await workspaceRequest("/auth/register", "POST", { ...credentials, full_name: String(data.get("full_name")), role: "brand" });
        const user = await workspaceRequest("/auth/login", "POST", credentials);
        if (user.role !== "brand") { await workspaceRequest("/auth/logout", "POST"); throw new Error("Please use a company account."); }
        const profile = await fetch("/api/backend/workspace/company", { cache: "no-store" });
        if (profile.status === 404) await workspaceRequest("/workspace/company", "PUT", {
          name: String(data.get("company_name") || `${user.full_name}'s company`), industry: String(data.get("industry") || "Lifestyle"), contact_email: credentials.email,
        });
        else if (!profile.ok) throw new Error("Could not load your company profile. Please retry.");
        onSignedIn();
      } catch (problem) { setError(problem instanceof Error ? problem.message : "Sign-in failed. Please retry."); }
      finally { setBusy(false); }
    }}>
      {register && <><label>Your name<input name="full_name" required minLength={2} maxLength={100} autoComplete="name" /></label><label>Company name<input name="company_name" required maxLength={120} /></label><label>Industry<select name="industry">{categories.map((category) => <option key={category}>{category}</option>)}</select></label></>}
      <label>Email<input name="email" type="email" required autoComplete="email" autoFocus /></label>
      <label>Password<input name="password" type="password" required minLength={register ? 8 : 1} maxLength={128} autoComplete={register ? "new-password" : "current-password"} /></label>
      {error && <p className="co-auth-error" role="alert">{error}</p>}
      <button className="co-primary" disabled={busy} type="submit">{busy ? "Please wait" : register ? "Create account" : "Sign in"}<ArrowRight size={16} /></button>
    </form>
  </dialog>;
}
