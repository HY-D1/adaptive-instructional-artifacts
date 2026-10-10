import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ClipboardCheck } from 'lucide-react';
import { getPreSurveyStatus } from '../lib/api/auth-client';
import { getSurveyInvitations, type SurveyInvitation } from '../lib/api/storage-client';

export function PreSurveyRequiredPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkExpired = searchParams.get('reason') === 'survey-link-expired';
  const [preSurvey, setPreSurvey] = useState<SurveyInvitation | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await getPreSurveyStatus();
        if (!cancelled && status.completed) {
          navigate('/practice', { replace: true });
          return;
        }
        const invitations = await getSurveyInvitations();
        if (!cancelled) {
          setPreSurvey(invitations.find(
            (invitation) => invitation.instance === 'pre' && invitation.status === 'pending',
          ) ?? null);
        }
      } catch {
        // Keep the gate visible until the server confirms completion.
      }
    };
    void refresh();
    const handleFocus = () => void refresh();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [navigate]);

  return (
    <main className="min-h-[60vh] flex items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-lg border bg-white p-8 text-center shadow-sm">
        <ClipboardCheck className="mx-auto mb-4 h-10 w-10 text-blue-600" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">Complete the pre-activity survey</h1>
        <p className="mt-3 text-gray-600">
          {linkExpired
            ? 'That survey link has expired. Return to the app and open the current survey link again. '
            : 'Complete the survey before starting the activity. This page will update when completion is recorded. '}
          {preSurvey?.surveyUrl && (
            <a
              href={preSurvey.surveyUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-700 underline hover:text-blue-900"
            >
              Click here to continue to the pre-activity survey.
            </a>
          )}
        </p>
      </section>
    </main>
  );
}