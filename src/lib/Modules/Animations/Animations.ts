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


export class AnimationsService {
  private globalDelay!: number;

  config: Partial<AnimationServiceConfig>;

  private activeAnimations: Map<HTMLElement, { shouldStop: boolean }> = new Map();
  private observer: MutationObserver | null = null;

  /**
   * 🔗 REGISTRY LISTENER RANTAI — melacak setiap listener 'animation:done'
   * yang menunggu giliran di _setupChainedAnimation(). Dipakai agar:
   * - init() ulang tidak pernah menumpuk listener ganda untuk node yang sama,
   * - node yang dicabut dari DOM (page-switching) mengangkat listener-nya,
   * - destroy() melepas SEMUA listener yang masih menggantung.
   */
  private chainedListeners: Map<HTMLElement, { parent: HTMLElement; handler: (e: Event) => void }> = new Map();

  constructor(config: AnimationServiceConfig = {}) {
    this.globalDelay = config.delay ?? 500;
    this.config = {
      // Global config fallback
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
        speed: config.scramble?.speed ?? 40, // durasi acak per karakter (ms)
      },
      loadingPlaceholder: {
        duration: config.loadingPlaceholder?.duration ?? this.globalDelay,
      },
      ...config
    };

    this._initCleanupTracker();
  }

  private _initCleanupTracker(): void {
    this.observer = new MutationObserver((mutations) => {
      // 🚀 EARLY-EXIT: saat registry kosong (kondisi normal di luar animasi
      // berjalan), callback ini langsung pulang. Tanpa ini, SETIAP mutasi DOM
      // di seluruh aplikasi (page-switching brutal!) membayar iterasi Map.
      if (this.activeAnimations.size === 0) return;

      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Cek apakah elemen yang dihapus (atau anak-anaknya) ada di daftar animasi aktif
            this.activeAnimations.forEach((state, el) => {
              if (el === node || node.contains(el)) {
                state.shouldStop = true; // Kirim sinyal matikan animasi
                this.activeAnimations.delete(el); // Hapus dari tracker memori
              }
            });

            // Lepas juga listener rantai yang masih menunggu pada node yang dicabut
            // (mencegah kebocoran listener saat page-switching brutal).
            this.chainedListeners.forEach((info, el) => {
              if (el === node || node.contains(el)) {
                info.parent.removeEventListener('animation:done', info.handler);
                this.chainedListeners.delete(el);
              }
            });
          }
        });
      });
    });

    // Mulai pantau seluruh dokumen HTML
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  public init(): void {
    // 1. Ambil semua elemen animasi
    const animatedElements = document.querySelectorAll<HTMLElement>('[animation]');

    animatedElements.forEach((node) => {
      // 2. Jika elemen memiliki [animation-chain="true"], sembunyikan dulu di awal
      // dan buat ia menunggu instruksi dari elemen sebelumnya
      if (node.getAttribute('animation-chain') === 'true') {
        this._setupChainedAnimation(node);
        return; // Jangan jalankan animasinya dulu!
      }

      // Jika bukan elemen rantai, langsung jalankan normal
      this._triggerAnimation(node);
    });
  }

  /**
   * 🧊 TARGETED RELEASE: PELEPAS PLACEHOLDER LAZY-LOAD
   *
   * Berbeda dengan init() yang memindai SEMUA [animation] (berisiko menjalankan
   * ulang typewriter/fade yang sudah selesai), metode ini HANYA memproses node
   * yang benar-benar sedang dibekukan oleh sistem anti-FOUC. Dipanggil oleh
   * ComponentRegistry setiap kali stylesheet lazy sebuah instance selesai
   * diinjeksi, sehingga timing rilis presisi per-komponen.
   *
   * @param root Akar pencarian (default: document.body)
   */
  public releaseLoadingPlaceholders(root: ParentNode = document.body): void {
    if (!root || typeof root.querySelectorAll !== "function") return;

    const heldNodes = root.querySelectorAll<HTMLElement>('[animation="loading-placeholder"]');
    heldNodes.forEach((node) => this._triggerAnimation(node));
  }

  private _setupChainedAnimation(node: HTMLElement): void {
    const parent = node.parentElement;
    if (!parent || !node.isConnected) return;

    // Pastikan init() ulang tidak menumpuk listener ganda pada node yang sama:
    // bila rantai ini masih MENUNGGU (terdaftar), biarkan listener lama bekerja.
    if (this.chainedListeners.has(node)) return;

    // 🧊 SNAPSHOT SEBELUM SEMBUNYI: simpan nilai inline ASLI (opasitas &
    // pointer-events) agar bisa dipulihkan persis saat giliran tiba. Tanpa
    // snapshot ini, elemen rantai seperti typewriter tertinggal opacity:0
    // selamanya — teks diketik, tapi tak pernah terlihat (bug lapangan).
    const originalOpacity = node.style.opacity;
    const originalPointerEvents = node.style.pointerEvents;

    // Sembunyikan elemen secara instan sambil menunggu instruksi pendahulunya
    node.style.opacity = '0';
    node.style.pointerEvents = 'none';

    // 🎯 PENDULU = saudara BERANIMASI yang tepat berada di depan node ini.
    // Rantai hanya boleh disambung oleh pendahulu ini — BUKAN oleh sembarang
    // 'animation:done' yang lewat di parent yang sama. Filter origin inilah
    // yang membuat beberapa sibling ber-animation-chain di satu parent berjalan
    // STRICT berurutan, bukan semuanya menyala serentak pada event pertama.
    const predecessor = this._previousAnimatedSibling(node);

    // Tidak ada pendahulu (mis. elemen rantai pertama dalam parent) → tidak ada
    // yang ditunggu; langsung siap beranimasi sejak awal.
    if (!predecessor) {
      this._releaseChainedNode(node, originalOpacity, originalPointerEvents);
      this._triggerAnimation(node);
      return;
    }

    const onPredecessorDone = (e: Event): void => {
      // Detail.origin = elemen yang TEPAT menuntaskan animasinya.
      const origin = (e as CustomEvent<{ origin: HTMLElement }>).detail?.origin;
      if (!origin) return;

      // Cocok hanya bila event berasal dari pendahulu itu sendiri — atau dari
      // dalam subtree-nya (segmen stagger-fade melaporkan elemen anak, bukan
      // node utamanya).
      const isFromPredecessor = origin === predecessor || predecessor.contains(origin);
      if (!isFromPredecessor) return;

      // Cocok! Lepas listener (rantai hanya boleh terbuka SEKALI), pulihkan
      // state asli, lalu jalankan animasinya.
      this.chainedListeners.delete(node);
      parent.removeEventListener('animation:done', onPredecessorDone);
      if (!node.isConnected) return;
      this._releaseChainedNode(node, originalOpacity, originalPointerEvents);
      this._triggerAnimation(node);
    };

    parent.addEventListener('animation:done', onPredecessorDone);
    this.chainedListeners.set(node, { parent, handler: onPredecessorDone });
  }

  /**
   * Saudara BERANIMASI tepat di atas node (pendahulu rantai). Elemen tanpa
   * atribut [animation] dilewati; null bila tidak ada pendahulu animasi.
   */
  private _previousAnimatedSibling(node: HTMLElement): HTMLElement | null {
    let el = node.previousElementSibling;
    while (el) {
      if (el.hasAttribute('animation')) return el as HTMLElement;
      el = el.previousElementSibling;
    }
    return null;
  }

  /**
   * Pulihkan state inline asli sebelum beranimasi: pointer-events kembali ke
   * nilai snapshot (atau dilepas bila semula tidak diset) DAN opasitas
   * dikembalikan agar elemen typewriter/scramble sungguh terlihat.
   */
  private _releaseChainedNode(node: HTMLElement, originalOpacity: string, originalPointerEvents: string): void {
    if (originalPointerEvents !== '') {
      node.style.pointerEvents = originalPointerEvents;
    } else {
      node.style.removeProperty('pointer-events');
    }

    if (originalOpacity !== '') {
      node.style.opacity = originalOpacity;
    } else {
      node.style.removeProperty('opacity');
    }
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    // Lepas semua listener rantai yang masih menggantung pada parent mana pun.
    this.chainedListeners.forEach((info) => {
      info.parent.removeEventListener('animation:done', info.handler);
    });
    this.chainedListeners.clear();
    this.activeAnimations.forEach((state) => {
      state.shouldStop = true;
    }); this.activeAnimations.clear();
  }

  // 🧯 REGISTRY ANIMASI YANG DIKENAL — pengetahuan statis agar entri tidak
  // pernah bocor untuk tipe yang tidak punya siklus done.
  static #knownAnimationTypes: string[] = [
    'typewriter', 'stagger-fade', 'fade-in', 'text-scramble', 'count-up', 'loading-placeholder'
  ];

  private _triggerAnimation(node: HTMLElement): void {
    const animationType = node.getAttribute('animation');

    if (!AnimationsService.#knownAnimationTypes.includes(String(animationType))) {
      console.warn(`Framework Warning: Animasi "${animationType}" tidak dikenali.`);
      return;
    }

    // =========================================================================
    // 🧯 ANTI-LEAK REGISTRY (dulu MATI total: Map tidak pernah di-set & flag
    // shouldStop tidak pernah dibaca behaviour mana pun — alias destroy() dan
    // pelepasan node TIDAK PERNAH benar-benar menghentikan apa pun, sementara
    // init() dipanggil ulang di SETIAP navigasi halaman sehingga rantai
    // typewriter (apalagi mode loop: while(true)) MENUMPUH tanpa batas).
    //
    // Sekarang:
    // 1. Setiap rantai tercatat dengan objek state MILIKnya sendiri;
    // 2. Re-trigger node yang sama menandai rantai lama shouldStop=true —
    //    rantai lama mati di centang isConnected/isStopped BERIKUTNYA
    //    (termasuk while(true) mode loop), bukan menumpuk rantai ganda;
    // 3. Entri dihapus otomatis saat animasi selesai natural (wrapper done),
    //    saat node dicabut dari DOM (observer), atau saat destroy().
    // =========================================================================
    const previousState = this.activeAnimations.get(node);
    if (previousState) previousState.shouldStop = true; // supersed: bunuh rantai lama

    const state = { shouldStop: false };
    this.activeAnimations.set(node, state);
    // Closure MENANGKAP objek state rantai ini (bukan lookup Map): penimpaan
    // entri oleh re-trigger berikutnya tidak akan membalikkan sinyal stop.
    const isStopped = (): boolean => state.shouldStop;

    // Wrapper done generik: registrasi dilepas + event rantian ditembakkan.
    const done = (): void => {
      this.activeAnimations.delete(node);
      this._dispatchDoneEvent(node);
    };

    switch (animationType) {
      case 'typewriter':
        // Port 1:1 dari _handleTypewriter lama:
        // - override data-tw-loop / data-tw-rewrite di-resolve di dalam TypewriterBehaviour.animate()
        // - jeda kalimat tetap memakai _getDelayTime (atribut data-delay atau globalDelay),
        //   BUKAN config.typewriter.delay — sama persis seperti versi awalnya.
        // - isStopped: sinyal pemberhentian dari registry (destroy/supersede/detach).
        TypewriterBehaviour.animate(
          node,
          { ...(this.config.typewriter as TypewriterOptions), delay: this._getDelayTime(node) },
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
            this.activeAnimations.delete(node);
            this._dispatchDoneEvent(el);
          }
        );
        break;
      case 'fade-in':
        FadeInBehaviour.animate(node, { duration: this.config.fade?.duration! }, done);
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
        // Sinkron & instan (paritas 1:1: tidak punya siklus asinkron) —
        // registrasi langsung dilepas agar Map tidak menahan node sia-sia.
        CountUpBehaviour.animate(node);
        done();
        break;
      case 'loading-placeholder':
        // Modul anti-FOUC: menahan tampilan dengan skin shimmer lalu melepasnya
        // mulus ketika stylesheet lazy selesai; rantai disambung lewat done-event.
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


  private _getDelayTime(node: HTMLElement): number {
    return node.hasAttribute('data-delay')
      ? parseInt(node.getAttribute('data-delay') || '', 10)
      : this.globalDelay;
  }


  private _dispatchDoneEvent(node: HTMLElement): void {
    const parent = node.parentElement;
    if (parent) {
      // Buat custom event bawaan browser
      const doneEvent = new CustomEvent('animation:done', {
        bubbles: true, // Izinkan event naik ke atas DOM tree
        detail: { origin: node }
      });
      parent.dispatchEvent(doneEvent);
    }
  }


  // =========================================================================
  // KOLEKSI FUNGSI ANIMASI
  // Semua modul animasi kini dipisahkan ke dalam folder ./behaviours/.
  // Modul baru: buat class Behaviour di folder itu, lalu daftarkan
  // pada switch di _triggerAnimation().
  // =========================================================================


}
