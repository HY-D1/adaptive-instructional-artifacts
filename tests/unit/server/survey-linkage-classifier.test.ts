import { describe, expect, it } from 'vitest';
import { classifySurveyLinkage } from '../../../scripts/verification/survey-linkage-classifier.mjs';

describe('survey linkage classification', () => {
  it('classifies verified, unverified, quarantined, and absent responses', () => {
    const result = classifySurveyLinkage(
      [
        { username: 'student-aaa111', qualtrics_response_id: 'verified' },
        { username: 'student-bbb222', qualtrics_response_id: 'missing-username' },
        { username: 'student-ccc333', qualtrics_response_id: 'mismatch' },
        { username: 'student-ddd444', qualtrics_response_id: 'absent' },
      ],
      [
        { ResponseID: 'verified', username: 'student-aaa111' },
        { ResponseID: 'missing-username' },
        { ResponseID: 'mismatch', username: 'student-other' },
      ],
    );

    expect(result).toEqual({
      invitationCount: 4,
      exportResponseCount: 3,
      counts: {
        verified: 1,
        unverified: 1,
        quarantine: 1,
        responseAbsentFromExport: 1,
      },
    });
  });
});