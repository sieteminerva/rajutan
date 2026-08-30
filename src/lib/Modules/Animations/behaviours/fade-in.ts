export interface FadeInOptions {
  /** Durasi transisi CSS (mis. '0.5s' atau '500ms'), di-set sebagai variabel --fade-duration */
  duration: string;
}

/**
 * MODUL: FADE IN (Web Animations API)
 *
 * Port 1:1 dari _handleFadeIn lama di AnimationsService:
 * - delay dinamis dibaca dari atribut data-fade-delay (default '0s'),
 * - variabel --fade-delay / --fade-duration di-set ulang tiap eksekusi,
 * - keyframe display:none -> block + translateY(10px) -> 0 (500ms, ease-out),
 * - event 'animation:done' dipicu lewat Promise .finished bawaan WAAPI.
 */
export class FadeInBehaviour {
  public static async animate(node: HTMLElement, options: FadeInOptions, onDone: () => void): Promise<void> {
    // Contoh animasi lain: Menyiapkan delay dinamis jika diatur via HTML
    const delay = node.getAttribute('data-fade-delay') || '0s';
    node.style.setProperty('--fade-delay', delay);
    node.style.setProperty('--fade-duration', options.duration);

    const anim = node.animate(
      [
        { display: "none", opacity: 0, transform: 'translateY(10px)' },
        { display: "block", opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration: 500,
        easing: 'ease-out',
        fill: 'forwards'
      }
    );

    // WAAPI memiliki Promise .finished bawaan yang sangat akurat
    anim.finished.then(() => {
      if (!node.isConnected) return;
      onDone();
    });
  }
}