// src/lib/Modules/AuthService.ts
/**
 * 🔐 AuthService — Gerbang Autentikasi Google (GIS) untuk aplikasi tanpa server.
 *
 * Konsep: lihat ./AuthServiceConcept.md
 *
 * Alur pemakaian:
 *   1. `AuthService.isAuthenticated()` → cek apakah ada id_token valid & belum kedaluwarsa.
 *   2. `AuthService.redirectToLogin()` → kalau belum login, buka halaman login Google
 *                                        (GIS one-tap / popup) lalu KEMBALIKAN id_token.
 *   3. `AuthService.getToken()`        → ambil id_token yang tersimpan, siap dikirim ke
 *                                        Apps Script Orkestrator untuk diverifikasi (tokeninfo).
 *
 * Token disimpan di memori + sessionStorage dengan masa berlaku (Strategi 1) dan
 * dimusnahkan tegas saat logout / kedaluwarsa (Strategi 2).
 */

/**
 * Client ID dari Google Cloud Console (OAuth 2.0 → Identitas Klien Web).
 * Isi lewat file `.env`:
 *   VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
 * Atau ganti placeholder di bawah ini dengan CLIENT_ID asli milikmu.
 */
const GOOGLE_CLIENT_ID: string =
  (import.meta.env as Record<string, string | undefined>).VITE_GOOGLE_CLIENT_ID ??
  "MASUKKAN_CLIENT_ID_GOOGLE.apps.googleusercontent.com";

const GIS_SCRIPT_ID = "google-gis-script";
const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

const TOKEN_STORAGE_KEY = "rajutan.auth.id_token";
const TOKEN_EXPIRY_KEY = "rajutan.auth.expires_at";

/* ------------------------------------------------------------------ */
/*  Tipe global minimal untuk Google Identity Services                */
/* ------------------------------------------------------------------ */

export interface GoogleCredentialResponse {
  /** JWT id_token yang dikirim Google setelah login berhasil. */
  credential: string;
  select_by?: string;
}

interface GoogleAuthPromptNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  isDisplayMoment: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
  getDismissedReason?: () => string;
}

interface GoogleIdentityService {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    use_fedcm_for_prompt?: boolean;
    cancel_on_tap_outside?: boolean;
    itp_support?: boolean;
  }) => void;
  prompt: (callback: (notification: GoogleAuthPromptNotification) => void) => void;
  disableAutoSelect: () => void;
  renderButton: (parent: HTMLElement, options?: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentityService;
      };
    };
  }
}
/* ------------------------------------------------------------------ */
/*  Penyimpanan token (memori + sessionStorage, berbasis kedaluwarsa)  */
/* ------------------------------------------------------------------ */

let cachedToken: string | null = restoreToken();
let tokenExpiresAt = readStoredExpiry(); // epoch ms

/** Baca id_token dari sessionStorage bila masih tersimpan. */
function restoreToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Baca masa berlaku (ms) dari sessionStorage; 0 bila tidak ada. */
function readStoredExpiry(): number {
  try {
    const raw = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** Dekode payload JWT secara native tanpa library (bagian tengah base64url). */
function decodeJwtPayload(token: string): { exp?: number; email?: string; [key: string]: unknown } {
  try {
    const base64 = token.split(".")[1] ?? "";
    // Ganti base64url → base64 standar
    const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = decodeURIComponent(
      atob(normalized)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(decoded) as { exp?: number; email?: string; [key: string]: unknown };
  } catch {
    return {};
  }
}

/** Simpan token + perpanjang masa berlakunya; utama di Service Worker, cadangan di sessionStorage. */
function persistToken(token: string): void {
  const payload = decodeJwtPayload(token);
  // `exp` dari Google dalam DETIK sejak epoch; konversi ke ms.
  const expMs =
    typeof payload.exp === "number" && payload.exp > 0 ? payload.exp * 1000 : Date.now() + 15 * 60 * 1000;

  cachedToken = token;
  tokenExpiresAt = expMs;

  // 1) Simpan ke Service Worker sebagai sumber utama.
  postToServiceWorker({ type: "SET_TOKEN", token, expiresAt: expMs });

  // 2) Cadangan sessionStorage (bila SW belum mengendalikan halaman).
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(expMs));
  } catch {
    /* storage penuh / privat — token tetap hidup selama sesi berjalan. */
  }
}

/** Hapus token sepenuhnya: SW + memori + storage (Strategi 2). */
function destroyToken(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
  postToServiceWorker({ type: "CLEAR_TOKEN" });
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {
    /* abaikan */
  }
}

/* ------------------------------------------------------------------ */
/*  Komunikasi dengan Service Worker                                   */
/* ------------------------------------------------------------------ */

function hasServiceWorker(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/** Kirim pesan satu arah ke SW (tanpa menunggu balasan). */
function postToServiceWorker(
  message: { type: "SET_TOKEN"; token: string; expiresAt: number } | { type: "CLEAR_TOKEN" },
): void {
  if (!hasServiceWorker()) return;
  try {
    const controller = navigator.serviceWorker.controller;
    if (controller) controller.postMessage(message);
  } catch {
    /* abaikan */
  }
}

type GetTokenReply = { type: "GET_TOKEN"; token: string | null; expiresAt: number };

/** Minta balasan dari SW (GET_TOKEN) lewat MessageChannel; `null` bila SW tak ada / timeout. */
function requestTokenFromSw(timeoutMs = 1500): Promise<GetTokenReply | null> {
  return new Promise((resolve) => {
    if (!hasServiceWorker()) {
      resolve(null);
      return;
    }
    const controller = navigator.serviceWorker.controller;
    if (!controller) {
      resolve(null);
      return;
    }

    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.onmessage = null;
      resolve(null);
    }, timeoutMs);

    channel.port1.onmessage = (event: MessageEvent<GetTokenReply>) => {
      clearTimeout(timer);
      channel.port1.onmessage = null;
      resolve(event.data);
    };

    controller.postMessage({ type: "GET_TOKEN" }, [channel.port2]);
  });
}

/* ------------------------------------------------------------------ */
/*  Resolver pending untuk alur "login lalu ambil token"               */
/* ------------------------------------------------------------------ */

type TokenResolver = (token: string | null) => void;

let pendingResolve: TokenResolver | null = null;
let promptTimeout: ReturnType<typeof setTimeout> | null = null;

/* ------------------------------------------------------------------ */
/*  AuthService                                                        */
/* ------------------------------------------------------------------ */

export class AuthService {
  /** Pastikan skrip resmi GIS termuat di halaman (idempoten). */
  private static loadGisScript(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined") {
        resolve();
        return;
      }
      if (document.getElementById(GIS_SCRIPT_ID) || window.google?.accounts?.id) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.id = GIS_SCRIPT_ID;
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }

  /** Callback Google setelah pengguna sukses login — simpan token & teruskan resolver. */
  private static handleCredentialResponse(response: GoogleCredentialResponse): void {
    if (!response?.credential) return;

    persistToken(response.credential);

    const resolve = pendingResolve;
    pendingResolve = null;
    if (promptTimeout) {
      clearTimeout(promptTimeout);
      promptTimeout = null;
    }
    resolve?.(response.credential);
  }

  /**
   * Cek apakah pengguna sudah terautentikasi (ada id_token valid & belum kedaluwarsa).
   * Sumber utama: variabel Service Worker. Cadangan: sessionStorage/memori.
   */
  static async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token && token.length > 0;
  }

  /**
   * Ambil id_token (untuk dikirim ke Apps Script Orkestrator), atau `null`.
   * Prioritas 1: token yang dipegang Service Worker (GET_TOKEN).
   * Prioritas 2: cache lokal, bila SW tak mengendalikan halaman.
   */
  static async getToken(): Promise<string | null> {
    // 1) Tanya Service Worker sebagai sumber utama.
    const reply = await requestTokenFromSw();
    if (reply?.type === "GET_TOKEN") {
      // SW meng-invalidate token kedaluwarsa dan kembalikan token aktif.
      if (reply.token) {
        cachedToken = reply.token;
        tokenExpiresAt = reply.expiresAt;
        return reply.token;
      }
      // SW jelas punya (atau tidak punya) token → jadikan jawabannya otoritatif.
      cachedToken = null;
      tokenExpiresAt = 0;
      return null;
    }

    // 2) SW tidak tersedia / tidak menjawab → pakai cache lokal (sessionStorage/memori).
    if (Date.now() >= tokenExpiresAt && tokenExpiresAt > 0) {
      destroyToken();
      return null;
    }
    return cachedToken && cachedToken.length > 0 ? cachedToken : null;
  }

  /** Info pengguna yang terbaca dari token (mis. email) — tanpa library. */
  static async getCurrentUser(): Promise<{ email?: string; [key: string]: unknown } | null> {
    const token = await this.getToken();
    if (!token) return null;
    return decodeJwtPayload(token);
  }

  /**
   * "Redirect ke halaman login Google lalu ambil token."
   * Menampilkan akun Google (GIS one-tap/popup); saat berhasil login, resolve
   * dengan id_token. Bila pengguna membatalkan / skrip gagal, resolve `null`.
   */
  static async redirectToLogin(timeoutMs = 60_000): Promise<string | null> {
    // Sudah login? langsung jadikan tokennya tanpa buka dialog lagi.
    if (await this.isAuthenticated()) {
      return cachedToken;
    }

    await this.loadGisScript();

    const google = window.google?.accounts?.id;
    if (!google) {
      console.warn("[AuthService] Google Identity Services tidak tersedia.");
      return null;
    }

    return new Promise<string | null>((resolve) => {
      pendingResolve = resolve;

      google.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => this.handleCredentialResponse(response),
        auto_select: false,
        use_fedcm_for_prompt: true,
        cancel_on_tap_outside: true,
      });

      google.prompt((notification) => {
        // Dialog tertutup / dilewati / tak dimunculkan → anggap batal login.
        if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
          const resolveNow = pendingResolve;
          pendingResolve = null;
          if (promptTimeout) {
            clearTimeout(promptTimeout);
            promptTimeout = null;
          }
          resolveNow?.(null);
        }
        // `isDisplayMoment()` == true → dialog tampil & menunggu interaksi user,
        // biarkan resolve menunggu callback credential.
      });

      // Jaring pengaman: jika user membiarkan dialog menggantung terlalu lama.
      promptTimeout = setTimeout(() => {
        if (!pendingResolve) return;
        const resolveNow = pendingResolve;
        pendingResolve = null;
        resolveNow?.(null);
      }, timeoutMs);
    });
  }

  /** Keluar: hanguskan token lokal + beri tahu Service Worker (Strategi 2). */
  static logout(): void {
    destroyToken();

    // Lingkungan browser + SW aktif
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_TOKEN" });
    }

    // Nonaktifkan auto-select Google Identity supaya akun lama tidak terpilih diam-diam.
    try {
      window.google?.accounts?.id.disableAutoSelect();
    } catch {
      /* abaikan */
    }
  }
}