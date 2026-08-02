"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GroupChat } from "@/components/groups/GroupChat";
import { groupAuthHeaders } from "@/lib/groups/client-session";
import type { GroupMember, GroupParty } from "@/lib/groups/types";

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [group, setGroup] = useState<GroupParty | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const headers = await groupAuthHeaders();
      const res = await fetch(`/api/groups/${id}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load group");
        return;
      }
      setGroup(data.group);
      setMembers(data.members || []);
    })();
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-danger">{error}</p>
        <Link href="/groups" className="mt-4 inline-block text-sm text-accent">
          Back to parties
        </Link>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center text-muted">
        Loading party…
      </div>
    );
  }

  return (
    <GroupChat
      groupId={id}
      initialGroup={group}
      initialMembers={members}
    />
  );
}
