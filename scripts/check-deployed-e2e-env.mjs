#!/usr/bin/env node

function isLocalUrl(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url.trim());
}

function asNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

function fail(message, missing = []) {
  const payload = {
    ok: false,
    message,
    missing,
  };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

const frontendBaseUrl = asNonEmpty(process.env.PLAYWRIGHT_BASE_URL);
const apiBaseUrl = asNonEmpty(process.env.PLAYWRIGHT_API_BASE_URL || process.env.VITE_API_BASE_URL);

if (!frontendBaseUrl || isLocalUrl(frontendBaseUrl)) {
  console.log(JSON.stringify({
    ok: true,
    mode: 'local',
    message: 'PLAYWRIGHT_BASE_URL is local or unset; deployed env preflight skipped.',
  }, null, 2));
  process.exit(0);
}

const required = [
  ['PLAYWRIGHT_BASE_URL', frontendBaseUrl],
  ['PLAYWRIGHT_API_BASE_URL', apiBaseUrl],
  ['E2E_INSTRUCTOR_EMAIL', asNonEmpty(process.env.E2E_INSTRUCTOR_EMAIL)],
  ['E2E_INSTRUCTOR_PASSWORD', asNonEmpty(process.env.E2E_INSTRUCTOR_PASSWORD)],
  ['E2E_STUDENT_CLASS_CODE', asNonEmpty(process.env.E2E_STUDENT_CLASS_CODE)],
];

const missingRequired = required.filter(([, value]) => !value).map(([name]) => name);
if (missingRequired.length > 0) {
  fail('Missing required deterministic deployed E2E env vars.', missingRequired);
}

const bypassSecret = asNonEmpty(
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.E2E_VERCEL_BYPASS_SECRET
);
const frontendShareUrl = asNonEmpty(process.env.PLAYWRIGHT_FRONTEND_SHARE_URL);
const apiShareToken = asNonEmpty(process.env.PLAYWRIGHT_API_SHARE_TOKEN);
const apiShareUrl = asNonEmpty(process.env.PLAYWRIGHT_API_SHARE_URL);

const protectedPreview =
  frontendBaseUrl.includes('.vercel.app') &&
  (frontendBaseUrl.includes('-git-') || frontendBaseUrl.includes('preview'));

if (protectedPreview && !bypassSecret && !frontendShareUrl) {
  fail(
    'Protected preview detected for frontend. Set VERCEL_AUTOMATION_BYPASS_SECRET or PLAYWRIGHT_FRONTEND_SHARE_URL.',
    ['VERCEL_AUTOMATION_BYPASS_SECRET|PLAYWRIGHT_FRONTEND_SHARE_URL'],
  );
}

if (
  apiBaseUrl.includes('.vercel.app') &&
  (apiBaseUrl.includes('-git-') || apiBaseUrl.includes('preview')) &&
  !bypassSecret &&
  !apiShareToken &&
  !apiShareUrl
) {
  fail(
    'Protected preview detected for API. Set VERCEL_AUTOMATION_BYPASS_SECRET or PLAYWRIGHT_API_SHARE_TOKEN/PLAYWRIGHT_API_SHARE_URL.',
    ['VERCEL_AUTOMATION_BYPASS_SECRET|PLAYWRIGHT_API_SHARE_TOKEN'],
  );
}

console.log(JSON.stringify({
  ok: true,
  mode: 'deployed',
  frontendBaseUrl,
  apiBaseUrl,
  hasBypassSecret: Boolean(bypassSecret),
  hasFrontendShareUrl: Boolean(frontendShareUrl),
  hasApiShareToken: Boolean(apiShareToken || apiShareUrl),
}, null, 2));
