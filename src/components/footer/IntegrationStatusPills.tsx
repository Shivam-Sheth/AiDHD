"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";

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
        <Badge key={k} tone={v === "live" || v === "registered" ? "success" : "neutral"}>
          <span
            aria-hidden
            className={
              v === "live" || v === "registered"
                ? "h-1.5 w-1.5 rounded-full bg-success"
                : "h-1.5 w-1.5 rounded-full bg-faint"
            }
          />
          {k} {v}
        </Badge>
      ))}
    </div>
  );
}
