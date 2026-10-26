import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  getPendingPostSurveyUrl,
  LogoutSurveyReminderDialog,
} from "./LogoutSurveyReminderDialog";
import type { SurveyInvitation } from "../../../lib/api/storage-client";

const pendingPostSurvey: SurveyInvitation = {
  userId: "student-1",
  instance: "post",
  username: "student",
  qualtricsResponseId: null,
  status: "pending",
  createdAt: "2026-10-26T00:00:00.000Z",
  completedAt: null,
  surveyUrl: "https://survey.example/post",
};

describe("post-survey logout reminder", () => {
  it("shows only for an available, incomplete post survey", () => {
    expect(getPendingPostSurveyUrl([pendingPostSurvey])).toBe(
      pendingPostSurvey.surveyUrl,
    );
    expect(
      getPendingPostSurveyUrl([{ ...pendingPostSurvey, status: "completed" }]),
    ).toBeNull();
    expect(getPendingPostSurveyUrl([])).toBeNull();
    expect(getPendingPostSurveyUrl(undefined)).toBeNull();
  });

  it("logs out when the student chooses Log out anyway", async () => {
    const onLogoutAnyway = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <LogoutSurveyReminderDialog
        open
        surveyUrl={pendingPostSurvey.surveyUrl!}
        onOpenChange={onOpenChange}
        onCompleteSurvey={vi.fn()}
        onLogoutAnyway={onLogoutAnyway}
        onCloseAutoFocus={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log out anyway" }));
    expect(onLogoutAnyway).toHaveBeenCalledOnce();
  });

  it("opens the post survey when the student chooses Complete the survey", async () => {
    const onCompleteSurvey = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <LogoutSurveyReminderDialog
        open
        surveyUrl={pendingPostSurvey.surveyUrl!}
        onOpenChange={onOpenChange}
        onCompleteSurvey={onCompleteSurvey}
        onLogoutAnyway={vi.fn()}
        onCloseAutoFocus={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: "Complete the survey" });
    expect(link.getAttribute("href")).toBe(pendingPostSurvey.surveyUrl);
    expect(link.getAttribute("target")).toBe("_blank");
    fireEvent.click(link);
    expect(onCompleteSurvey).toHaveBeenCalledOnce();
  });
});
