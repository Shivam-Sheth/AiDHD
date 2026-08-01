"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

export function IntegrationStatusPills() {
  const [integrations, setIntegrations] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: { integrations?: Record<string, string> }) => {
        setIntegrations(data.integrations ?? {});
      })
      .catch(() => {});
  }, []);

  if (!Object.keys(integrations).length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(integrations).map(([k, v]) => (
        <span
          key={k}
          className={clsx(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase",
            v === "live" || v === "registered"
              ? "bg-success-soft text-success"
              : "bg-dusk-800 text-dusk-muted",
          )}
        >
          {k} {v}
        </span>
      ))}
    </div>
  );
}
