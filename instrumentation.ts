/** runs once when a server starts, before any request. a server w/o a valid CREDENTIALS_KEY would
 * fail the 1st time a user saves a key, so it refuses to start instead (#17) */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { credentialsKey } = await import("./server/credentials");
  credentialsKey();
}
