import type { PansManagerRuntime } from "../manager-context";

/** Performs the ordered, idempotence-friendly shutdown used by provider lifecycles. */
export async function closePansManagerRuntime(runtime: PansManagerRuntime) {
  await runtime.discovery.stop();
  await Promise.allSettled([runtime.logs.flush(), runtime.sessions.closeAll()]);
  await runtime.closeStorage();
}
