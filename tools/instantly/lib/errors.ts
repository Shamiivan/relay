/**
 * Base error for Instantly API boundary failures.
 */
export class InstantlyApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "InstantlyApiError";
    this.status = status;
  }
}

/**
 * Upstream returned a shape that does not match the contract this tool expects.
 */
export class InstantlyResponseParseError extends Error {
  constructor(message = "Unexpected Instantly response shape") {
    super(message);
    this.name = "InstantlyResponseParseError";
  }
}
