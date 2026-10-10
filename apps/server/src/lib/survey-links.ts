import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type SurveyLinkInstance = 'pre' | 'post';

interface SurveyTokenPayload {
  username: string;
  instance: SurveyLinkInstance;
  invitationNonce: string;
  exp: number;
  nonce: string;
}

const TOKEN_TTL_SECONDS = 24 * 60 * 60;

function signingSecret(): string | null {
  const secret = process.env.QUALTRICS_COMPLETION_SIGNING_SECRET?.trim();
  return secret || null;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueSurveyCompletionToken(
  username: string,
  instance: SurveyLinkInstance,
  invitationNonce: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string | null {
  const secret = signingSecret();
  if (!secret || !username) return null;

  const payload: SurveyTokenPayload = {
    username,
    instance,
    invitationNonce,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
    nonce: randomBytes(12).toString('hex'),
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${signature(encodedPayload, secret)}`;
}

export function verifySurveyCompletionToken(
  token: string,
  expectedInstance: SurveyLinkInstance,
  nowSeconds = Math.floor(Date.now() / 1000),
): { username: string; instance: SurveyLinkInstance; invitationNonce: string } | null {
  const secret = signingSecret();
  const [encodedPayload, encodedSignature] = token.split('.');
  if (!secret || !encodedPayload || !encodedSignature) return null;

  const expectedSignature = signature(encodedPayload, secret);
  const actualBuffer = Buffer.from(encodedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const decoded = decode(encodedPayload);
  if (!decoded) return null;
  try {
    const payload = JSON.parse(decoded) as Partial<SurveyTokenPayload>;
    if (
      typeof payload.username !== 'string' ||
      payload.instance !== expectedInstance ||
      typeof payload.invitationNonce !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp < nowSeconds
    ) {
      return null;
    }
    return {
      username: payload.username,
      instance: payload.instance,
      invitationNonce: payload.invitationNonce,
    };
  } catch {
    return null;
  }
}