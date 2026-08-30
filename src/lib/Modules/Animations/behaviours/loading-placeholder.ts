/**
 * MODUL: LOADING PLACEHOLDER (ANTI-FOUC LAZY-RELEASE)
 *
 * Modul pendamping sistem `isLoaded` di Builder + gated loading pada
 * ComponentRegistry. Ketika komponen lazy-load masih menunggu stylesheet /
 * hydrator-nya selesai, Builder telah membekukan elemen dengan:
 *   - class `anim-placeholder-active` (skin shimmer, lihat Animations.css),
 *   - backup opasitas asli di atribut `data-anim-hold-opacity`,
 *   - token `animation="loading-placeholder"` sebagai penanda deteksi.
 *
 * Tugas modul ini saat dipicu (stylesheet sudah masuk):
 * 1. Menunggu `duration` (ms) — memberi ruang font/reflow akhir menstabil.
 * 2. Melepas kelas shimmer secara MULUS: fase transisi ditanam dulu
 *    (CSS `[data-anim-hold-opacity]` memegang transition sehingga rentetan
 *    perubahan warna/border teranimasi), baru class dibuang dua-frame kemudian.
 * 3. Memulihkan opasitas asli dari backup, lalu membersihkan jejak atribut.
 * 4. Menyalakan `onDone` → AnimationsService menembakkan event
 *    `animation:done` (chained animation kembali mengalir normal).
 */
export interface LoadingPlaceholderOptions {
  /** Jeda tunggu (ms) sebelum pelepasan dimulai — default mengikuti globalDelay. */
  duration: number;
  /**
   * Jeda tambahan (ms) antara pelepasan transisi vs pelepasan kelas shimmer.
   * Default 420ms (sedikit di atas durasi transisi CSS 0.35s).
   */
  instantRevealDelayTime?: number;
  /**
   * Opasitas cadangan bila atribut backup kosong/tidak ada (mis. dipakai ulang
   * pada node yang backup-nya sudah dibersihkan proses lain). Default: "1".
   */
  restoreFallbackOpacity?: string;
}

export class LoadingPlaceholderBehaviour {
  public static async animate(
    node: HTMLElement,
    options: LoadingPlaceholderOptions,
    onDone: () => void
  ): Promise<void> {
    // ⏳ Resolusi urutan prioritas delay:
    // data-delay milik node > konfigurasi modul > fallback 500ms.
    const attrDuration = node.getAttribute("data-duration");
    const parsedAttrDelay = attrDuration !== null ? parseInt(attrDuration, 10) : NaN;
    const duration = Number.isFinite(parsedAttrDelay)
      ? parsedAttrDelay
      : (Number(options.duration) || 500);

    const settledDelay = Number.isFinite(duration) ? Math.max(0, duration) : 0;

    window.setTimeout(() => {
      // Elemen boleh saja sudah dicabut layar saat menunggu — hindari operasi mayat.
      if (!node.isConnected) {
        onDone();
        return;
      }

      // 🌅 FASE 1 — TARUHAN TRANSISI (menghidupkan kurva CSS).
      // Aturan `[data-anim-hold-opacity]` di Animations.css memiliki blok
      // transition yang aktif SELAMA atribut cadangan masih menempel, jadi
      // pelepasan warna/border/opasitas berikutnya bergerak halus, bukan nyablak.
      const releaseDuration = Math.max(
        200,
        parseInt(String(options.instantRevealDelayTime ?? 200), 10) || 200
      );

      // console.log({ releaseDuration })

      const restoreOriginalOpacity = (): void => {
        const backupValue = node.getAttribute("data-anim-hold-opacity");

        if (backupValue === null) return; // Tidak ada cadangan → hormati kondisi inline eksisting.

        if (backupValue.trim() === "") {
          // Cadangan kosong = semula tanpa inline opacity.
          if (options.restoreFallbackOpacity !== undefined && String(options.restoreFallbackOpacity).trim() !== "") {
            node.style.opacity = String(options.restoreFallbackOpacity);
          } else {
            node.style.removeProperty("opacity");
          }
        } else {
          node.style.opacity = backupValue;
        }
      };

      // 🌘 FASE 2 — BUKA GEMBOK UTAMA: lepas kulit shimmer (warna & border
      // transparan ikut hilang bersamanya). Transisi CSS yang barusan
      // dipasang menjamin pergantian visual teranimasi alami.
      node.classList.remove("anim-placeholder-active");
      restoreOriginalOpacity();

      // 🧹 FASE 3 — PEMBERSIHAN JEJAK DI KEAMANAN DIGITAL FRAMEWORK:
      // hapus cadangan & token animation agar pemindaian init() berikutnya
      // tidak menjalankan ulang perilaku ini (idempotent).
      node.removeAttribute("data-anim-hold-opacity");
      if (node.getAttribute("animation") === "loading-placeholder") {
        node.removeAttribute("animation");
      }

      // Lanjutkan sisa transisi layar dalam waktu singkat tanpa residu inline.
      window.setTimeout(() => {
        node.style.removeProperty("transition");
      }, releaseDuration);

      // ⛓️ RANTAI LANJUTAN: beri tahu AnimationsService bahwa elemen ini tuntas
      // sehingga sibling ber-atribut animation-chain="true" boleh tampil.
      onDone();
    }, settledDelay);
  }
}