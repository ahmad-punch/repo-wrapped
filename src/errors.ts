/** An error whose message is meant for the person running the CLI. */
export class UserError extends Error {
  override name = "UserError";
}
