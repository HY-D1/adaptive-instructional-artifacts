import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import type { SurveyInvitation } from "../../../lib/api/storage-client";

export function getPendingPostSurveyUrl(
  invitations: SurveyInvitation[] | undefined,
): string | null {
  return invitations?.find(
    (invitation) =>
      invitation.instance === "post" &&
      invitation.status === "pending" &&
      Boolean(invitation.surveyUrl),
  )?.surveyUrl ?? null;
}

interface LogoutSurveyReminderDialogProps {
  open: boolean;
  surveyUrl: string;
  onOpenChange: (open: boolean) => void;
  onCompleteSurvey: () => void;
  onLogoutAnyway: () => void;
  onCloseAutoFocus: (event: Event) => void;
}

export function LogoutSurveyReminderDialog({
  open,
  surveyUrl,
  onOpenChange,
  onCompleteSurvey,
  onLogoutAnyway,
  onCloseAutoFocus,
}: LogoutSurveyReminderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>Complete your post-activity survey</DialogTitle>
          <DialogDescription>
            Please complete the post-activity survey before you go. It only takes a few minutes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onLogoutAnyway}>
            Log out anyway
          </Button>
          <Button asChild onClick={onCompleteSurvey}>
            <a href={surveyUrl} target="_blank" rel="noreferrer">
              Complete the survey
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
