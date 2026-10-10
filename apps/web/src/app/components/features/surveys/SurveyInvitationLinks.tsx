import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ExternalLink, ClipboardCheck } from "lucide-react";
import {
  getSurveyInvitations,
  type SurveyInvitation,
} from "../../../lib/api/storage-client";

const LABELS: Record<SurveyInvitation["instance"], string> = {
  pre: "Start Pre Survey",
  post: "Post-activity survey",
};

export function SurveyInvitationLinks(): ReactNode {
  const [invitations, setInvitations] = useState<SurveyInvitation[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const next = await getSurveyInvitations();
      if (!cancelled) {
        setInvitations(
          next.filter((invitation) => invitation.status === "pending"),
        );
      }
    };

    void refresh();
    const handleFocus = () => void refresh();
    const handleVisibility = () => {
      if (!document.hidden) void refresh();
    };
    const handleProgressSaved = () => void refresh();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("survey-invitations-refresh", handleProgressSaved);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("survey-invitations-refresh", handleProgressSaved);
    };
  }, []);

  if (invitations.length === 0) return null;

  const username = invitations.find((invitation) => invitation.username)?.username;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Available surveys">
      <ClipboardCheck className="size-4 text-blue-600" aria-hidden="true" />
      {username && <span className="text-xs text-gray-600">{username}</span>}
      {invitations.map((invitation) => invitation.surveyUrl ? (
        <a
          key={invitation.instance}
          href={invitation.surveyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50">
          {LABELS[invitation.instance]}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      ) : (
        <span key={invitation.instance} className="text-xs text-amber-700">
          Survey link unavailable; return to the app after setup is complete.
        </span>
      ))}
    </div>
  );
}
