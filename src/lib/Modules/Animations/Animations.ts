import "./Animations.css";
import { TypewriterBehaviour, type TypewriterOptions } from "./behaviours/typewriter";
import { StaggerFadeBehaviour, type StaggerFadeOptions } from "./behaviours/stagger-fade";
import { FadeInBehaviour, type FadeInOptions } from "./behaviours/fade-in";
import { ScrambleBehaviour, type ScrambleOptions } from "./behaviours/scramble";
import { CountUpBehaviour } from "./behaviours/count-up";
import { LoadingPlaceholderBehaviour, type LoadingPlaceholderOptions } from "./behaviours/loading-placeholder";

export interface AnimationServiceConfig {
  typewriter?: TypewriterOptions;
  staggerFade?: Partial<StaggerFadeOptions>;
  scramble?: Partial<ScrambleOptions>;
  fade?: Partial<FadeInOptions>;
  loadingPlaceholder?: Partial<LoadingPlaceholderOptions>;
  delay?: number; // Properti global di level atas
}


export type AnimationState = 'idle' | 'waiting' | 'running' | 'done';

export interface AnimationRecord {
  node: HTMLElement;
  type: string;
  chained: boolean;
  scope: HTMLElement;
  state: AnimationState;
  snapshot: {
    opacity: string;
    pointerEvents: string;
    html?: string;
    text?: string;
  };
  controller: { shouldStop: boolean };
}

/**
 * AnimationsService — unified lifecycle and execution engine for declarative DOM animations.
 *
 * Implements tree-agnostic document-order sequencing, WeakMap/Map node tracking,
 * dynamic mutation discovery, and viewport intersection entry/exit management.
 */
export class AnimationsService {
  private globalDelay: number;
  public config: Partial<AnimationServiceConfig>;

  /** Registry of all active animation records keyed by element */
  private records: Map<HTMLElement, AnimationRecord> = new Map();

  /** Ordered list of chained elements per execution scope (e.g. fieldset, form, section) */
  private scopes: Map<HTMLElement, HTMLElement[]> = new Map();

  /** Native DOM observers */
  private mutationObserver: MutationObserver | null = null;
  private viewObserver: IntersectionObserver | null = null;

  static #known = new Set([
    'typewriter',
    'stagger-fade',
    'fade-in',
    'text-scramble',
    'count-up',
    'loading-placeholder'
  ]);

  constructor(config: AnimationServiceConfig = {}) {
    this.globalDelay = config.delay ?? 500;
    this.config = {
      typewriter: {
        loop: config.typewriter?.loop ?? false,
        interval: config.typewriter?.interval ?? 30,
        delay: config.typewriter?.delay ?? this.globalDelay,
        rewrite: config.typewriter?.rewrite ?? false,
      },
      fade: {
        duration: config.fade?.duration ?? '0.5s',
      },
      staggerFade: {
        delay: config.staggerFade?.delay ?? 5000,
        duration: config.staggerFade?.duration ?? '0.6s',
      },
      scramble: {
        chars: config.scramble?.chars ?? '!<>-_\\/[]{}—=+*^?#________',
        speed: config.scramble?.speed ?? 40,
      },
      loadingPlaceholder: {
        duration: config.loadingPlaceholder?.duration ?? this.globalDelay,
      },
      ...config
    };

    this._observeMutations();
  }

  // =========================================================================
  // PUBLIC LIFECYCLE API (Base.ts Single-Word Pattern)
  // =========================================================================

  /**
   * Initializes the animation engine, scanning the target root and establishing observers.
   */
  public init(root: ParentNode = document.body): this {
    this.scan(root);
    return this;
  }

  /**
   * Scans a subtree for elements with `[animation]` in document order and mounts them.
   */
  public scan(root: ParentNode = document.body): HTMLElement[] {
    if (!root || typeof root.querySelectorAll !== 'function') return [];

    const nodes: HTMLElement[] = [];
    if (root instanceof HTMLElement && root.hasAttribute('animation')) {
      nodes.push(root);
    }
    nodes.push(...Array.from(root.querySelectorAll<HTMLElement>('[animation]')));

    nodes.forEach((node) => this.mount(node));

    // Kick off any visible scopes or unchained nodes after scan is complete
    this.scopes.forEach((_, scope) => {
      if (this._inViewport(scope)) {
        this._startScope(scope);
      }
    });

    nodes.forEach((node) => {
      const rec = this.records.get(node);
      if (rec && !rec.chained && this._inViewport(node)) {
        this.trigger(node);
      }
    });

    return nodes;
  }

  /**
   * Mounts a single animated node into the registry and configures its initial state.
   */
  public mount(node: HTMLElement): void {
    if (this.records.has(node)) return;

    const type = node.getAttribute('animation') || '';
    if (!AnimationsService.#known.has(type)) {
      console.warn(`[AnimationsService] Unknown animation type: "${type}"`);
      return;
    }

    const chained = node.getAttribute('animation-chain') === 'true';
    const scope = this._scope(node);

    const snapshot = {
      opacity: node.style.opacity,
      pointerEvents: node.style.pointerEvents,
      html: node.innerHTML,
      text: node.textContent || '',
    };

    const record: AnimationRecord = {
      node,
      type,
      chained,
      scope,
      state: chained ? 'waiting' : 'idle',
      snapshot,
      controller: { shouldStop: false },
    };

    if (chained) {
      let chainList = this.scopes.get(scope);
      if (!chainList) {
        chainList = [];
        this.scopes.set(scope, chainList);
      }
      if (!chainList.includes(node)) {
        chainList.push(node);
        chainList.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      }

      // Hanya sembunyikan via JS elemen yang menunggu pendahulunya (bukan
      // urutan pertama). fade-in & typewriter cukup dipre-hide CSS via
      // visibility:hidden — JS tidak perlu menimpa opacity-nya.
      if (chainList.indexOf(node) > 0 && type !== 'fade-in' && type !== 'typewriter') {
        node.style.opacity = '0';
        node.style.pointerEvents = 'none';
      }
    }

    this.records.set(node, record);
    this.observe(node);
  }

  /**
   * Unmounts a node, canceling any active animation and cleaning up registry references.
   */
  public unmount(node: HTMLElement): void {
    const rec = this.records.get(node);
    if (!rec) return;

    this.stop(node);
    this.unobserve(node);

    if (rec.chained) {
      const chainList = this.scopes.get(rec.scope);
      if (chainList) {
        const idx = chainList.indexOf(node);
        if (idx !== -1) chainList.splice(idx, 1);
        if (chainList.length === 0) this.scopes.delete(rec.scope);
      }
    }

    this.records.delete(node);
  }

  /**
   * Observes a node or its host container for viewport visibility.
   */
  public observe(node: HTMLElement): void {
    this._ensureViewObserver();

    const rec = this.records.get(node);
    if (!rec) return;

    if (rec.chained) {
      // For chained elements, observe the scope container (e.g. fieldset, form, section)
      this.viewObserver?.observe(rec.scope);
    } else {
      // Pre-hide memakai visibility:hidden (bukan display:none), jadi setiap
      // elemen selalu punya kotak layout — cukup amati elemennya langsung.
      this.viewObserver?.observe(node);
    }
  }

  /**
   * Unobserves a node from viewport tracking.
   */
  public unobserve(node: HTMLElement): void {
    if (!this.viewObserver) return;
    this.viewObserver.unobserve(node);
  }

  /**
   * Executes the appropriate animation behaviour for a node.
   */
  public trigger(node: HTMLElement): void {
    const rec = this.records.get(node);
    if (!rec) return;

    if (rec.state === 'running') {
      this.stop(node);
    }

    rec.state = 'running';
    rec.controller = { shouldStop: false };

    // Release pre-hide suppression styles so element becomes visible
    this._release(node, rec.snapshot);

    const isStopped = (): boolean => rec.controller.shouldStop || !node.isConnected;

    const done = (): void => {
      if (rec.state !== 'running') return;
      rec.state = 'done';
      this._dispatch(node, 'animation:done');

      if (rec.chained) {
        this.next(rec.scope);
      }
    };

    switch (rec.type) {
      case 'typewriter':
        TypewriterBehaviour.animate(
          node,
          { ...(this.config.typewriter as TypewriterOptions), delay: this._delay(node) },
          done,
          isStopped
        );
        break;

      case 'stagger-fade':
        StaggerFadeBehaviour.animate(
          node,
          {
            delay: this.config.staggerFade?.delay!,
            duration: this.config.staggerFade?.duration!,
          },
          (el) => {
            this._dispatch(el, 'animation:done');
            done();
          }
        );
        break;

      case 'fade-in':
        FadeInBehaviour.animate(
          node,
          { duration: this.config.fade?.duration! },
          done
        );
        break;

      case 'text-scramble':
        ScrambleBehaviour.animate(
          node,
          {
            chars: this.config.scramble?.chars!,
            speed: this.config.scramble?.speed!,
          },
          done
        );
        break;

      case 'count-up':
        CountUpBehaviour.animate(node);
        done();
        break;

      case 'loading-placeholder':
        LoadingPlaceholderBehaviour.animate(
          node,
          {
            duration: this.config.loadingPlaceholder?.duration!,
            instantRevealDelayTime: this.config.loadingPlaceholder?.instantRevealDelayTime,
            restoreFallbackOpacity: this.config.loadingPlaceholder?.restoreFallbackOpacity,
          },
          done
        );
        break;
    }
  }

  /**
   * Advances a chain sequence in a scope by triggering the next waiting element in document order.
   */
  public next(scope: HTMLElement): void {
    const chain = this.scopes.get(scope);
    if (!chain || chain.length === 0) return;

    const nextNode = chain.find((n) => {
      const rec = this.records.get(n);
      return rec && (rec.state === 'waiting' || rec.state === 'idle');
    });

    if (!nextNode) {
      this._dispatch(scope, 'animation:scope-done');
      return;
    }

    this.trigger(nextNode);
  }

  /**
   * Stops an active animation on a node.
   */
  public stop(node: HTMLElement): void {
    const rec = this.records.get(node);
    if (!rec) return;

    rec.controller.shouldStop = true;
    if (rec.state === 'running') {
      rec.state = 'idle';
    }

    if (typeof node.getAnimations === 'function') {
      node.getAnimations().forEach((anim) => anim.cancel());
    }
  }

  /**
   * Resets element(s) to initial state, enabling replay when the viewport or page is revisited.
   */
  public reset(target?: HTMLElement | ParentNode): void {
    if (!target) {
      this.records.forEach((_, node) => this._resetNode(node));
      return;
    }

    if (target instanceof HTMLElement && this.records.has(target)) {
      this._resetNode(target);
      return;
    }

    this.records.forEach((_, node) => {
      if (target.contains(node) || target === node) {
        this._resetNode(node);
      }
    });
  }

  /**
   * Clears state for elements that have left the viewport or page. Alias for reset.
   */
  public clear(target?: HTMLElement | ParentNode): void {
    this.reset(target);
  }

  /**
   * Releases loading placeholders frozen by lazy-loading anti-FOUC guards.
   */
  public release(root: ParentNode = document.body): void {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    const heldNodes = root.querySelectorAll<HTMLElement>('[animation="loading-placeholder"]');
    heldNodes.forEach((node) => this.trigger(node));
  }

  /**
   * Backwards-compatibility alias for release().
   */
  public releaseLoadingPlaceholders(root: ParentNode = document.body): void {
    this.release(root);
  }

  /**
   * Disconnects observers, stops all running animations, and clears internal maps.
   */
  public destroy(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.viewObserver) {
      this.viewObserver.disconnect();
      this.viewObserver = null;
    }

    this.records.forEach((rec, node) => {
      rec.controller.shouldStop = true;
      this.stop(node);
    });

    this.records.clear();
    this.scopes.clear();
  }

  // =========================================================================
  // INTERNAL HELPERS
  // =========================================================================

  private _ensureViewObserver(): void {
    if (this.viewObserver) return;

    this.viewObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const target = entry.target as HTMLElement;

        if (entry.isIntersecting) {
          // A. Target is a registered scope holding chained elements
          if (this.scopes.has(target)) {
            this._startScope(target);
          }

          // B. Target is a registered individual element
          const rec = this.records.get(target);
          if (rec && !rec.chained && rec.state === 'idle') {
            this.trigger(target);
          }
        } else {
          // Element or scope left viewport / became hidden: clear/reset for clean replay on revisit
          if (this.scopes.has(target)) {
            this.reset(target);
          }
          if (this.records.has(target)) {
            this.reset(target);
          }
        }
      });
    }, { threshold: 0 });
  }

  private _startScope(scope: HTMLElement): void {
    const chain = this.scopes.get(scope);
    if (!chain || chain.length === 0) return;

    const isAnyRunning = chain.some((n) => this.records.get(n)?.state === 'running');
    if (isAnyRunning) return;

    const isAllDone = chain.every((n) => this.records.get(n)?.state === 'done');
    if (isAllDone) return;

    this.next(scope);
  }

  private _resetNode(node: HTMLElement): void {
    const rec = this.records.get(node);
    if (!rec) return;

    this.stop(node);

    if (rec.chained) {
      rec.state = 'waiting';
      node.style.opacity = '0';
      node.style.pointerEvents = 'none';
    } else {
      rec.state = 'idle';
      if (rec.snapshot.opacity !== '') node.style.opacity = rec.snapshot.opacity;
      else node.style.removeProperty('opacity');
      if (rec.snapshot.pointerEvents !== '') node.style.pointerEvents = rec.snapshot.pointerEvents;
      else node.style.removeProperty('pointer-events');
    }

    if (rec.type === 'typewriter' && rec.snapshot.html !== undefined) {
      node.innerHTML = rec.snapshot.html;
      node.classList.remove('tw-writing');
    } else if (rec.type === 'text-scramble' && rec.snapshot.text !== undefined) {
      node.textContent = rec.snapshot.text;
    }

    // Lepas inline visibility peninggalan sesi animasi sebelumnya agar rule
    // pre-hide visibility:hidden (fade-in & typewriter) berlaku lagi selama
    // menunggu re-trigger — replay tanpa kilatan konten penuh.
    node.style.removeProperty('visibility');
  }

  private _release(node: HTMLElement, snapshot: AnimationRecord['snapshot']): void {
    if (snapshot.pointerEvents !== '') {
      node.style.pointerEvents = snapshot.pointerEvents;
    } else {
      node.style.removeProperty('pointer-events');
    }

    if (snapshot.opacity !== '') {
      node.style.opacity = snapshot.opacity;
    } else {
      node.style.removeProperty('opacity');
    }
  }

  private _scope(node: HTMLElement): HTMLElement {
    const boundary = node.closest('fieldset, form, section, article, dialog, aside, header, footer, main, [data-animation-scope]');
    return (boundary as HTMLElement) || document.body;
  }

  private _inViewport(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
      rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  private _delay(node: HTMLElement): number {
    return node.hasAttribute('data-delay')
      ? parseInt(node.getAttribute('data-delay') || '', 10)
      : this.globalDelay;
  }

  private _dispatch(node: HTMLElement, eventName: string, detail?: any): void {
    const event = new CustomEvent(eventName, {
      bubbles: true,
      composed: true,
      detail: { origin: node, ...detail }
    });
    node.dispatchEvent(event);
  }

  private _observeMutations(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (this.records.has(node)) {
            this.unmount(node);
          }
          node.querySelectorAll<HTMLElement>('[animation]').forEach((child) => {
            this.unmount(child);
          });
        });

        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!node.isConnected) return;
              this.scan(node);
            });
          });
        });
      });
    });

    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }
}
