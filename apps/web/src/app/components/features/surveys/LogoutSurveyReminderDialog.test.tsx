import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  getPendingPostSurveyUrl,
  getPendingPostSurveyUrlWithTimeout,
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
    const user = userEvent.setup();

    render(
      <LogoutSurveyReminderDialog
        open
        surveyUrl={pendingPostSurvey.surveyUrl!}
        onOpenChange={vi.fn()}
        onCompleteSurvey={vi.fn()}
        onLogoutAnyway={onLogoutAnyway}
        onCloseAutoFocus={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Log out anyway" }));
    expect(onLogoutAnyway).toHaveBeenCalledOnce();
  });

  it("opens the post survey when the student chooses Complete the survey", async () => {
    const onCompleteSurvey = vi.fn();
    const user = userEvent.setup();

    render(
      <LogoutSurveyReminderDialog
        open
        surveyUrl={pendingPostSurvey.surveyUrl!}
        onOpenChange={vi.fn()}
        onCompleteSurvey={onCompleteSurvey}
        onLogoutAnyway={vi.fn()}
        onCloseAutoFocus={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: "Complete the survey" });
    expect(link.getAttribute("href")).toBe(pendingPostSurvey.surveyUrl);
    expect(link.getAttribute("target")).toBe("_blank");
    await user.click(link);
    expect(onCompleteSurvey).toHaveBeenCalledOnce();
  });

  it("falls back to normal logout when the survey lookup is slow", async () => {
    const apiCall = vi.fn(
      () => new Promise<SurveyInvitation[]>((resolve) => setTimeout(() => resolve([pendingPostSurvey]), 3000)),
    );

    const result = await getPendingPostSurveyUrlWithTimeout(apiCall, 2000);

    expect(result).toBeNull();
  });

  it("moves focus into the dialog, closes on Escape, and returns focus to Logout", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = React.useState(true);
      const logoutButtonRef = React.useRef<HTMLButtonElement>(null);

      return (
        <>
          <button ref={logoutButtonRef}>Logout</button>
          <LogoutSurveyReminderDialog
            open={open}
            surveyUrl={pendingPostSurvey.surveyUrl!}
            onOpenChange={setOpen}
            onCompleteSurvey={() => setOpen(false)}
            onLogoutAnyway={() => setOpen(false)}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              logoutButtonRef.current?.focus();
            }}
          />
        </>
      );
    }

    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true),
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Logout" }));
  });
});
