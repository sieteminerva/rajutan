export interface iRouteState {
  route: string;
  theme: string | null;
  fragment: string;
  /** Opt-in editor/preview mode, set via ?editor=true in the hash query. */
  editor: boolean;
}

export class HashRouter {
  private defaultRoute: string;
  private currentThemeId: string;
  public onRouteChanged: (state: iRouteState) => void | Promise<void>;
  private validRoutes: string[] = [];
  /** Sticky editor flag — latches true once any parsed hash carries ?editor=true. */
  private editorMode = false;
  /**
   * Routes that must never render inside the preview iframe. `editor` owns
   * an iframe that boots the app again — allowing it in preview recurses
   * (editor inside editor inside editor…).
   */
  private previewBlockedRoutes = new Set(["editor"]);

  constructor(
    defaultRoute: string,
    initialTheme: string,
    validRoutes: string[],
    onRouteChanged: (state: iRouteState) => void | Promise<void>
  ) {
    this.defaultRoute = this._normalizeRoute(defaultRoute);
    this.currentThemeId = this._normalizeTheme(initialTheme) || "default";
    this.onRouteChanged = onRouteChanged;
    this.validRoutes = validRoutes.map(r => r.trim().toLowerCase());
    // Ikat event listener native browser secara aman
    window.addEventListener("hashchange", this._handleHashChange);
  }

  /**
   * Embedded/editor mode. Opt-in via ?editor=true in the frame's hash
   * (the preview canvas the editor launches), OR structurally when the
   * document is iframed (belt-and-suspenders for unofficial embeds).
   * Editor-mode documents must not leak into the parent page: no
   * localStorage writes and no pushState history pollution.
   */
  private _isEmbedded(): boolean {
    if (this.editorMode) return true;
    try {
      return window.self !== window.top;
    } catch {
      return true; // Cross-origin access to window.top threw → embedded.
    }
  }

  public redirect(targetRoute: string, themeId?: string | null, fragmentId: string = ""): iRouteState {
    const activeTheme = this._normalizeTheme(themeId || this.currentThemeId);
    const cleanRoute = this._normalizeRoute(targetRoute);

    const redirectState: iRouteState = {
      route: cleanRoute,
      theme: activeTheme,
      fragment: fragmentId.trim().replace(/^#/, ""),
      editor: this.editorMode
    };

    // Update state internal dan storage (top-level only — embedded frames
    // share the parent's localStorage and must not write into it).
    this.currentThemeId = activeTheme;
    if (!this._isEmbedded()) localStorage.setItem("active_theme", activeTheme);

    // 🔒 REAKTIF SINKRONISASI: Tulis ulang URL address bar secara diam-diam (replaceState)
    // Ini mengunci agar browser tidak merekam halaman cacat ke dalam tumpukan tombol Back!
    const targetHash = this._buildHash(redirectState);
    window.history.replaceState(null, "", targetHash);

    return redirectState;
  }

  public navigate(routeId: string, themeId?: string | null, fragmentId?: string, _isValidRoute: boolean = false): void {
    // console.log(routeId, fragmentId, themeId)
    const activeTheme = this._normalizeTheme(themeId || this.currentThemeId);

    // 🧙‍♂️ THE DYNAMIC ROUTE SENSOR INTEGRATION
    // Evaluasi string input sejak gerbang navigasi terdepan!
    let targetRoute = this._normalizeRoute(routeId);
    let targetFragment = fragmentId?.trim().replace(/^#/, "") || "";
    // 🚫 Preview guard: never let the iframe navigate to a blocked route
    // (e.g. `editor` would nest an editor inside the preview). Bounce to
    // the default route, preserving the sticky ?editor=true flag.
    if (this.previewBlockedRoutes.has(targetRoute.toLowerCase()) && this._isEmbedded()) {
      console.warn(`[Router] Route "${targetRoute}" is blocked in preview — redirecting to "${this.defaultRoute}".`);
      return this.navigate(this.defaultRoute, activeTheme, "");
    }
    console.log(this.validRoutes)
    // Jika yang mau dituju ternyata bukan rute halaman resmi, melainkan nama seksi polos (#faq-section)
    if (!this.validRoutes.includes(targetRoute.toLowerCase()) && !_isValidRoute) {
      console.warn(`[Router] Redirecting dynamic section anchor click to default page path.`);
      // Alihkan kemudi murni lewat gerbang redirect terpusat baru Anda!
      const correctedState = this.redirect(this.defaultRoute, activeTheme, targetRoute);
      this.onRouteChanged(correctedState);
      return;
    }

    const normalizedState: iRouteState = {
      route: targetRoute,
      theme: activeTheme,
      fragment: targetFragment,
      editor: this.editorMode
    };


    // Gunakan pushState murni, browser blocked to trigger event hashchange!
    // Embedded frames use replaceState instead: pushState would append to the
    // JOINT session history and pollute the parent editor page's Back button.
    window.history.replaceState(null, "", this._buildHash(normalizedState));

    this.currentThemeId = activeTheme;
    if (!this._isEmbedded()) localStorage.setItem("active_theme", activeTheme);

    // Jalankan callback satu pintu menuju LandingPageBuilder secara sinkron kilat secepat cahaya!
    this.onRouteChanged(normalizedState);
  }


  public parseUrlHash(): iRouteState {
    const rawHash = window.location.hash.trim().replace(/^#/, "");
    // Embedded frames read nothing from storage (shared with the parent);
    // the theme arrives via the ?theme= query or the bridge instead.
    const persistedTheme = this._isEmbedded() ? "" : this._normalizeTheme(localStorage.getItem("active_theme"));

    if (!rawHash) {
      console.log("[Router] Empty URL hash. Executing central auto-redirect to home launcher...");
      return this.redirect(this.defaultRoute, persistedTheme);
    }

    // Separate main path and query string
    const [rawPathPart, queryString = ""] = rawHash.split("?");
    const pathPart = rawPathPart.trim().replace(/^\/+/, "");
    const query = new URLSearchParams(queryString);
    const queryTheme = query.get("theme");

    // Opt-in editor mode: ?editor=true in the hash query. Sticky for this
    // router instance so it survives fragment-only hash changes.
    const queryEditor = query.get("editor");
    if (queryEditor === "true" || queryEditor === "1") this.editorMode = true;

    let extractedTheme: string | null = queryTheme ? this._normalizeTheme(queryTheme) : null;
    let targetRoute = "";
    let targetFragment = "";

    const segments = pathPart.split("/").map(part => part.trim()).filter(Boolean);
    if (segments.length > 1) {
      const firstPart = segments[0];
      const remainder = segments.slice(1).join("/");

      if (queryTheme) {
        // Modern encoded format: #route/fragment?theme=...
        targetRoute = firstPart;
        targetFragment = remainder;
      } else {
        // Legacy format without explicit theme query: #theme/route or #route/fragment
        if (this.validRoutes.includes(firstPart.toLowerCase())) {
          targetRoute = firstPart;
          targetFragment = remainder;
        } else if (this.validRoutes.includes(remainder.toLowerCase())) {
          extractedTheme = this._normalizeTheme(firstPart);
          targetRoute = remainder;
        } else {
          targetRoute = firstPart;
          targetFragment = remainder;
        }
      }
    } else {
      targetRoute = segments[0] || pathPart.trim();
    }

    let finalRoute = this._normalizeRoute(targetRoute);
    let finalFragment = this._safeDecode(targetFragment);

    // 🚫 Preview guard (direct load / back-button path): the iframe must
    // never render a blocked route even if the URL was typed by hand —
    // bounce to default before any state is committed.
    if (this.previewBlockedRoutes.has(finalRoute.toLowerCase()) && this._isEmbedded()) {
      console.warn(`[Router] Route "${finalRoute}" is blocked in preview — redirecting to "${this.defaultRoute}".`);
      return this.redirect(this.defaultRoute, extractedTheme || persistedTheme, "");
    }

    // Jika hasil parsing membaca nama routePart yang TERBUKTI TIDAK ADA di dalam database rute halaman...
    if (!this.validRoutes.includes(finalRoute.toLowerCase())) {
      console.log(`[Router Live] Route "${finalRoute}" is unrecognized. Delegating central redirect.`);
      // Panggil metode redirect terpusat Anda! Rute dipaksa "home", fragment diisi "faq-section"
      return this.redirect(this.defaultRoute, extractedTheme || persistedTheme, finalRoute);
    }

    const resolvedState: iRouteState = {
      route: finalRoute,
      theme: extractedTheme || persistedTheme || this.currentThemeId || "default",
      fragment: finalFragment,
      editor: this.editorMode
    };

    this.currentThemeId = resolvedState.theme || this.currentThemeId;
    if (resolvedState.theme && !this._isEmbedded()) localStorage.setItem("active_theme", resolvedState.theme);

    this._syncAddressBar(resolvedState, true);

    return resolvedState;
  }

  /**
   * Mengupdate daftar rute yang valid secara dinamis (misalnya ketika mendaftarkan controller baru)
   */
  public updateValidRoutes(validRoutes: string[]): void {
    this.validRoutes = validRoutes.map(r => r.trim().toLowerCase());
  }

  public updateValidRoute(route: string): void {
    console.log(this.validRoutes)
    this.validRoutes.push(route);
  }

  /**
 * Pembersih memory leak saat instance dihancurkan
 */
  public destroy(): void {
    window.removeEventListener("hashchange", this._handleHashChange);
  }



  /**
   * HELPER
   */


  private _normalizeRoute(route: string): string {
    const resolved = route.trim().replace(/^#/, "").replace(/^\/+/, "");
    return resolved || "home";
  }

  private _normalizeTheme(theme: string | null | undefined): string {
    // Tema tidak boleh mengandung "/" — nilai "default/panduan…/slug" adalah
    // hasil polusi dari slug yang pernah menempel di query theme. Potong di
    // "/" pertama agar localStorage lama yang terpolusi ikut ter-süheal.
    return (theme || "").trim().replace(/^#/, "").split("/")[0];
  }

  private _buildHash(state: iRouteState): string {
    const route = this._normalizeRoute(state.route);
    const theme = this._normalizeTheme(state.theme || this.currentThemeId) || "default";
    const fragment = state.fragment?.trim().replace(/^#/, "");
    const editor = (state.editor || this.editorMode) ? "&editor=true" : "";
    const query = `?theme=${encodeURIComponent(theme)}${editor}`;
    const fragmentHash = fragment ? `/${fragment}` : "";
    return `#${route}${fragmentHash}${query}`;
  }

  private _safeDecode(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private _syncAddressBar(state: iRouteState, replace = false): void {
    const normalizedHash = this._buildHash(state);
    if (window.location.hash === normalizedHash) return;
    if (replace) {
      window.history.replaceState(null, "", normalizedHash);
    } else {
      window.history.pushState(null, "", normalizedHash);
    }
  }



  private _handleHashChange = (): void => {
    const state = this.parseUrlHash();
    if (state.theme) this.currentThemeId = state.theme;
    this.onRouteChanged(state);
  };
}
