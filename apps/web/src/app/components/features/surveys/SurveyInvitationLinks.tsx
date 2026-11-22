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

// Longer wording used in the top navigation bar.
const NAV_LABELS: Record<SurveyInvitation["instance"], string> = {
  pre: "Click here to start the pre-survey",
  post: "Click here to complete the post-survey",
};

export function SurveyInvitationLinks({ variant = "default" }: { variant?: "default" | "nav" } = {}): ReactNode {
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

  if (variant === "nav") {
    // Top navigation: always visible, one compact button per pending survey.
    return (
      <div className="flex flex-wrap items-center gap-2" aria-label="Available surveys">
        {invitations.map((invitation) => invitation.surveyUrl ? (
          <a
            key={invitation.instance}
            href={invitation.surveyUrl}
            target="_blank"
            rel="noreferrer"
            data-testid={`survey-link-${invitation.instance}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-red-300 dark:focus-visible:ring-offset-gray-900">
            <ClipboardCheck className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden 2xl:inline">{NAV_LABELS[invitation.instance]}</span>
            <span className="2xl:hidden">{invitation.instance === "post" ? "Post-survey" : "Pre-survey"}</span>
            <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          </a>
        ) : null)}
      </div>
    );
  }

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
          className="inline-flex items-center gap-1 rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-red-300 dark:focus-visible:ring-offset-gray-900">
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
