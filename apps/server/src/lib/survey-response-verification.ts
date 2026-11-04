/**
 * Survey completion hardening.
 *
 * The completion token travels inside the student's own survey URL, so the
 * callback alone cannot prove the survey was finished. These checks make a
 * forged callback harder and detectable:
 *  - ResponseIDs must look like Qualtrics IDs when real Qualtrics surveys are
 *    configured (synthetic IDs are allowed only for isolated test targets).
 *  - When API credentials are configured, the ResponseID is confirmed against
 *    the Qualtrics API (endpoint shape UNVERIFIED against a live account).
 */

export const QUALTRICS_RESPONSE_ID_PATTERN = /^R_[A-Za-z0-9]{15}$/;
const SAFE_RESPONSE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const VERIFY_TIMEOUT_MS = 3000;

export type ResponseVerification = 'verified' | 'not_found' | 'unknown';

function surveyUrlFor(instance: 'pre' | 'post', env: NodeJS.ProcessEnv): string | undefined {
  return (instance === 'pre' ? env.QUALTRICS_PRE_SURVEY_URL : env.QUALTRICS_POST_SURVEY_URL)?.trim() || undefined;
}

function isQualtricsHost(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'qualtrics.com' || host.endsWith('.qualtrics.com');
  } catch {
    return false;
  }
}

/** Returns an error reason, or null when the ResponseID is acceptable. */
export function checkResponseIdFormat(
  responseId: string,
  instance: 'pre' | 'post',
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!SAFE_RESPONSE_ID_PATTERN.test(responseId)) return 'invalid_characters';
  const allowSynthetic = env.SURVEY_ALLOW_SYNTHETIC_RESPONSE_IDS === 'true';
  if (isQualtricsHost(surveyUrlFor(instance, env)) && !allowSynthetic &&
      !QUALTRICS_RESPONSE_ID_PATTERN.test(responseId)) {
    return 'not_a_qualtrics_response_id';
  }
  return null;
}

export function extractSurveyId(url: string | undefined): string | null {
  const match = url?.match(/SV_[A-Za-z0-9]+/);
  return match ? match[0] : null;
}

export async function verifyQualtricsResponse(
  responseId: string,
  instance: 'pre' | 'post',
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<ResponseVerification> {
  const token = env.QUALTRICS_API_TOKEN?.trim();
  const datacenter = env.QUALTRICS_DATACENTER?.trim();
  const surveyId = extractSurveyId(surveyUrlFor(instance, env));
  if (!token || !datacenter || !surveyId || !/^[a-z0-9]+$/i.test(datacenter)) {
    return 'unknown';
  }
  try {
    const response = await fetchImpl(
      `https://${datacenter}.qualtrics.com/API/v3/surveys/${surveyId}/responses/${encodeURIComponent(responseId)}`,
      { headers: { 'X-API-TOKEN': token }, signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS) },
    );
    if (response.ok) return 'verified';
    if (response.status === 404) return 'not_found';
    return 'unknown';
  } catch {
    // Network problems must not lock students out; the completion stays unverified.
    return 'unknown';
  }
}
