export function classifySurveyLinkage(invitations, responses) {
  const responseById = new Map();
  for (const response of responses) {
    const responseId = response.ResponseID ?? response.responseId;
    if (typeof responseId === 'string' && responseId.trim()) {
      responseById.set(responseId.trim(), response);
    }
  }

  const counts = { verified: 0, unverified: 0, quarantine: 0, responseAbsentFromExport: 0 };
  for (const invitation of invitations) {
    const response = invitation.qualtrics_response_id
      ? responseById.get(invitation.qualtrics_response_id)
      : null;
    if (!response) {
      counts.responseAbsentFromExport += 1;
      continue;
    }
    const responseUsername = response.username ?? response.Username;
    if (typeof responseUsername !== 'string' || !responseUsername.trim()) {
      counts.unverified += 1;
    } else if (responseUsername.trim() === invitation.username) {
      counts.verified += 1;
    } else {
      counts.quarantine += 1;
    }
  }
  return { invitationCount: invitations.length, exportResponseCount: responseById.size, counts };
}