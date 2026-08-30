/**
 * MODUL: COUNT UP (angka dinamis/statistik)
 *
 * Port 1:1 dari _handleCountUp lama di AnimationsService (masih berupa kerangka):
 * membaca angka dari textContent lalu menyimpannya di atribut
 * data-target-number untuk diproses oleh logika JS count-up lanjutan.
 *
 * CATATAN PARITAS: versi lama TIDAK memicu event 'animation:done' (belum ada
 * implementasinya), sehingga modul ini juga sengaja belum menyediakan onDone.
 * Modul ini tidak punya konfigurasi, sehingga tidak perlu interface Options.
 */
export class CountUpBehaviour {
  public static animate(node: HTMLElement): void {
    // Contoh animasi angka dinamis (misal statistik: 0 ke 100)
    const targetNumber = parseInt(node.textContent || '', 10) || 0;
    node.setAttribute('data-target-number', String(targetNumber));
    // Logika JS count-up Anda di sini...
  }
}