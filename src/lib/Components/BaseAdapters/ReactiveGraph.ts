/* ================================================================
 * 🧲 REACTIVE EFFECT GRAPH (dependency-tracked watchEffect)
 *
 * Effects read through a BuilderProxy; the proxy's `get` handler calls
 * `track(target, prop)`, and its `set`/`deleteProperty` handlers call
 * `notify(target, prop)` — so only the effects that actually read a
 * mutated prop re-run. Re-runs are coalesced into a single microtask
 * flush (batching). Each BuilderProxy owns its own graph instance,
 * so proxies from different builders never share subscriptions.
 * ================================================================ */
export type EffectFn = () => void;
type PropKey = string | symbol;

interface Dep {
  effects: Set<EffectFn>;
}

export class ReactiveGraph {
  private activeEffect: EffectFn | null = null;
  private pendingEffects = new Set<EffectFn>();
  private flushScheduled = false;

  /** target → prop → dep(effects that read it) */
  private graph = new WeakMap<object, Map<PropKey, Dep>>();
  /** effect → deps it touched (for cleanup when body re-runs / unwatch) */
  private owned = new WeakMap<EffectFn, Set<Dep>>();

  private getDep(target: object, prop: PropKey): Dep {
    let props = this.graph.get(target);
    if (!props) {
      props = new Map();
      this.graph.set(target, props);
    }
    let dep = props.get(prop);
    if (!dep) {
      dep = { effects: new Set() };
      props.set(prop, dep);
    }
    return dep;
  }

  /** Called from the proxy `get` handler while an effect is running. */
  public track(target: object, prop: PropKey): void {
    if (!this.activeEffect || typeof prop === "symbol") return;
    const dep = this.getDep(target, prop);
    if (dep.effects.has(this.activeEffect)) return;

    dep.effects.add(this.activeEffect);
    let list = this.owned.get(this.activeEffect);
    if (!list) {
      list = new Set();
      this.owned.set(this.activeEffect, list);
    }
    list.add(dep);
  }

  /** Called from the proxy `set`/`deleteProperty` handlers. */
  public notify(target: object, prop: PropKey): void {
    const dep = this.graph.get(target)?.get(prop);
    if (!dep) return;
    for (const fn of Array.from(dep.effects)) this.schedule(fn);
  }

  private schedule(effect: EffectFn): void {
    this.pendingEffects.add(effect);
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flushScheduled = false;
      const batch = Array.from(this.pendingEffects);
      this.pendingEffects.clear();
      for (const fn of batch) fn();
      // Re-entrancy (an effect writing state during flush) re-schedules
      // through `schedule()` on the next microtask — no infinite hot loop.
    });
  }

  private releaseDeps(effect: EffectFn): void {
    const list = this.owned.get(effect);
    if (!list) return;
    for (const dep of list) dep.effects.delete(effect);
    list.clear();
  }

  /**
   * Runs `fn` immediately, then re-runs it whenever any proxied state
   * it read during the last run mutates. Returns an unwatch function.
   */
  public watchEffect(fn: EffectFn): () => void {
    let disposed = false;

    const run: EffectFn = () => {
      if (disposed) return;
      this.releaseDeps(run); // conditional reads re-track correctly each pass
      this.activeEffect = run;
      try {
        fn();
      } finally {
        this.activeEffect = null;
      }
    };

    run();
    return () => {
      if (disposed) return;
      disposed = true;
      this.releaseDeps(run);
      this.pendingEffects.delete(run);
    };
  }
}