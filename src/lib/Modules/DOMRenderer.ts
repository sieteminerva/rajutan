
import type { DefaultSelectors, iBuilderRegistry, iNodeContent, iNodeRecordItem } from "../interface";
import { ensureMetadataIdentity, setMetadata } from "../Utility/Metadata";

type BuildContext = {
  scopeId: string;
  parentKey: string | null;
  pathMap: Map<string, string>;
};

// @ts-ignore
function isValidHTMLTag(tag: string): tag is keyof HTMLElementTagNameMap {
  // Browser otomatis mengembalikan HTMLUnknownElement jika tag tidak dikenali
  return !(document.createElement(tag) instanceof HTMLUnknownElement);
}

export class DOMRenderer<
  C extends Partial<any> = {},
  S extends string = DefaultSelectors
> {
  config!: any;
  #cleanupMap = new Map<HTMLElement, (element: HTMLElement) => void>();
  private records: iNodeRecordItem[] = [];

  constructor(config?: C) {
    const defaultConfig: any = {
      selectors: {
        container: { tagName: 'main', name: `page`, className: 'page' },
        grid: { tagName: 'div', isClass: true, name: 'grid', className: 'grid' },
        row: { tagName: 'div', isClass: true, name: 'row', className: 'row' },
        column: { tagName: 'div', isClass: true, name: 'column', className: 'column' }
      },
      separator: { id: '#', class: '.', ignored: '$', include: '-' }
    };

    this.config = {
      ...defaultConfig,
      ...config,
      selectors: { ...defaultConfig.selectors, ...config?.selectors }
    };
  }

  private parseKey(key: string): { id?: string; classNames: string[]; baseName: string; parsedAttrs: Record<string, string> } {
    const { id: idSep, class: classSep, ignored } = this.config.separator;

    // 1. Clean the key string from the ignored token delimiter ($) if present
    let cleanKey = key.includes(ignored) ? key.split(ignored)[0] : key;

    const parsedAttrs: Record<string, string> = {};

    // ====================================================
    // 🧙‍♂️ THE ATTRIBUTE BRACKET EXTRACTOR (SIHIR REGEX PILIHAN JENIUS ANDA!)
    // Mendeteksi dan memeras semua pola [attr='value'] atau [attr="value"] di dalam key string
    // ====================================================
    const attrRegex = /\[\s*([a-zA-Z0-8_-]+)\s*=\s*['"]?([^'"]*)['"]?\s*\]/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(cleanKey)) !== null) {
      const attrName = attrMatch[1];
      const attrValue = attrMatch[2];
      parsedAttrs[attrName] = attrValue;
    }

    // Bersihkan seluruh blok kurung siku [...] dari key utama agar tidak mengacaukan parsing ID dan Class
    cleanKey = cleanKey.replace(/\[[^\]]*\]/g, '');

    // Escape karakter separator untuk RegEx
    const escId = idSep.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const escClass = classSep.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    // 2. Ambil Base Name / Tag Name (Karakter di awal sebelum bertemu # atau .)
    const baseNameMatch = cleanKey.match(new RegExp(`^([^${escId}${escClass}]+)`));
    let baseName = baseNameMatch ? baseNameMatch[1] : 'div';

    // 3. Ambil ID secara presisi (Karakter setelah # sebelum bertemu . atau [ berikutnya)
    const idMatch = cleanKey.match(new RegExp(`${escId}([^${escId}${escClass}]+)`));
    const id = idMatch ? idMatch[1] : undefined;

    // 4. Ambil Semua Class Names secara berulang (Semua karakter setelah tanda titik)
    const classRegex = new RegExp(`${escClass}([^${escId}${escClass}]+)`, 'g');
    let classNames: string[] = [];
    let match;
    while ((match = classRegex.exec(cleanKey)) !== null as any) {
      classNames.push((match as any)[1]);
    }

    return {
      id,
      classNames,
      baseName: baseName.replace(/-/g, ' '),
      parsedAttrs
    };
  }

  // ====================================================
  // 👑 PIPELINE MASTER HUB (THE 5-PHASE SEPARATION ARCHITECTURE)
  // ====================================================

  /**
   * Main compilation gateway that transforms declarative iNodeContent schemas into live DOM trees.
   */
  public render(
    content: iNodeContent<S>,
    renderFn: ((node: any) => HTMLElement | null) | undefined,
    builderFn: ((name: keyof iBuilderRegistry, data: any) => HTMLElement | null) | undefined,
    options?: { scopeId?: string; parentKey?: string | null }
  ): HTMLElement {
    const fragment = document.createDocumentFragment();

    this.records = [];

    this.buildStructure(content, fragment, renderFn, builderFn, {
      scopeId: options?.scopeId || "",
      parentKey: options?.parentKey || null,
      pathMap: new Map<string, string>()
    });

    let rootElement: HTMLElement;
    if (fragment.childNodes.length === 1 && fragment.firstChild instanceof HTMLElement) {
      rootElement = fragment.firstChild;
    } else {
      rootElement = document.createElement('div');
      rootElement.appendChild(fragment);
      rootElement = (rootElement.firstElementChild as HTMLElement) || rootElement;
    }

    setMetadata(rootElement, this.records, "");

    return rootElement;
  }


  private buildStructure(
    structure: any,
    parentNode: HTMLElement | DocumentFragment,
    renderFn: ((node: any) => HTMLElement | null) | undefined,
    builderFn: ((name: keyof iBuilderRegistry, data: any) => HTMLElement | null) | undefined,
    context: BuildContext = {
      scopeId: "",
      parentKey: null,
      pathMap: new Map<string, string>()
    }
  ): void {

    // 💡 PENAMPUNG STORAGE ELEMEN HIDUP UNTUK PASUKAN STRUKTUR FLAT DENGAN TOKEN '>'
    const flatNodesMap = new Map<string, HTMLElement>();
    for (const [key, value] of Object.entries(structure)) {
      // console.log({ key, value })
      if (!value || typeof value !== 'object') continue;
      // if (!key.startsWith(".") || !key.startsWith("#") || !isValidHTMLTag(key)) continue;
      // if (value instanceof Node) value.content = value;
      // ====================================================
      // 🧙‍♂️ THE HOLY CASCADING HIERARCHY ABSORBER (IDE BERLIAN ANDA!)
      // Jika kunci mengandung tanda '>', belah stringnya menggunakan tanda '>' !
      // ====================================================
      const pathParts = key.split(">");
      const isHierarchical = pathParts.length > 1;

      // Ambil kunci asli paling ekor untuk di-parse tag/class/id-nya oleh parseKey()
      const cleanKeyForParsing = isHierarchical ? pathParts[pathParts.length - 1] : key;
      const { id, classNames, baseName, parsedAttrs } = this.parseKey(cleanKeyForParsing);

      // 🚨 ATURAN SAKRAL MULTI-INSTANCE DIRECTIVE:
      // Jika induk dari token ini bertanda array loop, abaikan pencetakan statis di hulu!
      if (isHierarchical) {
        const parentPathKey = pathParts.slice(0, -1).join(">");
        const parentValue = structure[parentPathKey];
        if (parentValue && (parentValue.isArray || key.includes("$isArray"))) continue;
      }

      // ATTACHING METADATA di buildStructure
      let targetSelectorKey = key;
      if (!(value as any).builder && ((value as any).content instanceof HTMLElement || (value as any).isRoot)) {
        targetSelectorKey = (value as any).content instanceof HTMLElement
          ? (value as any).content.tagName.toLowerCase()
          : baseName;
        // console.log({ targetSelectorKey })
      }

      // Phase 1: 🏗️ NODE FACTORY
      const relayKey = ensureMetadataIdentity(targetSelectorKey, context.scopeId, "", key).key;
      const relayedElement = (globalThis as any).ElementCreatedEventBus?.relay?.(relayKey);
      let currentElement = relayedElement || this.nodeFactory(baseName, value);

      if (relayedElement) {
        currentElement.replaceChildren();
      }

      // Phase 2: 🧱 ATTRIBUTE PROCESSOR
      this.attributeProcessor(currentElement, value, id, classNames, parsedAttrs);

      const identity = ensureMetadataIdentity(targetSelectorKey, context.scopeId, "", key);
      const currentGlobalKey = identity.key;

      let resolvedParentKey: string | null = context.parentKey;
      if (isHierarchical) {
        const parentPathKey = pathParts.slice(0, -1).join(">");
        resolvedParentKey = context.pathMap.get(parentPathKey) || context.parentKey;
      }

      identity.tree!.parent = resolvedParentKey;
      context.pathMap.set(key, identity.key);

      // =========================================================================
      // 🟢 KEMENANGAN TOTAL 1-LINER METADATA (0% KOTOR DI DALAM PERUT REKURSIF!)
      // Sederhana, horizontal, dan bersih setipis silet mengikuti pakem sakral Anda!
      // =========================================================================

      this.attachMetadata(currentGlobalKey, currentElement, value, identity.tree);

      this.mountHandler(currentGlobalKey, currentElement, identity.tree);

      // Phase 3: 🔒 LIFECYCLE MANAGER
      this.lifecycleManager(currentElement, value, renderFn, builderFn);

      // Phase 4: 🧙‍♂️ CONTENT EVALUATOR
      this.contentEvaluator(currentElement, value, renderFn, builderFn, {
        scopeId: context.scopeId,
        parentKey: currentGlobalKey,
        pathMap: context.pathMap
      });

      // Amankan pointer reference elemen hidup ke dalam map lokal selama siklus loop berjalan
      flatNodesMap.set(key, currentElement);

      // ====================================================
      // 🔮 ABAKADABRA AUTOMATED NESTED APPEND (PENYERAPAN TOTAL BUILDERBASE!)
      // Jika dia adalah kunci hierarki '>', temukan induknya di Map, lalu langsung tempelkan!
      // ====================================================
      if (isHierarchical) {
        const parentPathKey = pathParts.slice(0, -1).join(">");
        const parentElement = flatNodesMap.get(parentPathKey);

        if (parentElement) {
          parentElement.appendChild(currentElement);
          continue; // Keluar, tidak perlu menempel ke parentNode terluar!
        }
      }

      // Phase 5: RECURSIVE NESTED KEYS TRAVERSAL (Untuk format objek bersarang bawaan DOMRenderer asli)
      const reservedKeys = ['content', 'onCreated', 'onDestroy', 'builder', 'attrs', 'attributes', 'isRoot', 'isArray', 'config', 'selectors', 'options'];
      const childKeys = Object.keys(value).filter(k => !reservedKeys.includes(k));

      if (childKeys.length > 0) {
        const subFragment = document.createDocumentFragment();
        const childStructure: any = {};
        for (const childKey of childKeys) {
          childStructure[childKey] = (value as any)[childKey];
        }
        this.buildStructure(childStructure, subFragment, renderFn, builderFn, {
          scopeId: context.scopeId,
          parentKey: currentGlobalKey,
          pathMap: context.pathMap
        });
        // UNWRAP UNTUK ANAK-ANAK BERSARANG DI DALAM PERUT SUB-FRAGMENT
        // attachMetadata(currentElement, this.records, identity.tree!.key);
        currentElement.appendChild(subFragment);
      }

      // Jika bukan anak hierarki (alias root container), tempelkan ke parentNode utama
      parentNode.appendChild(currentElement);
    }
  }

  /**
   * 👑 ATTACH METADATA (SATU-SATUNYA PUSAT PENGENDALIAN MEMORI MARKUP MANUAL ANDA!)
   * Sekarang bertindak sebagai gerbang tunggal: Mencatat silsilah, menjahit children dua arah,
   * dan langsung menyuntikkan tangki lazy closure getMetadata ke kulit ari elemen!
   */
  private attachMetadata(globalKey: string, el: HTMLElement, val: any, tree: any): void {
    const elementSelector = (() => {
      const tag = el.tagName ? el.tagName.toLowerCase() : "div";
      const idPart = el.id ? `#${el.id}` : "";
      const classPart = el.className && typeof el.className === "string"
        ? `.${el.className.trim().split(/\s+/).filter(Boolean).join(".")}`
        : "";
      return `${tag}${idPart}${classPart}`;
    })();

    const isBuilderRoot = !!val?.builder && !!val?.isRoot;
    const effectiveGlobalKey = globalKey;
    const builderTemplateKey = isBuilderRoot ? `@${String(val.builder)}` : null;

    const manualMarkupRecordItem: iNodeRecordItem = {
      key: globalKey,
      element: el,
      // raw: val,
      payload: null,
      relations: tree
    };

    if (manualMarkupRecordItem.relations) {
      if (isBuilderRoot) {
        manualMarkupRecordItem.relations.key = elementSelector;
        manualMarkupRecordItem.relations.template = builderTemplateKey || manualMarkupRecordItem.relations.template || elementSelector;
      }
      else {
        manualMarkupRecordItem.relations.template = manualMarkupRecordItem.relations.template || manualMarkupRecordItem.relations.key;
      }
    }

    this.records.push(manualMarkupRecordItem);

    if (val.builder && val.content && typeof val.content.getMetadata === "function") {

      // Target bapak sejati dari komponen dinamis ini adalah KOORDINAT KEY DIRINYA SAAT INI (globalKey)
      const builderOutputMeta = val.content.getMetadata({
        scopeId: tree.scope,
        parentKey: effectiveGlobalKey // 🔗 Ikat tali pusar bapak komponen pintar ke arah dirinya saat ini!
      });

      if (builderOutputMeta && builderOutputMeta.length > 0) {
        const builderRootMeta = builderOutputMeta.find((childRec: any) => {
          if (!childRec || !childRec.relations) return false;
          return childRec.relations.key === builderTemplateKey || childRec.relations.parent === null;
        }) || builderOutputMeta[0];

        const rootChildren = Array.isArray(builderRootMeta?.relations?.children)
          ? [...builderRootMeta.relations.children]
          : [];

        if (manualMarkupRecordItem.relations) {
          manualMarkupRecordItem.relations.children = rootChildren;
          manualMarkupRecordItem.payload = builderRootMeta?.payload ?? manualMarkupRecordItem.payload;
        }

        builderOutputMeta.forEach((childRec: any) => {
          if (!childRec) return;

          const childScope = childRec?.relations?.scope || tree.scope || "";
          const childSelectorKey = childRec?.relations?.key || childRec?.relations?.template || "";
          const childGlobalKey = ensureMetadataIdentity(childSelectorKey, childScope).key;
          // console.log({ childGlobalKey, childRec })

          if (childRec === builderRootMeta || childRec.relations?.key === builderTemplateKey) {
            childRec.relations.scope = childScope;
            childRec.relations.parent = globalKey;
            childRec.relations.key = globalKey;
            childRec.relations.template = builderTemplateKey || childRec.relations.template || childRec.relations.key;
            return;
          }

          // A. ⚡ TERUSKAN KE POOL UTAMA: Masukkan records dynamic anak builder ke pool records kelas tanpa duplikasi fisik
          if (!this.records.some(r => r.element === childRec.element)) {
            this.records.push(childRec);
          }

          // B. ⚡ SEKRUP BALIK SILSILAH DUA ARAH (MENGHANCURKAN TOTAL CACAT CHILDREN KOSONG []):
          // Jika item ini adalah bagian root terluar dari komponen pintar anak (yang .parent-nya menunjuk ke dirinya)
          if (childRec.relations.parent === globalKey || childRec.relations.parent === null) {
            childRec.relations.scope = childScope;
            childRec.relations.parent = childRec.relations.parent || globalKey;
            childRec.relations.template = childRec.relations.template || childRec.relations.key;

            const parentRelations = manualMarkupRecordItem.relations!;
            if (!parentRelations.children) parentRelations.children = [];
            if (!parentRelations.children.includes(childGlobalKey)) {
              parentRelations.children.push(childGlobalKey);
              console.log(parentRelations.children)
              console.log(`📌 [JIT Emitter Bridge -> Connected]: Linked dynamic builder "${childGlobalKey}" into static parent trunk "${effectiveGlobalKey}"`);
            }
          }
        });
      }
    }

    // 2. Tempelkan saku lazy closure getMetadata bawaan untuk kulit ari elemen manual markup saat ini murni via utils
    setMetadata(el, this.records);

    // =========================================================================
    // ⚡ HUBUNGKAN SILSILAH INDUK MANUAL MARKUP (Hulu ke Atas Antar Tag Statis)
    // =========================================================================
    const parentKey = tree?.parent;
    if (parentKey) {
      const parentItem = this.records.find(r => ensureMetadataIdentity(r.relations?.key || "", r.relations?.scope || "").key === parentKey);
      if (parentItem && parentItem.relations) {
        if (!parentItem.relations.children) parentItem.relations.children = [];
        if (!parentItem.relations.children.includes(effectiveGlobalKey)) {
          parentItem.relations.children.push(effectiveGlobalKey);
        }
      }
    }
  }

  private mountHandler(key: string, currentElement: HTMLElement, treeRelations: iNodeRecordItem["relations"]) {
    currentElement.mount = (compositeOutput: any) => {
      if (!compositeOutput) return;
      const childElement = compositeOutput.element || (compositeOutput instanceof HTMLElement ? compositeOutput : null);
      if (!childElement) return;

      currentElement.appendChild(childElement);

      if (compositeOutput.metadata && compositeOutput.metadata.records) {
        compositeOutput.metadata.records.forEach((childItem: any) => {
          if (childItem.relations && childItem.relations.parent === null) {
            const childGlobalKey = ensureMetadataIdentity(childItem.relations.template || childItem.relations.key || "", childItem.relations.scope || "").key;
            childItem.relations.parent = key;

            if (treeRelations?.children && !treeRelations.children.includes(childGlobalKey)) {
              treeRelations.children.push(childGlobalKey);
              console.log(`🚀 [JIT .mount Link]: Fast-linked dynamic child node "${childGlobalKey}" into trunk "${key}"`);
            }
          }
        });
      }
    };
  }


  // ====================================================
  // 🧱 PIPI KHUSUS SUB-ROUTINES LIFECYCLE POS KEMENTERIAN INDEPENDEN
  // ====================================================

  /**
   * Phase 1: Spawns clean HTMLElement instances or intercepts live hijacked nodes.
   */
  private nodeFactory(baseName: string, value: any): HTMLElement {
    // if (value instanceof HTMLElement) {
    //   return value;
    // }
    if (value.content instanceof HTMLElement) {
      return value.content;
    }
    return baseName ? document.createElement(baseName) : document.createElement('div');
  }

  /**
   * Phase 2: Stamps IDs, classNames list, and handles custom inline data attributes dictionary.
   */
  private attributeProcessor(el: HTMLElement, value: any, id: string | undefined, classNames: string[], parsedAttrs: Record<string, string>): void {
    if (id && !el.id) el.id = id;

    if (classNames.length > 0) {
      const existingClasses = el.className ? el.className.trim().split(/\s+/) : [];
      const combinedClasses = new Set([...existingClasses, ...classNames].filter(Boolean));
      el.className = Array.from(combinedClasses).join(' ');
    }

    // ====================================================
    // 🔮 THE HYBRID BLENDING PIPELINE (PUNCAK EFEKTIVITAS SATU ATAP!)
    // Melebur atribut hasil kupasan dari String Key DAN objek property 'attrs' deklaratif
    // ====================================================

    // 💡 Aliran A: Las atribut hantaran hasil kupasan dari kurung siku key string
    Object.entries(parsedAttrs).forEach(([aName, aValue]) => {
      el.setAttribute(aName, String(aValue));
    });

    // 💡 Aliran B: Las atribut dinamis dari properti 'attrs' bawaan Sheets (menimpa jika ada benturan kunci)
    if (value.attrs && typeof value.attrs === 'object') {
      Object.entries(value.attrs).forEach(([aName, aValue]) => {
        el.setAttribute(aName, String(aValue));
      });
    }

    // 💡 Aliran C: Las atribut dinamis dari properti 'attributes' selaras dengan input builder
    if (value.attributes && Array.isArray(value.attributes)) {
      for (const attr of value.attributes) {
        if (typeof attr === 'object' && attr?.name) {
          if (typeof attr.value === "function" && (attr.name as string).startsWith("on")) {
            (el as any)[attr.name as string] = attr.value;
          } else {
            el.setAttribute(attr.name, attr.value);
          }
        }
      }
    }
  }

  /**
   * Phase 3: Triggers onCreated lifecycle bindings securely via sandbox proxies closures.
   */
  private lifecycleManager(
    el: HTMLElement,
    value: any,
    renderFn: ((node: any) => HTMLElement | null) | undefined,
    builderFnArgs: ((name: keyof iBuilderRegistry, data: any) => HTMLElement | null) | undefined
  ): void {
    if (typeof value.onCreated === 'function') {
      const renderProxy = (schema: any): HTMLElement | null => {
        return renderFn ? renderFn(schema) : null;
      };

      const builderProxy = (name: keyof iBuilderRegistry, data: any): any => {
        return builderFnArgs ? builderFnArgs(name, data) : null;
      };


      const templateProxy = {
        /**
         * Mengizinkan komponen mendaftarkan fungsi template override secara manual dari dalam onCreated
         */
        register: (themeId: string, selectorKey: string, handler: any) => {
          if ((globalThis as any).TemplateRegistry && typeof (globalThis as any).TemplateRegistry.register === "function") {
            console.log(`[DOMRenderer Lifecycle] Manual template registration triggered for token: "${selectorKey}"`);
            (globalThis as any).TemplateRegistry.register(themeId, selectorKey, handler);
          }
        },
        /**
         * Mengizinkan komponen mencabut fungsi template miliknya saat unmount jika dibutuhkan
         */
        unregister: (themeId: string, selectorKey: string) => {
          if ((globalThis as any).TemplateRegistry && typeof (globalThis as any).TemplateRegistry.unregister === "function") {
            (globalThis as any).TemplateRegistry.unregister(themeId, selectorKey);
          }
        }
      };

      value.onCreated(el, renderProxy, builderProxy, templateProxy);
    }

    if (typeof value.onDestroy === 'function') {
      this.#cleanupMap.set(el, value.onDestroy);
    }
  }

  /**
   * Phase 4: Hydrates the inner content node chambers dynamically using polymorphic sniffing.
   */
  private contentEvaluator(
    el: HTMLElement,
    value: any,
    renderFn: ((node: any) => HTMLElement | null) | undefined,
    builderFn: ((name: keyof iBuilderRegistry, data: any) => HTMLElement | null) | undefined,
    context: BuildContext = {
      scopeId: "page",
      parentKey: null,
      pathMap: new Map<string, string>()
    }
  ): void {

    if (value.content === undefined) return;
    if (value.builder) {
      return;
    }
    const nodePayload = value.content;
    const parentGlobalKey = context.parentKey;
    // console.log({ nodePayload }) // <= ini malah betul masing-masing 1x
    if (nodePayload instanceof Node) {
      if (nodePayload !== el && !el.contains(nodePayload)) {
        el.appendChild(nodePayload);
      }
    }
    else if (Array.isArray(nodePayload)) {
      const subFragment = document.createDocumentFragment();
      nodePayload.forEach((childItem) => {
        if (childItem && typeof childItem === "object") {
          this.buildStructure(childItem, subFragment, renderFn, builderFn, {
            scopeId: context.scopeId,
            parentKey: parentGlobalKey,
            pathMap: context.pathMap
          });
        }
      });
      el.appendChild(subFragment);
    }
    else if (typeof nodePayload === 'object' && nodePayload !== null) {
      const subFragment = document.createDocumentFragment();
      this.buildStructure(nodePayload, subFragment, renderFn, builderFn, {
        scopeId: context.scopeId,
        parentKey: parentGlobalKey,
        pathMap: context.pathMap
      });
      el.appendChild(subFragment);
    }
    else {

      el.insertAdjacentHTML("afterbegin", nodePayload);
    }
  }

  /**
   * Safe Destroy Method: Unmounts an element tree from the DOM and recursively executes cleanup hooks.
   */
  public unmount(targetElement: HTMLElement): void {
    this.#cleanupMap.forEach((onDestroyFn, element) => {
      if (targetElement.contains(element) || targetElement === element) {
        try {
          onDestroyFn(element);
        } catch (error) {
          console.error("Failed to execute onDestroy lifecycle hook:", error);
        }
        this.#cleanupMap.delete(element);
      }
    });

    if (targetElement.parentNode) {
      targetElement.parentNode.removeChild(targetElement);
    }
  }
}
