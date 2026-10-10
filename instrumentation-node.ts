/** the node server's startup checks. a server w/o a valid CREDENTIALS_KEY would fail the 1st time a
 * user saves a key, so it refuses to start instead (#17) */

import { credentialsKey } from "./server/credentials";

try {
  credentialsKey();
} catch (err) {
  // a throw here only makes next answer 500 to everything while the process stays up, so docker sees
  // it running. exiting makes the failure loud: the container stops w/ this message
  console.error(`Refusing to start: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
