export interface ScrambleOptions {
  /** Pool karakter acak yang dipakai untuk mengacak teks (gaya Matrix/Cyberpunk) */
  chars: string;
  /** Durasi acak per karakter (ms) */
  speed: number;
}

/**
 * MODUL: TEXT SCRAMBLE (Matrix/Cyberpunk)
 *
 * Port 1:1 dari _handleScramble lama di AnimationsService:
 * karakter diacak dari pool, dikunci satu-per-satu ke huruf asli,
 * dengan pengecekan node.isConnected di tiap loop utama dan sub-loop,
 * lalu memicu event 'animation:done' tepat setelah efek selesai total.
 */
export class ScrambleBehaviour {
  /** Utilitas jeda non-blocking */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Bilangan bulat acak [min, max) — hasilnya identik dengan Math.floor(Math.random() * length) versi lama */
  private static rng(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
  }

  /** Core Engine Text-Scramble */
  public static async animate(node: HTMLElement, options: ScrambleOptions, onDone: () => void): Promise<void> {
    const targetText = (node.textContent || '').trim();
    node.textContent = '';
    node.style.opacity = '1';

    const pool = options.chars;
    const speed = options.speed;

    // Menggunakan Intl.Segmenter agar pemotongan teks aman
    // @ts-ignore
    const segmenter = new Intl.Segmenter(document.documentElement.lang || 'id', { granularity: 'grapheme' });
    const targetChars = [...segmenter.segment(targetText)].map(s => s.segment);

    let currentTextArray = new Array(targetChars.length).fill('');
    const maxCycles = 12; // Berapa kali karakter diacak sebelum memadat jadi huruf asli

    for (let i = 0; i < targetChars.length; i++) {
      if (!node.isConnected) return;

      // Animasi mengacak karakter fungsional
      for (let cycle = 0; cycle < maxCycles; cycle++) {
        if (!node.isConnected) return;

        // Taruh karakter acak dari pool pada indeks saat ini
        currentTextArray[i] = pool[this.rng(0, pool.length)];

        // Beri sedikit kilasan acak pada huruf-huruf ke depan yang belum terbuka
        for (let j = i + 1; j < Math.min(i + 3, targetChars.length); j++) {
          currentTextArray[j] = pool[this.rng(0, pool.length)];
        }

        node.textContent = currentTextArray.join('');
        await this.sleep(speed / 2);
      }

      // Kunci karakter asli jika siklus acak selesai
      currentTextArray[i] = targetChars[i];
      node.textContent = currentTextArray.join('');
      await this.sleep(speed);
    }

    // Pemicu sistem rantai event setelah efek acak selesai total
    onDone();
  }
}