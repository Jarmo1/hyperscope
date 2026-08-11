const SHARED = Symbol.for("hyperscope.shared-state");

type Registry = Map<string, unknown>;

/**
 * Process-wide state, keyed by name.
 *
 * Next bundles each route separately, so a plain module-level `let` is NOT
 * shared between (say) a page and its own opengraph-image — each gets a private
 * copy. Left unfixed, every route rescans Hyperliquid independently and a share
 * card can report different numbers than the page it was generated for.
 *
 * Hanging the state off a global symbol gives one instance per process. It is
 * still per-instance rather than durable: serverless cold starts begin empty,
 * which every caller here already tolerates.
 */
export function sharedState<T extends object>(name: string, create: () => T): T {
  const root = globalThis as typeof globalThis & { [SHARED]?: Registry };
  root[SHARED] ??= new Map();
  const registry = root[SHARED];

  let existing = registry.get(name);
  if (existing === undefined) {
    existing = create();
    registry.set(name, existing);
  }
  return existing as T;
}
