/**
 * Standard return shape for Server Actions that report success/failure back
 * to a client form instead of throwing. Actions that redirect on success
 * (register, login) never actually return the success branch — redirect()
 * throws internally — but the type still documents the failure shape the
 * client component destructures via useActionState.
 */
export type ActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
