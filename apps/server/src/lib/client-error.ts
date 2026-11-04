/** Internal error text only in development; clients otherwise get a generic message. */
export function clientErrorMessage(error: unknown): string {
  return process.env.NODE_ENV === 'development' && error instanceof Error
    ? error.message
    : 'Unexpected server error';
}
