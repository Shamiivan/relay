/**
 * Base error for Apollo API boundary failures.
 */
export class ApolloApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApolloApiError";
    this.status = status;
  }
}

/**
 * Upstream returned a shape that does not match the contract this tool expects.
 */
export class ApolloResponseParseError extends Error {
  constructor(message = "Unexpected Apollo response shape") {
    super(message);
    this.name = "ApolloResponseParseError";
  }
}
