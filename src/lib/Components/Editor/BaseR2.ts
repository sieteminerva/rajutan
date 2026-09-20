import type { iBuilderRegistry, iBuilderConfig, iElementProperty, iActionProperty, iNodeRecordItem, iNodeRecordRelations } from "../../interface";
// import { TemplateRegistry } from "../Modules/TemplateRegistry";
// import { ElementCreatedEventBus } from "../Services/EventBus";
import { BuilderProxy } from "../BaseAdapters/BuilderProxy";
import { buildNamespace, setMetadata } from "../../Utility/Metadata";
import { selectorToTree } from "../../Utility/SelectorToTree";
import { applyAttrDictionary, applyAttributeList } from "../../Utility/AttributeUtils";

export const GLOBAL_INSTANCE_COUNTER = new Map<string, number>();

/**
 * @classdesc
 * Builder is the abstract foundation for declarative landing-page components.
 * It provides a unified lifecycle for resolving configuration, generating stable namespaces,
 * creating reactive DOM node records, and managing component teardown without leaking state.
 *
 * Concrete builders extend this class to define their own builder identity, stylesheet,
 * render strategy, and initialization behavior while inheriting the shared lifecycle engine.
 *
 * Builder — core lifecycle engine for component-based page rendering
 *
 * @example
 * class HeroBuilder extends Builder<"container" | "title", HeroConfig> {
 *   readonly builderId = "hero";
 *   readonly name = "hero";
 *   readonly stylesheet = "/hero.css";
 *
 *   protected template(typeKey, el, payload) {
 *     if (typeKey === "title") el.textContent = payload?.value ?? "Welcome";
 *   }
 *
 *   public prepare(content, config) {
 *     return this.render("container", content);
 *   }
 *
 *   public initialize() {}
 * }
 *
 * const builder = new HeroBuilder();
 * const element = builder.create({ title: "Hello" });
 *
 * ========== Public Lifecycle API ==========
 *
 * @example
 * builder.create(data, config);
 * builder.destroy();
 * builder.attach("typeKey", "slotKey", payload);
 * builder.detach("slotKey");
 *
 * @template TType - A string literal union representing the allowed selector tokens for the child component.
 * @template TConfig - The builder-specific configuration interface compatible with iBuilderConfig.
 *
 * @author YMGH
 * @version 1.0.0
 */
export abstract class BuilderR2<TType extends string = string, TConfig extends iBuilderConfig<TType> = iBuilderConfig<TType>> {
  /** 🧊 ANTI-FOUC GATE — extracted to `BaseAdapters/HydrationGate`.
   *  Marker mechanics (`--is-loading` / `data-hydrating` / `data-loaded`)
   *  live there; the builder only holds the gate instance and exposes the
   *  `isLoaded` flag that ComponentRegistry flips before `create()`.
   *  Kept in this fork on purpose: a builder moved onto BuilderR2 (the color
   *  theme now is) must not silently lose the pre-paint hold its Base sibling
   *  had — the registry release path (`instance.hydration`) stays identical. */


  /** Compatibility surface: ComponentRegistry does `instance.isLoaded = false`. */
  public isLoaded: boolean = false;


  /** 🧩 THE BUILDER CURRENTLY MATERIALIZING — `create()` pins itself here for
   *  the whole duration of prepare()/initialize(), which is exactly the window
   *  in which a parent instantiates its children. Same spirit as
   *  `#namespaceStack`: the child picks up its caller without anyone having to
   *  pass instances or register anything centrally. */
  static #active: BuilderR2<any, any> | null = null;

  /** 🧩 MY CALLER — the builder that instantiated me (captured the moment this
   *  instance was constructed): the builder whose `config.slots` hosts my
   *  projections. Root builders created by ComponentRegistry simply have none. */
  #caller: BuilderR2<any, any> | null = BuilderR2.#active;

  /** 🧩 PROJECTED NODES — my own typeKey → the node I handed to my caller's slot
   *  through `attach()`, plus the receptacle it displaced (so `detach()` can hand
   *  that place back). A projected node no longer lives inside my root, so every
   *  wiring/sync pass reads it alongside the root (see `scopes()`). */
  #projected = new Map<TType, { slot: string; element: HTMLElement; receptacle: HTMLElement }>();

  /** 🧩 ROOT of the builder that hosts my projections — the shared ancestor
   *  token vars are painted on; null when I have no caller (standalone). Set
   *  in `attach()` the first time I project into a caller. */
  protected rootElement: HTMLElement | null = null;


  static #namespaceStack: string[] = [];

  public static resetCounters(): void {
    GLOBAL_INSTANCE_COUNTER.clear();
    this.#namespaceStack = [];
    // console.log(`🧹 [Builder]: Wiped all instance identity counters.`);
  }

  /**
   * @description
   * Resolves the component's stable runtime identity by generating a deterministic seed,
   * combining it with the current namespace context, and building a selector hierarchy tree.
   * This method also manages a static namespace stack for nested builders and supports
   * explicit overrides when a caller needs to pin a namespace manually.
   *
   * @param content - The source payload used to derive the namespace seed.
   * @param config - Optional builder configuration that can contribute selectors or namespace metadata.
   * @param options - Optional overrides for namespace stack behavior, explicit namespace assignment,
   *   or custom seed generation input.
   *
   * @returns An object containing the resolved namespace, selector hierarchy, seed, and whether
   *   the namespace was pushed to the internal stack during resolution.
   *
   * @protected
   */
  protected ensureIdentity(
    content: any,
    config?: TConfig,
    options?: {
      /** Push resolved namespace onto static stack (for nested builders) */
      pushNamespace?: boolean;
      /** Pop namespace from stack after resolution (for nested builders) */
      popNamespace?: boolean;
      /** Explicit namespace to use instead of resolving */
      explicitNamespace?: string;
      /** Optional config overrides for seed generation */
      seedConfig?: Partial<TConfig>;
    }
  ): {
    /** The resolved unique namespace string */
    namespace: string;
    /** Selector hierarchy tree for this identity */
    hierarchy: Record<string, any>;
    /** The stable hash seed used for namespace generation */
    seed: string;
    /** Whether a new namespace was pushed onto the stack */
    pushed: boolean;
  } {
    // 1. Generate stable hash seed from content + config
    const seed = buildNamespace(content, (options?.seedConfig ?? config) as TConfig | undefined);

    // 2. Resolve namespace (explicit > parent stack > builderId:seed)
    const explicitNamespace = options?.explicitNamespace ?? (config as any)?.namespace ? String((config as any).namespace).trim() : "";
    const parentNamespace = BuilderR2.#namespaceStack[BuilderR2.#namespaceStack.length - 1] || null;
    const baseNamespace = explicitNamespace || (
      parentNamespace
        ? `${parentNamespace}:${String(this.builderId)}:${seed}`
        : `${String(this.builderId)}:${seed}`
    );

    // 3. Cache resolved namespace on instance
    this.instanceNamespace = baseNamespace;

    // 4. Optionally push onto static namespace stack for nested builders
    let pushed = false;
    if (options?.pushNamespace) {
      BuilderR2.#namespaceStack.push(baseNamespace);
      // Builder.pushNamespace(baseNamespace);
      pushed = true;
    }

    // 5. Build selector hierarchy tree from namespace + config selectors
    const hierarchy = selectorToTree(baseNamespace, (config as any)?.selectors as Record<string, any>);

    // 6. Optionally pop namespace (for nested builder cleanup)
    if (options?.popNamespace && pushed) {
      BuilderR2.#namespaceStack.pop();
    }

    return { namespace: baseNamespace, hierarchy, seed, pushed };
  }

  /**
   * The distinct, unique registry identifier allocated to the specific component subclass.
   */
  abstract readonly builderId: keyof iBuilderRegistry;

  /**
   * The human-readable name string designated to characterize the component wrapper class.
   */
  abstract readonly name: keyof iBuilderRegistry;


  /**
   * The human-readable name string designated to characterize the component wrapper class.
   */
  abstract readonly stylesheet: string;

  /**
   * ⚠️ STYLESHEET CONTRACT — STATIC, NOT INSTANCE:
   * The file path pointer target referencing the isolated CSS stylesheet asset assigned to this module.
   * Declare it on subclasses as a STATIC field — `static readonly stylesheet = "./MyComponent.css";`
   * ComponentRegistry.loadModule() reads it from the CLASS object (`BuilderClass.stylesheet`)
   * during lazy module resolution, BEFORE any instance exists. An instance-only class field is
   * invisible to the registry (class fields never land on the prototype), so the CSS would
   * never auto-load. (TS has no `abstract static`, hence documented convention instead.)
   */

  /**
   * The frozen state configuration container holding consolidated options, emitters, and structural selectors.
   */
  public config!: Required<TConfig>;
  protected instanceNamespace: string | null = null;

  /**
   * Internal reference holder pointing directly to the raw, unmutated data node extracted from the spreadsheet database.
   */
  protected activeLiveThemeId: string = "default";
  #staticHierarchy: Record<string, any> = {};
  /**
   * 👑 LAZY HIERARCHY ENGINE
   * Mengisolasi pengerjaan rekonsiliasi silsilah agar tidak membebani loop render()
   */
  protected hierarchy = {
    get: (): Record<string, any> => {
      return this.#staticHierarchy;
    },

    /**
     * 📝 STORE (registration-time, called by render()) — cheap: only ensures a
     * relations entry exists for the key (reusing the static selectorToTree
     * entry when present) and returns it. NO DOM reading here — template()
     * hasn't run yet, so the subtree would be invalid. render() stores the
     * returned object as the node record's `relations`, so the record and
     * hierarchy.get() share one object that update() later fills.
     */
    store: (key: string): iNodeRecordRelations => {
      const existing = this.#staticHierarchy[key] as iNodeRecordRelations | undefined;
      if (existing) return existing;
      const fresh: iNodeRecordRelations = {
        scope: this.instanceNamespace || "",
        key,
        template: key,
        parent: null,
        children: [],
      };
      this.#staticHierarchy[key] = fresh;
      return fresh;
    },

    /**
     * ⚡ DIRECT-LAYER ELEMENT INVENTORY (same spirit as DOMRenderer.attachMetadata)
     * Called from create(), AFTER prepare()/initialize() — template() may do
     * arbitrary DOM operations, so only now is each node's subtree final.
     *
     * For every key in storage.nodes, searches through its live element and
     * stores the SELECTOR STRING (`tag#id.classes`) of every element found
     * inside it into `relations.elements`.
     *
     * Two hard rules:
     * 1. `relations.children` (the static record keys from selectorToTree,
     *    mapped via ">") is NEVER touched — key relations stay intact.
     * 2. The walk STOPS at key boundaries: when it reaches an element owned
     *    by another registered key (e.g. @colorizer>mode living inside
     *    @colorizer>header), that element is recorded once in `elements`
     *    but is NOT descended into — it inventories itself under its own
     *    key, so nothing duplicates across layers.
     *
     * Same elementSelector format as DOMRenderer's attachMetadata.
     * Idempotent: `elements` is rebuilt (deduped) on every run, and
     * node.relations is kept pointed at the same object as the map.
     */
    update: (): Record<string, any> => {
      // Same selector-string format as DOMRenderer.attachMetadata.
      const elementSelector = (el: Element): string => {
        const tag = el.tagName ? el.tagName.toLowerCase() : "div";
        const idPart = el.id ? `#${el.id}` : "";
        const classPart = el.className && typeof el.className === "string"
          ? `.${el.className.trim().split(/\s+/).filter(Boolean).join(".")}`
          : "";
        return `${tag}${idPart}${classPart}`;
      };

      // anchor element (own element or wrapper top) → owning key, so the walk
      // knows where another selector key's territory begins.
      const anchors = new Map<HTMLElement, string>();
      this.storage.nodes.forEach((node, key) => {
        const el = node.element as any;
        const anchor = el?.__outer ?? el;
        if (anchor instanceof HTMLElement) anchors.set(anchor, key);
      });

      this.storage.nodes.forEach((node, key) => {
        const el = node.element;
        if (!(el instanceof HTMLElement)) return;

        const relations = this.hierarchy.store(key);
        node.relations = relations; // record ↔ map share one object

        // 🧭 Direct-layer walk: record each element once, do not descend
        // into subtrees owned by another selector key.
        const found = new Set<string>();
        const walk = (current: Element): void => {
          for (const child of Array.from(current.children)) {
            found.add(elementSelector(child));
            const ownerKey = anchors.get(child as HTMLElement);
            if (ownerKey === undefined || ownerKey === key) {
              walk(child); // same key's territory — keep descending
            }
            // boundary: another key's element — recorded, not descended
          }
        };
        walk(el);
        relations.elements = Array.from(found);
      });

      return this.#staticHierarchy;
    }
  };

  /**
 * 👑 THE SEPARATED HYDRATION VALVE (POS KEMENTERIAN PENGISIAN RAHIM DATA)
 * Murni hanya mengurusi penyemprotan teks data spesifik atomik,
 * terisolasi penuh, rapi, dan kebal dari bug hantu selamanya!
 */
  protected abstract template(typeKey: TType, el: HTMLElement, payload?: any, props?: iActionProperty): void;

  /**
   * @description
   * The public entry point for materializing a component tree from input data.
   * Subclasses implement this method to transform the incoming payload into a DOM fragment
   * or a structured collection of elements while preserving the shared builder lifecycle.
   *
   * @param content - The raw data payload or structural object delivered by the caller.
   * @param config - The resolved builder configuration used to shape the rendered output.
   *
   * @returns A fully hydrated DOM element or a record of DOM elements keyed by their logical role.
   *
   * @public
   */
  public abstract prepare(content: any, config?: Required<TConfig>): HTMLElement | Record<string, any | HTMLElement>;

  /**
   * Runtime event-binding hook.
   * Triggered at the very end of the creation lifecycleto lock persistent browser click/drag/swipe
   * interactive listeners onto the completed DOM structure.
   */
  public abstract initialize(el?: HTMLElement, payload?: any, context?: any): void;

  constructor() {
    this.proxyRuntime = new BuilderProxy(this.storage.proxy);
  }

  /**
   * @description
   * Merges the component's default configuration with runtime overrides into a single
   * immutable configuration object. Selector maps are merged deeply so structural rules
   * and HTML attributes from the user config can augment the defaults without replacing
   * them wholesale.
   *
   * @param defaultOptions - The default structural configuration for the builder, including
   *   core properties and selector definitions.
   * @param userConfig - Incoming runtime overrides provided by the caller, theme layer,
   *   or framework controller.
   *
   * @returns A strictly typed, fully populated configuration object ready for runtime ingestion.
   *
   * @template C - The concrete child configuration type that extends the builder's base config.
   * @protected
   */
  protected resolveConfig<C extends TConfig>(
    defaultOptions: Required<C> | any,
    userConfig: Partial<C> = {}): Required<C> {
    // Step 1: Initialize the local layout registry by cloning the component's default structural selector nodes.
    const mergedSelectors = { ...(defaultOptions.selectors || {}) } as Record<TType, any>;

    // Step 2: Validate the existence of third-party selectors overrides hantaran userConfig layers.
    if (userConfig.selectors) {
      // Step 3: Traverse the override dictionary entries linearly to assimilate the specialized structural tokens.
      Object.entries(userConfig.selectors).forEach(([key, selectorValue]) => {
        if (selectorValue && typeof selectorValue === "object") {
          mergedSelectors[key as TType] = {
            ...(mergedSelectors[key as TType] || {}),
            ...selectorValue,
            // Step 5: Secure the critical HTML custom attributes dictionary block to guarantee zero property evaporation.
            attrs: {
              ...((mergedSelectors[key as TType] || {}).attrs || {}),
              ...((selectorValue as iElementProperty | iActionProperty).attrs || {})
            }
          };
        }
      });
    }
    // Step 6: Package the consolidated state metadata container, ensuring selectors are strictly typed and sealed.
    return Object.freeze({
      ...defaultOptions,
      ...userConfig,
      selectors: mergedSelectors,
      // 🧩 SLOT CONTRACT — resolved ONCE here (constructor time, before any
      // render): from now on every slot lookup is a plain map read, so the
      // framework knows which slot/typeKey pairs this builder owns without
      // re-walking config or DOM.
      slots: {
        ...((defaultOptions as any).slots || {}),
        ...((userConfig as any).slots || {}),
      },
    }) as Required<C>;
  }

  /**
   * 🧩 Declared slots of this builder: `typeKey → slotKey` (see resolveConfig).
   * A declared key is a RECEPTACLE: at the end of create() its element is
   * stamped with `data-slot="slotKey"` and published to the slot ledger, ready
   * for another builder's `attach()`.
   */
  protected get slots(): Record<string, string> {
    return ((this.config as unknown as { slots?: Record<string, string> } | null)?.slots) ?? {};
  }

  public setConfig(config: Partial<TConfig>) {
    this.config = this.resolveConfig(this.config, config)
  }

  public errorHandler() {
    const id = this.builderId;
    console.warn(
      `⚠️ [Framework Degraded Mode]: TemplateRegistry is not present!\n` +
      `Global Slotting System and Cross-Builder Live Reactivity are disabled.\n` +
      `Falling back to standalone local memory buffer for builder: "${id}".`
    );
  }

  /** 📦 NODE STORE — registri node milik instance ini: typeKey → record. */
  protected storage = {
    nodes: new Map<string, iNodeRecordItem>(),
    proxy: new WeakMap<any, any>(),
  };

  protected proxyRuntime: BuilderProxy;

  protected setProxy(
    key: string,
    payload: any,
    onUpdateCallback?: (target: any, prop: string | symbol, value: any) => void
  ): any {
    return this.proxyRuntime.makeReactive(key, payload, onUpdateCallback);
  }

  protected bindState(root: HTMLElement, source: any): void {
    this.proxyRuntime.bind(root, source);
  }

  /**
   * @description
   * Executes the full builder lifecycle from configuration resolution to DOM initialization.
   * The method resolves the effective configuration, derives a stable identity, clears prior
   * node state, renders the component tree, and calls the subclass initializer so interactive
   * bindings are attached only after the DOM has been materialized.
   *
   * @param content - The source data payload used to construct the component tree.
   * @param config - Optional runtime overrides merged into the builder configuration.
   *
   * @returns The root DOM element produced by the builder's prepare/initialize pipeline.
   *
   * @public
   */

  public create(content: any, config?: Partial<TConfig>): HTMLElement {
    // console.log({ content, config });
    const effectiveConfig = config || (content && typeof content === "object" ? (content as any).config : undefined);
    if (effectiveConfig) this.config = this.resolveConfig(this.config, effectiveConfig);

    // Unified identity orchestration: seed, namespace, stack management
    const identity = this.ensureIdentity(content, this.config, { pushNamespace: true, popNamespace: true });
    this.#staticHierarchy = identity.hierarchy;
    this.storage.nodes.clear();
    this.activeLiveThemeId = this.config?.themeId || document.body.dataset.theme?.replace(/^theme-/, "") || "default";

    // 🟢 PROXY-FIRST: Ubah seluruh payload 'content' menjadi Reactive Proxy sejak awal
    content = this.setProxy(identity.namespace, content);

    // 🧩 CALLER WINDOW — anything instantiated from here on resolves THIS
    // builder as its caller (and therefore as its slot host).
    const previousActive = BuilderR2.#active;
    BuilderR2.#active = this;

    try {
      // Gunakan 'this.data' (Proxy Matang) untuk proses prepare()
      const DOMTree = this.prepare(content, this.config) as HTMLElement | null | undefined;
      if (!DOMTree || !(DOMTree instanceof HTMLElement)) {
        throw new Error(`[Builder:${String(this.builderId)}] prepare() returned no valid DOM element. Check selectors, template(), and the builder's render path.`);
      }

      // Detonasi event bindings interaktif klik browser
      this.initialize(DOMTree, content);

      this.hierarchy.update();
      // console.log("hierarchy", this.hierarchy.get(), identity);

      return DOMTree;
    } finally {
      // Unpin — the caller window closes together with create().
      BuilderR2.#active = previousActive;
    }
  }


  /**
   * @description
   * Creates and registers a DOM element for the requested selector token using the builder's
   * render pipeline. This method resolves the selector, applies base attributes, stores the
   * element in the local node registry, invokes the subclass template hook, and optionally wraps
   * the element in a structural wrapper chain defined by the selector configuration.
   *
   * The method is intentionally scoped around layout containers and repeating nodes. The actual
   * content injection is delegated to the subclass `template()` implementation so that each builder
   * can populate the container with its own internal structure.
   *
   * @param typeKey - The selector token that identifies the target node in the current builder.
   * @param payload - The runtime data payload associated with the node.
   * @param multiple - When true, the node is treated as a repeatable instance and can coexist
   *   with other records for the same selector token.
   *
   * @returns The created element, or undefined when the selector is not defined for the current builder.
   *
   * @protected
   */
  render(typeKey: TType, payload?: any): HTMLElement | undefined {
    const registerTheme = (key: TType, element: HTMLElement, payload: any, selector: any) => {
      if (typeof (globalThis as any).TemplateRegistry !== "undefined" && typeof (globalThis as any).TemplateRegistry.resolve === "function") {
        try {
          const registryLookupKey = (key === "@container") ? `@${String(this.builderId)}:container` : key;
          const activeHandler = (globalThis as any).TemplateRegistry.resolve("default", registryLookupKey as string, null);

          if (typeof activeHandler === "function") {
            activeHandler(registryLookupKey as string, element, payload, selector);
          }
        } catch (securityError) {
          console.warn(`[Builder Security Bypass] TemplateRegistry evaluation skipped for key "${String(key)}":`, securityError);
        }
      }
      return;
    };

    const selector = this.config.selectors?.[typeKey];
    if (!selector) {
      throw new Error(`[Builder:${String(this.builderId)}] Unknown selector "${String(typeKey)}". Check the selector map or template key name.`);
    }

    let el: HTMLElement;

    const tagName = selector.tagName || "div";
    el = document.createElement(tagName);
    this._applyNodeAttributes(el, selector);

    if (selector.wrapper) {
      const wrapperChain = this._wrapElement(selector.wrapper, el);
      if (wrapperChain) {
        (el as any).__outer = wrapperChain.__outer;
        (el as any).__inner = el;
      }
      // console.log(el)
    }

    // 🧩 SLOT RECEPTACLE — a key declared in `config.slots` is a slot THIS
    // builder provides. Stamped right here (the map was resolved once at
    // construction), so a child hosted by this builder finds it with a single
    // root-scoped query — no registry, no document sweep.
    const slotKey = this.slots[typeKey];
    if (slotKey) el.dataset.slot = slotKey;

    // 🟢 3. DAFTARKAN NODE FISIK KE #nodes
    const data = {
      key: typeKey,
      element: el,
      payload, // Konsisten mengacu pada objek reaktif yang sama
      relations: this.hierarchy.store(typeKey)
    };

    this.storage.nodes.set(typeKey, data);

    // console.log(typeKey, this.storage.nodes.entries())

    // 4. Hidrasi data awal via template()
    this.template(typeKey, el, payload, selector);

    // 5. Metadata & Emit Event
    setMetadata(el, [data || {}], typeKey as string);

    registerTheme(typeKey, el, payload, selector);

    if (this.config?.emit !== undefined) {
      // if (this.builderId == "menu") console.log("Base", { payload })
      this.config.emit?.("elementAdded", {
        builder: this.builderId as keyof iBuilderRegistry,
        type: typeKey as TType,
        element: el,
        data: payload
      });
    }

    // console.log({ payload })

    return el;
  }

  protected load(key: TType): HTMLElement | null {
    // if (this.builderId === "pricing-card") console.log(this.builderId, "this.load", nodes);
    const node = this.storage.nodes.get(key)
    // console.log({ node })

    return node?.element!;
  }

  protected payload(key: TType): any {
    return this.storage.nodes.get(key) || null;
  }

  // =====================================================================
  // 🧩 SLOTTING — attach/detach
  // =====================================================================

  /**
   * 🧩 ATTACH — project ONE of this builder's keys into a slot declared by the
   * caller's config (`slots`), and wire only that key.
   *
   * This is the default way a parent consumes a child:
   *
   *   const studio = new ColorThemeBuilder(config)
   *     .attach("@colorizer>configurator", "color-configurator")
   *     .attach("@colorizer>output", "color-output");
   *
   * No create(), so the rest of the child's tree is never built — only the keys
   * asked for. The key is rendered through the normal `render()` (so it lands in
   * the node store, `load(key)` keeps answering, and its own template() pulls in
   * the child keys that key is made of), then swapped in for the caller's
   * receptacle. The receptacle is found the cheap way: the caller's root key
   * anchors one `querySelector('[data-slot="…"]')` inside the caller's own tree.
   * Nothing is registered anywhere — `attach()` talks to `#caller`, the builder
   * that instantiated this one.
   *
   * Wiring is per-scope: initialize(node, payload) is what runs, so a builder
   * that wires by scope (see ColorTheme.initialize) binds exactly the attached
   * key — and attaching several keys to one instance keeps ONE state, ONE sync
   * effect and one binding per control (see `scopes()`).
   *
   * A builder without a caller (registry-built root / standalone page) keeps its
   * nodes in its own tree — that is the fallback, not an error.
   *
   * @param typeKey  key of this builder to project (a key of my selector map).
   * @param slotKey  slot declared by the caller's config.
   * @param payload  data this key's template() needs; omit it when the template
   *                 can derive what it needs from the builder's own state.
   * @returns the current builder for chaining.
   */
  public attach(typeKey: TType, slotKey: string, payload?: any): this {
    // 🥾 attach() is an entry point of its own — boot without content so the key
    // below can be rendered even though create() never ran.
    if (!Object.keys(this.hierarchy.get()).length) {
      const identity = this.ensureIdentity(undefined, this.config, { pushNamespace: true, popNamespace: true });
      this.#staticHierarchy = identity.hierarchy;
      this.storage.nodes.clear();
      this.activeLiveThemeId = this.config?.themeId || document.body.dataset.theme?.replace(/^theme-/, "") || "default";
    }

    const node = this.load(typeKey) ?? this.render(typeKey, payload);
    if (!node) return this;

    const caller = this.#caller;
    if (!caller) return this;

    const callerSels = Object.keys(caller.hierarchy.get());
    const callerRootKey = callerSels[0] as TType | undefined;
    const callerRoot = callerRootKey ? (caller.load(callerRootKey) ?? null) : null;
    const receptacle = callerRoot?.querySelector<HTMLElement>(`[data-slot="${slotKey}"]`);
    if (!receptacle) {
      console.warn(
        `[Builder:${String(this.builderId)}] attach("${String(typeKey)}") found no receptacle for slot ` +
        `"${slotKey}" in caller "${String(caller.builderId)}" — declare it in the caller's config.slots.`
      );
      return this;
    }

    // A wrapped key occupies the tree through its wrapper chain, so that chain
    // is what gets projected (the inner element stays the registered node).
    const element = ((node as any).__outer as HTMLElement | undefined) ?? node;

    element.dataset.slot = slotKey;
    this.#projected.set(typeKey, { slot: slotKey, element, receptacle });

    // 🔀 WELD — the receptacle's hooks (its classes/style scope, its attributes)
    // are carried onto the projected node, which then takes its place. Stamped
    // `data-slot` above wins, and the receptacle's inline `style` is left behind
    // (that is the empty-placeholder state, not chrome).
    element.classList.add(...Array.from(receptacle.classList));
    for (const { name, value } of Array.from(receptacle.attributes)) {
      if (name === "style" || element.hasAttribute(name)) continue;
      element.setAttribute(name, value);
    }
    receptacle.replaceWith(element);

    this.rootElement ??= callerRoot;


    // 🔌 Wire THIS key only. Re-entering a scope is harmless (bind refreshes an
    // existing binding instead of stacking listeners), which is exactly why
    // attaching configurator + output + mode to one instance stays in sync
    // without duplicating anything.
    this.initialize(element, payload);
    return this;
  }

  /**
   * 🧷 DETACH — hand the caller its receptacle back and return the projected
   * node to its owner (still registered, ready to re-attach).
   *
   * @param slotKey  slot to release.
   * @returns current builder.
   */
  public detach(slotKey: string): this {
    for (const [typeKey, entry] of this.#projected) {
      if (entry.slot !== slotKey) continue;
      if (entry.element.parentNode) entry.element.replaceWith(entry.receptacle);
      this.#projected.delete(typeKey);
    }
    return this;
  }

  /**
   * 🔌 WIRING SCOPES — every DOM location this instance paints: the builder
   * root first, then each node projected into my caller's slot.
   *
   * This is what makes initialize()/sync slot-aware: a builder is exactly as
   * multi-rooted as its projections, so initialize() runs once for the root and
   * loops `scopes()`, while the reactive sync loop repaints every scope — that
   * is how a projected panel stays wired and in sync with the owner's state.
   */
  protected scopes(): HTMLElement[] {
    const scopes: HTMLElement[] = [];
    const ownRootKey = Object.keys(this.hierarchy.get())[0] as TType | undefined;
    const root = ownRootKey ? this.load(ownRootKey) : null;
    if (root) scopes.push(root);

    for (const { element } of this.#projected.values()) {
      // A parked projection still lives under the root → already covered by it.
      if (element === root || root?.contains(element)) continue;
      scopes.push(element);
    }
    return scopes;
  }


  /**
   * @description
   * Removes one or more registered nodes from the active builder instance in a single call.
   * The method detaches the underlying DOM elements from the page and clears the matching
   * records from the local node registry so the builder state stays consistent.
   *
   * @param typeKeys - One or more selector tokens whose live DOM nodes should be removed.
   *
   * @protected
   */
  protected remove(...typeKeys: TType[]): void {
    typeKeys.forEach((key) => {
      const liveElement = this.load(key) as HTMLElement;
      if (liveElement) liveElement.remove();
      this.storage.nodes.delete(key);
    });
  }

  /**
   * @description
   * Cleans up the builder instance by notifying listeners, removing the root DOM element,
   * clearing the internal node registry, and releasing references held by the instance.
   * This method is the lifecycle termination point for a builder and should be invoked when
   * the component is unmounted or discarded.
   *
   * @param typeKey - Optional selector token used to target a specific root node for removal.
   *   When omitted, the builder attempts to remove the default container node.
   *
   * @public
   */
  public destroy(typeKey?: TType): void {
    // 1. Tembakkan emisi laporan kematian struktur ke pusat orkestrator luar
    if (this.config?.emit) {
      this.config.emit("elementRemoved", {
        builder: this.builderId,
        data: null // Bebas dari tracking rawDataNode kotor
      });
    }

    // ====================================================
    // 🔮 THE ANCESTRAL POINTER EXTRACTOR (EVAKUASI DARI MAP POOL)
    // Jemput elemen root hidup dari dalam saku standard identifier @container!
    // ====================================================
    const rootElement = this.storage.nodes.get(typeKey || "@container" as TType)?.element

    if (rootElement) {
      // Cabut dari silsilah induk bodi HTML jika memiliki parentNode aktif di browser
      if (rootElement.parentNode) {
        rootElement.parentNode.removeChild(rootElement);
      } else {
        // Fallback jika berdiri standalone di dalam RAM fragment memory
        rootElement.remove();
      }

      console.log(`[Lifecycle Security] DOM Element Node for "${String(this.builderId)}" successfully unmounted.`);
    }

    this.storage.nodes.clear();

    // 🧩 Give my caller its receptacles back: projections do not outlive me.
    for (const slotKey of new Set(Array.from(this.#projected.values(), (entry) => entry.slot))) {
      this.detach(slotKey);
    }

    this.config = null as any;
    this.instanceNamespace = null;

    // console.log(`[Lifecycle Security] _nodes Map successfully liquidated. Memory state at 0B leak.`);
  }


  /**
   * Recursively parses CSS selector chains (e.g., ".column>neon", "div.col-4>.card-wrapper")
   * into a nested DOM hierarchy.
   */
  private _wrapElement(wrapperStr: string, targetElement: HTMLElement): HTMLElement | null {
    if (!wrapperStr || !targetElement) return null;

    const parts = wrapperStr.split(">").map((s: string) => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    const parseNode = (segment: string): HTMLElement => {
      const parsedAttrs: Record<string, string> = {};

      // ====================================================
      // 🧙‍♂️ THE ATTRIBUTE BRACKET EXTRACTOR
      // ====================================================
      const attrRegex = /\[\s*([a-zA-Z0-9_-]+)\s*=\s*['"]?([^'"]*)['"]?\s*\]/g;
      let match;
      while ((match = attrRegex.exec(segment)) !== null) {
        const attrName = match[1];
        const attrValue = match[2];
        parsedAttrs[attrName] = attrValue;
      }

      // Bersihkan segmen string dari blok kurung siku [...] yang sudah diperas
      const cleanSegment = segment.replace(/\[[^\]]*\]/g, "");

      // ====================================================
      // ⚡ FIX TOKENIZER: Memecah berdasarkan batasan penanda . atau #
      // ====================================================
      const tokens = cleanSegment.split(/(?=[.#])/);

      let tagName = "div";
      let id = "";
      const classList: string[] = [];

      // Jika token pertama tidak diawali . atau #, berarti itu adalah Nama Tag
      if (tokens.length > 0 && !tokens[0].startsWith(".") && !tokens[0].startsWith("#")) {
        tagName = tokens[0];
      }

      // Iterasi seluruh token untuk mengumpulkan ID dan Multi-Class secara dinamis
      tokens.forEach((token) => {
        if (!token) return;
        if (token.startsWith("#")) {
          id = token.slice(1);
        } else if (token.startsWith(".")) {
          classList.push(token.slice(1));
        }
      });

      // Mulai cetak fisik elemen boks pembungkus

      const el = document.createElement(tagName);
      if (id) el.id = id;
      if (classList.length > 0) el.className = classList.join(" ");

      // 🟢 DISBURSMENT: Siram seluruh hasil tangkapan atribut kurung siku ke dalam elemen!
      Object.entries(parsedAttrs).forEach(([aName, aValue]) => {
        el.setAttribute(aName, aValue);
      });

      return el;
    };

    // 1. Bangun benteng terluar (Root Wrapper)
    const __outer = parseNode(parts[0]);
    let innerPointer = __outer;

    // 2. Bangun silsilah rantai bersarang ke dalam
    for (let i = 1; i < parts.length; i++) {
      const child = parseNode(parts[i]);
      innerPointer.appendChild(child);
      innerPointer = child;
    }

    // 3. 🟢 DIRECT ATTACHMENT: Tancapkan elemen asli hidup tepat ke rahim terdalam wrapper
    innerPointer.appendChild(targetElement);
    // 4. 👑 RETURN ASLI ANDA DIIPERTAHANKAN 100%
    // Format objek literal koordinat dua arah tetap utuh sesuai arsitektur framework Anda
    return { __outer, __inner: targetElement } as HTMLElement;
  }



  /**
   * 🧱 THE ATTR AND METADATA WELDER (POS PENGURUS DATA ATRIBUT)
   * Melumat tuntas ID, ClassName, kustom attrs, hingga data- attributes bawaan database Sheets.
   * Pair-stamping delegated to Utility/AttributeUtils.
   */
  private _applyNodeAttributes(el: HTMLElement, selector: any): void {
    if (!selector) return;

    // 1. Suntikkan Identitas ID jika didefinisikan kaku di dalam selektor preset
    if (selector.id && selector.id !== "") {
      el.id = selector.id;
    }

    // 2. Suntikkan Kosmetik ClassName standar secara aman
    if (selector.className && selector.className !== "") {
      el.className = selector.className;
    }

    // 3. 🧙‍♂️ SAFE ATTRS: dictionary `attrs` + array `attributes` (shared utils)
    applyAttrDictionary(el, selector.attrs);
    applyAttributeList(el, selector.attributes);
  }

}

// ====================================================
// 🛡️ BENTENG LAPIS 2: THE SECURE IMMUTABLE PROTOTYPE CHAIN (MAHKOTA PERTAHANAN BARU!)
// Tepat di bawah deklarasi kelas, kita BEKUKAN total cetakan 'BuilderBase.prototype'.
// Ini adalah taktik runtime locking paling legal dan aman di JavaScript.
// Hacker/script luar GARANSI 100% tidak akan bisa mengganti jeroan .create atau .render!
// ====================================================
Object.freeze(BuilderR2.prototype);
