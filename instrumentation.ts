/** runs once when a server starts, before any request. next compiles this file for the edge runtime
 * too, so the node only checks live in instrumentation-node.ts, imported only on node */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation-node");
}
