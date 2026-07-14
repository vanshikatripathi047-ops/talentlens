"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  service: string;
};

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function checkBackend() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;

        if (!apiUrl) {
          throw new Error("API URL is not configured.");
        }

        const response = await fetch(`${apiUrl}/health`);

        if (!response.ok) {
          throw new Error("Backend returned an error.");
        }

        const data: HealthResponse = await response.json();
        setHealth(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to connect to backend."
        );
      }
    }

    checkBackend();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">
          TalentLens
        </p>

        <h1 className="text-4xl font-bold">
          Creator and Brand Intelligence
        </h1>

        <p className="mt-4 text-slate-400">
          Explainable creator analytics and brand investment intelligence.
        </p>

        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-950 p-5">
          <h2 className="font-semibold">Backend connection</h2>

          {!health && !error && (
            <p className="mt-2 text-slate-400">Checking API...</p>
          )}

          {health && (
            <div className="mt-2">
              <p className="font-medium text-green-400">
                Backend connected successfully
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Service: {health.service}
              </p>
            </div>
          )}

          {error && (
            <p className="mt-2 text-red-400">
              Connection failed: {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}