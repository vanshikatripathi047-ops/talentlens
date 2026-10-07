"use client";

import { useState } from "react";
import CompanyWorkspace from "./company-workspace";
import CreatorStudio from "./creator-studio";

export default function Home() {
  const [role, setRole] = useState<"brand" | "creator">("brand");
  return role === "brand"
    ? <CompanyWorkspace onCreator={() => setRole("creator")} />
    : <CreatorStudio onCompany={() => setRole("brand")} />;
}
