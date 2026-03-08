/**
 * MEGA SEARCH RAM: Sikat 1-5 Keyword di 22 Sheet
 * @param {string} targetSheet - Nama sheet (isi "ALL" untuk cari di semua asset)
 * @param {...string} keywords - Masukkan sampai 5 kata kunci
 *  [CARA PAKAI]
 *  const tes1 = megaSearch("ALL", "LG", "Rusak");
 *  console.log(tes1.msg, tes1.results);
 * FUNGSI INI TIDAK CASE SENSITIVE DAN MENGGUNAKAN LOGIKA AND (SEMUA KEYWORD HARUS ADA DI BARIS YANG SAMA)
 * 
 */
function megaSearch(targetSheet, ...keywords) {
  // 1. Bersihkan keyword dari spasi kosong dan ubah ke lowercase
  const activeKeys = keywords
    .filter(k => k && k.trim() !== "")
    .map(k => k.toString().toLowerCase());

  if (activeKeys.length === 0) return { status: "error", msg: "Keyword kosong!", count: 0 };

  let poolData = [];
  
  // 2. LOGIKA PILIH GUDANG: Cari di satu sheet atau SEMUA asset?
  if (targetSheet === "ALL") {
    Object.keys(window.APP_STORE.assets).forEach(sheet => {
      // Gabungkan semua baris (lompati header index 0)
      poolData.push(...window.APP_STORE.assets[sheet].slice(1).map(row => ({type: sheet, data: row})));
    });
  } else {
    const sheetData = window.APP_STORE.assets[targetSheet] || [];
    poolData = sheetData.slice(1).map(row => ({type: targetSheet, data: row}));
  }

  // 3. LOGIKA FILTER: Cek apakah SEMUA keyword ada di baris tersebut (AND logic)
  const result = poolData.filter(item => {
    const barisTeks = item.data.join(" ").toLowerCase();
    // Harus memenuhi SEMUA keyword yang diketik
    return activeKeys.every(key => barisTeks.includes(key));
  });

  // 4. RETURN: Status, Jumlah, dan Data
  return {
    status: (result.length > 0) ? "success" : "not_found",
    count: result.length,
    results: result, // Isinya: [{type: "AC_Split", data: [...]}, ...]
    msg: `Ketemu ${result.length} data cocok!`
  };
}

/**
 * MINI SEARCH: Mencari keyword di dalam array tertentu yang diberikan (Umpan)
 * @param {Array} dataArray - Array sumber yang mau disisir (Umpan)
 * @param {...string} keywords - Masukkan 1 sampai 3 atau lebih kata kunci
 * FUNGSI INI CASE SENSITIVE DAN MENGGUNAKAN LOGIKA AND (SEMUA KEYWORD HARUS ADA DI BARIS YANG SAMA)
        // Data Umpan (Misal hasil dari getAsset atau lainnya)
        const umpanAset = [
        ["ID01", "LG", "Lantai 1", "Baik"],
        ["ID02", "Daikin", "Lantai 2", "Rusak"],
        ["ID03", "LG", "Lantai 2", "Service"]
        ];

        // Cari LG yang ada di Lantai 2 saja
        const hasil = miniSearch(umpanAset, "LG", "Lantai 2");

        if (hasil.status === "success") {
        console.log(`✅ Mantap! Ketemu ${hasil.count} baris cocok.`);
        // Lanjut eksekusi fungsi lain pakai hasil.data
        } else {
        console.log("❌ Zonk, tidak ada yang cocok.");
        } 
 * 
 */
function miniSearch(dataArray, ...keywords) {
  // 1. Bersihkan keyword (buang yang kosong, ubah ke lowercase)
  const activeKeys = keywords
    .filter(k => k && k.toString().trim() !== "")
    .map(k => k.toString().toLowerCase());

  // Jika tidak ada keyword, langsung kembalikan status error
  if (activeKeys.length === 0) return { status: "error", count: 0, data: [] };

  // 2. LOGIKA PENYARINGAN
  const results = dataArray.filter(row => {
    // Gabung satu baris jadi satu string panjang untuk dicek
    const rowText = row.join(" ").toLowerCase();
    // Cek apakah SEMUA keyword ada di baris ini
    return activeKeys.every(key => rowText.includes(key));
  });

  // 3. RETURN: Penentu sukses/tidaknya untuk fungsi lain
  return {
    status: (results.length > 0) ? "success" : "not_found",
    count: results.length,
    data: results
  };
}
