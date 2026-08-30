export interface StaggerFadeOptions {
  /** Jeda bertingkat antar segmen (ms): segmen ke-n muncul setelah n × delay */
  delay: number;
  /** Durasi transisi tiap segmen (contoh: '0.6s' atau '600ms') */
  duration: string;
}

/**
 * MODUL: STAGGERING FADE IN (Tetap Menggunakan Native Masking Premium)
 *
 * Port 1:1 dari _handleStaggerFade lama di AnimationsService:
 * - konversi durasi '0.6s' | '600ms' -> ms tetap sama,
 * - delay bertingkat = index × delay,
 * - event 'animation:done' dipicu PER SEGMEN (bukan sekali di akhir) karena
 *   begitulah perilaku versi lama; listener rantai memakai { once: true },
 *   sehingga rantai bisa terpicu sedini segmen pertama selesai. Oleh karena
 *   itu callback-nya bernama onSegmentDone dan menerima elemen segmen.
 */
export class StaggerFadeBehaviour {
  /** Konversi string durasi CSS ('0.6s' | '600ms') ke angka milidetik untuk WAAPI */
  private static _toMs(durationStr: string): number {
    return durationStr.endsWith('ms')
      ? parseFloat(durationStr)
      : parseFloat(durationStr) * 1000;
  }

  /**
   * Bangun daftar segmen sesuai mode:
   * - 'line': pakai anak elemen yang sudah ada, atau buat satu <p> per baris.
   * - default ('sentence'): pecah teks menjadi kalimat berdiri sendiri (<span>).
   * Catatan: fungsi ini memutasi node (mengosongkan lalu mengisi ulang),
   * persis seperti perilaku versi lama.
   */
  private static _buildSegments(node: HTMLElement, mode: string): HTMLElement[] {
    if (mode === 'line') {
      if (node.children.length > 0) {
        return [...Array.from(node.children)] as HTMLElement[];
      }

      const lines = (node.textContent || '').split('\n').filter(line => line.trim() !== '');
      node.textContent = '';
      const created: HTMLElement[] = [];
      lines.forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        node.appendChild(p);
        created.push(p);
      });
      return created;
    }

    // Mode default 'sentence'
    const rawText = (node.textContent || '').trim();
    node.textContent = '';

    // @ts-ignore
    const segmenter = new Intl.Segmenter(document.documentElement.lang || 'id', { granularity: 'sentence' });
    const textSegments = [...segmenter.segment(rawText)].map((s: any) => s.segment.trim());

    const segments: HTMLElement[] = [];
    textSegments.forEach((sentence: string) => {
      if (sentence) {
        const span = document.createElement('span');
        span.textContent = sentence + ' ';
        span.style.display = 'inline-block';
        node.appendChild(span);
        segments.push(span);
      }
    });
    return segments;
  }

  /** Jalankan fade bertahap segmen-demi-segmen menggunakan Native Web Animations API */
  public static animate(
    node: HTMLElement,
    options: StaggerFadeOptions,
    onSegmentDone: (el: HTMLElement) => void
  ): void {
    const mode = node.getAttribute('data-stagger-mode') || 'sentence';
    const durationMs = this._toMs(options.duration);

    this._buildSegments(node, mode).forEach((el, index) => {
      // Sembunyikan elemen terlebih dahulu secara instan sebelum animasi dimulai
      el.style.opacity = '0';
      el.style.transform = 'translateY(15px)';

      // Trigger animasi bawaan browser dengan delay bertahap
      const anim = el.animate(
        [
          { opacity: 0, transform: 'translateY(15px)' }, // Keyframe Mulai
          { opacity: 1, transform: 'translateY(0)' }     // Keyframe Akhir
        ],
        {
          duration: durationMs,
          delay: index * options.delay,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          fill: 'forwards' // Menjaga elemen tetap di state akhir setelah animasi selesai
        }
      );

      anim.finished.then(() => {
        if (!el.isConnected) return;
        onSegmentDone(el);
      });
    });
  }
}