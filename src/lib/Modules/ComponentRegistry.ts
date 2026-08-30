import type { ComponentBuilderFn, iBasicNode, iBuilderRegistry } from "../interface";
import { Builder } from "../Components/Base";


// 💡 DEKLARASI KONTAK LAZY LOAD UNTUK MODEL METADATA (STYLE 3)
export interface iSimpleWayManifest {
  path: string;
  stylesheet?: string;
  script?: string;
  config?: any;
  schema?: any;
}

export type LoadFn = (options: { script?: string; stylesheet?: string }) => Promise<any>;

// Polimorfisme Tanda Tangan Registrasi yang Sah di Framework Anda
export type RegisterFn<K extends keyof iBuilderRegistry> =
  | ComponentBuilderFn<iBuilderRegistry[K]> // OldWayFn / Standard murni (Style 1)
  | ((data: iBuilderRegistry[K], load: LoadFn) => Promise<HTMLElement | null>) // ConfigurableWayFn (Style 2)
  | ((data: iBuilderRegistry[K], config?: any) => iSimpleWayManifest); // SimpleWayFn Manifest (Style 3)

// 💡 PETA REGISTER VITE: Hanya aktif dan dibaca saat masa development lokal!
const viteModules = import.meta.glob("/src/lib/Components/**/*.{ts,tsx,js,jsx}", { eager: false });
const viteStyles = import.meta.glob("/src/lib/Components/**/*.css", { query: '?inline', import: 'default' });

function normalizeVitePath(pathStr: string): string {
  if (!pathStr) return "";
  let clean = pathStr.trim().replace(/\\/g, "/");
  if (clean.startsWith("./")) clean = clean.slice(2);
  if (clean.startsWith("/")) clean = clean.slice(1);
  if (!clean.startsWith("src/")) clean = `src/${clean}`;
  return `/${clean}`;
}

function resolveRelativePath(baseScriptPath: string, stylePath: string): string {
  if (!stylePath) return "";
  if (!stylePath.startsWith("./") && !stylePath.startsWith("../")) {
    return stylePath;
  }
  if (!baseScriptPath) return stylePath;
  const scriptDir = baseScriptPath.substring(0, baseScriptPath.lastIndexOf("/") + 1);
  return (scriptDir + stylePath.replace(/^\.\//, "")).replace(/\/+/g, "/");
}

// 🔎 Lookup helper untuk peta glob CSS: exact match dulu, lalu scan case-insensitive
// (Windows FS longgar soal case, tapi KEYS hasil import.meta.glob tidak toleran salah case)
function findStyleLoader(key: string): (() => Promise<any>) | undefined {
  if (!key) return undefined;
  const map = viteStyles as Record<string, () => Promise<any>>;
  if (typeof map[key] === "function") return map[key];
  const lower = key.toLowerCase();
  const matched = Object.keys(map).find(k => k.toLowerCase() === lower);
  return matched ? map[matched] : undefined;
}

const DEV = (import.meta as any).env?.DEV === true;

export class ComponentRegistry {
  private builders = new Map<keyof iBuilderRegistry, RegisterFn<any>>();
  private registeredSheets = new Set<CSSStyleSheet>();
  // 🧯 Fallback <style> tags saat CSSStyleSheet.replaceSync() melempar
  // (CSS modern mentah — nesting, @starting-style, ::picker — yang belum
  // didukung penuh parser CSSOM browser). ID di-dedup via DOM supaya
  // preload + build paralel / instance-ulang tidak menggandakan style tag.
  private _injectedStyleTags = new Set<string>();
  // 💡 Deklarasikan cache secara formal agar tipe data aman dan tidak memakai (this as any)
  private _resolvedCache = new Map<string, any>();

  private _dynamicConfigs = new Map<keyof iBuilderRegistry, Record<string, any>>();

  // 🧊 ANTI-FOUC LEDGER: jejek siap-notnya stylesheet lazy (normalized vite path)
  // serta janji pemuatan yang sedang berjalan agar build() paralel tidak dobel-fetch.
  private _stylesReady = new Set<string>();
  private _stylesLoading = new Map<string, Promise<void>>();

  /**
   * 🚀 POST-LAUNCH FLIPPER (O(1) RELEASE VIA POINTER data-loaded)
   * Dipanggil SETELAH promise style lazy terselesaikan (sukses/gagal).
   * Pelepasan didelegasikan ke instance.releaseHydration(actualElement):
   * satu penulis marker di Base — `--is-loading: 0` + hapus `data-hydrating`
   * + pasang `data-loaded="true"` pada elemen puncak yang memang dipegang
   * registry. Rule CSS `[data-loaded="true"] *` lalu memaksa SELURUH
   * keturunan membaca --is-loading: 0 (pointer permanen untuk anak-anak),
   * tanpa forEach/querySelectorAll/observer — aman page-switching brutal.
   */
  private _launchPostLoadInstance(instance: any, stylePending: Promise<void>, actualElement?: HTMLElement | null): void {
    if (!instance) return;


    // 🛡️ Fail-open: error jaringan/chunk tetap WAJIB melepas pembekuan
    // agar konten tidak mati selamanya di balik shimmer.
    stylePending.catch(() => null).finally(() => {
      try {
        if (typeof instance.releaseHydration === "function") {
          instance.releaseHydration(actualElement);
        } else {
          // 🛟 Instance eksotis tanpa releaseHydration: tulis marker langsung.
          actualElement?.style?.setProperty("--is-loading", "0");
          actualElement?.removeAttribute?.("data-hydrating");
          actualElement?.setAttribute?.("data-loaded", "true");
        }
      } catch (releaseError) {
        console.warn("[ComponentRegistry] Hydration release skipped:", releaseError);
      }
      instance.isLoaded = true;

    });
  }

  public register<K extends keyof iBuilderRegistry>(name: K, builderFn: RegisterFn<K>): this {
    this.builders.set(name, builderFn);
    return this;
  }

  public getRegisteredNames(): string[] {
    return Array.from(this.builders.keys()) as string[];
  }

  public get(name: string) {
    if (this.has(name)) {
      return this.builders.get(name as keyof iBuilderRegistry);
    }
  }

  public has(name: string): boolean {
    return this.builders.has(name as keyof iBuilderRegistry);
  }

  private async loadModule(script?: string, stylesheet?: string, componentName?: string): Promise<any> {
    let jsModule: any = null;
    let rawCss: any = null;

    // 1. Memuat File JavaScript/TypeScript (Berlaku untuk Dev & Prod)
    if (script) {
      const normScript = normalizeVitePath(script);
      // Mencari di dalam modul glob yang sudah dipaksa pecah chunk oleh Vite
      const jsLoader = viteModules[normScript] || viteModules[script];

      if (typeof jsLoader === "function") {
        jsModule = await jsLoader(); // HMR aktif di dev, Code-split aktif di prod build!
      }
    }

    // Ekstrak Class/Constructor Komponen Anda
    const builderClass = jsModule?.default || (jsModule && Object.values(jsModule).find(v => typeof v === 'function' || (v && typeof (v as any).create === 'function'))) || jsModule;
    // console.log({ builderClass, stylesheet })
    // 2. Memuat File CSS (Menggunakan inline query untuk Constructable Stylesheets)
    let effectiveStyle: string | CSSStyleSheet | undefined = stylesheet;
    if (!effectiveStyle && builderClass) {
      effectiveStyle = builderClass?.stylesheet || builderClass.prototype?.stylesheet;
    }
    // 🩹 REGISTRY-SIDE DERIVATION: pola `abstract readonly stylesheet` (instance class
    // field) tidak terlihat di level class (fields tidak pernah menempel di prototype),
    // sehingga preload tanpa manifest.stylesheet sebelumnya SELALU melewatkan CSS.
    // Turunkan path stylesheet dari script — aturan yang sama dengan derivasi
    // manifest di build() — agar preloadComponents ikut memuat stylesheet.
    if (!effectiveStyle && script) {
      effectiveStyle = script.replace(/\.(ts|tsx|js|jsx)$/, ".css");
    }

    if (effectiveStyle) {
      if (effectiveStyle instanceof CSSStyleSheet) {
        this.injectStyle(effectiveStyle);
      } else if (typeof effectiveStyle === "string") {
        const resolvedCssPath = script ? resolveRelativePath(script, effectiveStyle) : effectiveStyle;
        const normCss = normalizeVitePath(resolvedCssPath);

        // Ambil loader CSS inline (exact → case-insensitive scan via findStyleLoader)
        const cssLoader = findStyleLoader(normCss) || findStyleLoader(resolvedCssPath) || findStyleLoader(effectiveStyle);

        if (typeof cssLoader === "function") {
          rawCss = await cssLoader(); // Mengembalikan string CSS mentah berkat properti ?inline

          // 🛡️ Normalisasi bentuk modul: sebagian mode/transform Vite dapat mengembalikan
          // namespace modul alih-alih langsung string — tarik .default bila ada.
          if (rawCss && typeof rawCss === "object" && "default" in rawCss) {
            rawCss = (rawCss as any).default;
          }

          if (typeof rawCss === "string") {
            this.injectCssString(rawCss, normCss);
            // 🧊 ANTI-FOUC LEDGER: setiap injeksi stylesheet via loadModule (termasuk
            // saat preload) wajib menandai kunci yang SAMA dengan yang dihitung build()
            // (normalizeVitePath). Tanpa ini, build() menganggap style belum siap →
            // re-fetch + dobel-adoption sheet + jeda hold yang sia-sia.
            this._stylesReady.add(normCss);
            if (DEV) console.info(`[ComponentRegistry] 🎨 stylesheet injected: ${normCss} (${rawCss.length} chars)`);
          } else if (DEV) {
            console.warn(`[ComponentRegistry] ⚠️ CSS loader returned non-string for ${normCss} (got: ${typeof rawCss}) — stylesheet skipped`);
          }
        } else if (DEV) {
          console.warn(`[ComponentRegistry] ⚠️ no CSS loader found for "${normCss}" (also tried: "${resolvedCssPath}", "${effectiveStyle}") — check the .css file name/case beside the .ts, or add stylesheet to the manifest`);
        }
      }

    } else if (/* import.meta.env?.DEV && */ componentName && !effectiveStyle) {
      // console.warn(`[ComponentRegistry] Warning: No stylesheet provided or defined for component "${String(componentName)}".`);
    }

    return builderClass;
  }


  /**
   * 🧙‍♂️ THE PRE-LOAD HYDRATOR
   */
  public async preloadComponents(componentNames: string[], pagesData: any[]): Promise<void> {
    const promises = componentNames.map(async (nameKey) => {
      const name = nameKey as keyof iBuilderRegistry;
      const fn = this.builders.get(name);
      if (!fn) return;

      // @ts-ignore (Mempertahankan fungsionalitas pencarian framework bawaan Anda)
      const matchedData = this.getBuilderNode(pagesData as iBasicNode[], name as string);

      const loadFn: LoadFn = async ({ script, stylesheet }) => {
        // Ditambahkan nameKey sebagai parameter ke-3 agar sinkron
        const loadedClass = await this.loadModule(script, stylesheet, name as string);
        if (loadedClass) {
          this._resolvedCache.set(name as string, loadedClass);
        }
        return loadedClass;
      };

      try {
        // Solusi polimorfisme parameter agar Style 3 tidak rusak saat di-preload
        const result = fn(matchedData || {}, loadFn as any);

        if (result && typeof result === "object" && !(result instanceof HTMLElement) && !(result instanceof Promise)) {
          const manifest = result as iSimpleWayManifest;
          const scriptPath = manifest.path || manifest.script;
          if (scriptPath || manifest.stylesheet) {
            const loadedClass = await loadFn({ script: scriptPath, stylesheet: manifest.stylesheet });
            if (loadedClass) {
              this._resolvedCache.set(name as string, loadedClass);
            }
          }
        }
      } catch (_err) {
        // Silently swallow errors
      }
    });
    await Promise.all(promises);
  }

  /**
   * ⚡ AMAN & SINKRONUS MURNI (.run Method)
   */


  public build<K extends keyof iBuilderRegistry>(name: K, data: any): HTMLElement | null {
    const fn = this.builders.get(name);
    if (!fn) return null;

    // 1. Panggil fn() dulu untuk menangkap Manifest (Style 3) + path CSS tersembunyi
    // @ts-ignore
    const dummyLoadFn: LoadFn = ({ script, stylesheet }) => Promise.resolve({});
    const result = fn(data, dummyLoadFn as any);

    // 2. Bongkar Manifest (Style 3): schema & config kustom yang harus dipakai builder
    let manifestSchema: any = undefined;
    let hasManifestSchema = false;
    let manifestConfig: any = undefined;
    let cssPath: string | undefined;
    if (result && typeof result === "object" && !(result instanceof HTMLElement) && !(result instanceof Promise) && !(typeof (result as any).create === "function")) {
      const manifest = result as iSimpleWayManifest;
      // Perlakukan sebagai Manifest hanya bila punya penanda path/script (hindari false-positive)
      if (manifest.path || manifest.script) {
        if (manifest.schema !== undefined) {
          manifestSchema = manifest.schema;
          hasManifestSchema = true;
        }
        if (manifest.config) manifestConfig = manifest.config;

        cssPath = manifest.stylesheet;
        if (!cssPath && manifest.path) {
          cssPath = manifest.path.replace(/\.(ts|tsx|js|jsx)$/, '.css');
        }
      }
    }

    // 3. Content payload: hormati schema Manifest; bila tak ada, ekstrak data.content
    const activeThemeConfig = this._dynamicConfigs.get(name) || {};
    let contentPayload = hasManifestSchema ? manifestSchema : data;
    if (!hasManifestSchema && data && typeof data === "object" && !Array.isArray(data) && data.content !== undefined) {
      contentPayload = data.content;
    }

    // 4. Merge config — PRIORITAS = tema < manifest (default registrasi) < userConfig (instance/node).
    //    Instance (node.config) menang atas default registrasi; tema jadi lapisan terbawah.
    //    `selectors` digabung secara DEEP sehingga override parsial (mis. sidebar hanya mengirim
    //    `{ "@menu": { id } }`) tidak menimpa seluruh selectors default milik builder.
    const userConfig = (data && typeof data === "object" && !Array.isArray(data)) ? (data.config || {}) : {};

    // Lapisan dasar: tema + manifest default
    let baseConfig: any = { ...activeThemeConfig };
    if (manifestConfig) baseConfig = { ...baseConfig, ...manifestConfig };

    // Lapisan final: baseConfig ditimpa userConfig (instance menang)
    let finalMergedConfig: any = { ...baseConfig, ...userConfig };

    // Gabung selectors secara deep dari tema, manifest, dan user (user mendapat prioritas tertinggi)
    const mergedSelectors: Record<string, any> = {};
    for (const src of [activeThemeConfig, manifestConfig, userConfig]) {
      if (src?.selectors && typeof src.selectors === "object") {
        Object.assign(mergedSelectors, src.selectors);
      }
    }
    if (Object.keys(mergedSelectors).length) finalMergedConfig.selectors = mergedSelectors;
    else delete finalMergedConfig.selectors;

    if (data && typeof data === "object" && !Array.isArray(data) && data.config) {
      data.config = finalMergedConfig;
    }

    // 5. 🧊 GAYA MUNDUR CERDAS (MANIFEST CSS): muat stylesheet Manifest sambil
    //    MENAHAN pembangunan visual sampai style benar-benar terinjeksi.
    //    Versi lama membiarkan loadModule jalan tanpa awaits (= penyebab FOUC:
    //    DOM terlanjur tampil telanjang menunggu CSS datang belakangan).
    let stylePending: Promise<void> = Promise.resolve();
    if (cssPath) {
      // Kunci normalisasi HARUS identik dengan resolusi internal loadModule
      // (dipanggil tanpa script di jalur ini → langsung normalizeVitePath).
      const styleKey = normalizeVitePath(cssPath);
      const inflight = this._stylesLoading.get(styleKey);

      if (!inflight) {
        // Belum pernah dimuat sama sekali → mulai sesi load baru.
        const session = this.loadModule(undefined, cssPath, name as string)
          .then(() => { this._stylesReady.add(styleKey); })
          .catch(() => null)
          .then(() => { this._stylesLoading.delete(styleKey); }) as Promise<void>;
        this._stylesLoading.set(styleKey, session);
        stylePending = session;
      } else if (!this._stylesReady.has(styleKey)) {
        // Ada pemuatan lintas-build yang masih menggantung → ikuti janji yang sama.
        stylePending = inflight;
      }
      // Skenario ketiga (_stylesReady sudah memuat styleKey): style dijamin
      // terinjeksi — jalur sinkron tanpa penahanan apapun (bebas jeda ulang).
    }

    // 6. Kembalikan ke logika eksekusi cache standar
    const cachedClass = this._resolvedCache.get(name as string);
    if (cachedClass && typeof cachedClass === "function") {
      try {
        const instance = new cachedClass(finalMergedConfig);
        if (instance && typeof instance.create === "function") {
          // 🧊 TOGGLE FASE: tandakan instance belum "loaded" SEBELUM create();
          // create() menempel marker hold pada SATU elemen puncaknya saja.
          instance.isLoaded = false;
          const builtElement = instance.create(contentPayload, finalMergedConfig);
          // ✅ STYLE MATANG → releaseHydration(): --is-loading 0 + hapus
          // data-hydrating + data-loaded="true" (pointer pelepasan subtree).
          this._launchPostLoadInstance(instance, stylePending, builtElement);
          return builtElement;
        }
      } catch { /* fall through */ }
    }

    if (result && typeof result === "object" && !(result instanceof Promise)) {
      if (result instanceof HTMLElement) return result;
      if (typeof (result as any).create === "function") {
        const instance = result as any;
        if (!instance.config) instance.config = finalMergedConfig;
        // 🧊 Fase jalur instansi dari manifest: protokol tahan-rilis yang sama.
        instance.isLoaded = false;
        const builtInstanceElement = instance.create(contentPayload, finalMergedConfig);
        this._launchPostLoadInstance(instance, stylePending, builtInstanceElement);
        return builtInstanceElement;
      }
    }

    // JALUR EMERGENSI: Jika kelas sudah ter-load dari preloadComponents sebelumnya
    const PreloadedBuilderClass = this._resolvedCache.get(name as string);
    if (PreloadedBuilderClass) {
      if (typeof PreloadedBuilderClass.create === "function") {
        const actualElement = PreloadedBuilderClass.create(contentPayload, finalMergedConfig);
        if (PreloadedBuilderClass.isLoaded) {
          actualElement?.style?.removeProperty("--is-loading");
          actualElement?.removeAttribute?.("data-hydrating");
          actualElement?.removeAttribute?.("data-loaded");
        }
        return actualElement;
      }
    }

    return null;
  }

  private injectStyle(sheet: CSSStyleSheet): void {
    if (!this.registeredSheets.has(sheet)) {
      this.registeredSheets.add(sheet);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }
  }

  /**
   * 🎯 Penanam CSS mentah sebagai elemen <style id="…"> NYATA di <head>.
   *
   * Mengapa tidak lagi mengandalkan Constructable Stylesheet
   * (document.adoptedStyleSheets)? Stylesheet yang di-`adopt` TIDAK muncul
   * sebagai node DOM — Anda buka DevTools > Elements, cari <style>/<link>,
   * tidak ada → tampak "stylesheet tidak loaded" padahal sesungguhnya CSS
   * sudah ter-pakai. Itu persis yang Anda alami sekarang: log bilang
   * "injected" (replaceSync sukses, pola adoptStyleSheets), tapi di pohon
   * DOM tidak ada <style> karena adoptedStyleSheets memang tak membentuk
   * node. Elemen <style> nyata membuat inject gampang diverifikasi.
   *
   * Selain itu ini juga lebih andal daripada jalur CSSOM: beberapa browser
   * melempar SyntaxError dari replaceSync pada CSS modern mentah (nesting,
   * @starting-style, ::picker, position-area, dst) — yang dulu membuat
   * stylesheet diam-diam TIDAK pernah masuk DOM sama sekali.
   *
   * CSS di-set sebagai styleText dari elemen <style>, ditulis secara
   * sinkron tepat sebelum build() me-render → jaminan anti-FOUC (ledger
   * _stylesReady) tetap utuh.
   */
  private injectCssString(rawCss: string, normCss: string): void {
    if (!rawCss) return;

    const styleId = `rajutan-lazy-css__${normCss.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    // 🧯 Dedup ganda: memori + query DOM, biar preload/build paralel yang
    // menyentuh file yang sama tidak menggandakan <style>.
    if (this._injectedStyleTags.has(styleId)) return;
    if (document.getElementById(styleId)) {
      this._injectedStyleTags.add(styleId);
      return;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.setAttribute("data-lazy-component", "true");
    style.textContent = rawCss;
    document.head.appendChild(style);
    this._injectedStyleTags.add(styleId);

    if (DEV) {
      console.log(`[ComponentRegistry] 📦 <style id="${styleId}"> injected in <head> (${rawCss.length} chars)`);
    }
  }

  public setConfig(builderName: keyof iBuilderRegistry, newConfig: Record<string, any>): void {
    console.log(`[Registry Config Central] Storing live configuration inject request for: "${String(builderName)}"`);

    // Lakukan deep-merge terisolasi di dalam Map agar selectors kustom tema tidak hilang saling menimpa
    const existingConfig = this._dynamicConfigs.get(builderName) || {};
    this._dynamicConfigs.set(builderName, {
      ...existingConfig,
      ...newConfig,
      selectors: {
        ...(existingConfig.selectors || {}),
        ...(newConfig.selectors || {})
      }
    });

    console.log(`[Registry Success] Configuration for "${String(builderName)}" officially sealed in dynamic config state.`);
  }

  public clear(): void {

    this._dynamicConfigs.clear();
    this.registeredSheets = new Set<CSSStyleSheet>();


    if (typeof Builder !== "undefined" && typeof Builder.resetCounters === "function") {
      Builder.resetCounters();
    }

    // console.log(`🧹 [ComponentRegistry]: Cleaned node registries and instance identity counters.`);
  }

  public destroy() {

  }

  public getBuilderNode(nodes: iBasicNode[] | iBasicNode, name: string, visited = new Set()): iBasicNode | undefined {
    // 1. Validasi tipe data: abaikan jika bukan object atau null
    if (typeof nodes !== 'object' || nodes === null) {
      return undefined;
    }

    // 2. Cegah Circular Reference
    if (visited.has(nodes)) {
      return undefined;
    }

    // Tandai object ini sebagai 'sudah dikunjungi'
    visited.add(nodes);

    // 3. Langsung kembalikan jika nodes itu sendiri adalah builder yang dicari
    if ('builder' in nodes && (nodes as any).builder === name) {
      return nodes;
    }

    // 4. Proses jika nodes berbentuk Array
    if (Array.isArray(nodes)) {
      for (const item of nodes) {
        const found = this.getBuilderNode(item, name, visited);
        if (found) return found; // Jika ketemu, langsung return
      }
    }
    // 5. Proses jika nodes berbentuk Object (nested)
    else {
      for (const key in nodes) {
        if (Object.prototype.hasOwnProperty.call(nodes, key)) {
          const found = this.getBuilderNode((nodes as any)[key], name, visited);
          if (found) return found; // Jika ketemu, langsung return
        }
      }
    }

    return undefined;
  }

}



