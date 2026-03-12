

/**=========================================================================
 * [FUNGSI CLIENT GITHUB: HAPUS FOTO ASET]
 * Menghapus foto sementara di memori browser atau permanen di Google Drive via Fetch POST
 * ==========================================================================
 */
async function deleteAssetPhoto() {
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;

  // 1. VALIDASI AWAL
  if (assetImages.length === 0) {
    Swal.fire({ title: "Kosong!", text: "Tidak ada foto untuk dihapus!", icon: "warning", width: '80%' });
    return;
  }

  // 2. KONFIRMASI GAHAR
  const confirmHapus = await Swal.fire({
    title: "Hapus Foto",
    text: "Foto ini akan dihapus dari daftar?",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Ya, Hapus",
    cancelButtonText: "Batal",
    width: '80%'
  });

  if (!confirmHapus.isConfirmed) return;

  const currentUrl = assetImages[currentImgIdx];

  // --- JALUR A: FOTO BARU (BLOB / LOKAL GITHUB) ---
  if (currentUrl.startsWith("blob:") || currentUrl.startsWith("data:")) {
    // Hapus dari laci temp_Asset_Files
    const offset = assetImages.length - temp_Asset_Files.length;
    temp_Asset_Files.splice(currentImgIdx - offset, 1);
    assetImages.splice(currentImgIdx, 1);
    
    currentImgIdx = 0;
    updateImageSlider();
    
    Swal.fire({ title: "Sukses", text: "Pratinjau foto lokal dihapus", icon: "success", width: '80%' });
  } 
  
  // --- JALUR B: FOTO LAMA (PERMANEN DI DRIVE) ---
  else {
    const row = document.getElementById('assetRowIdx').value;
    const type = document.getElementById('as_type').value;

    Swal.fire({ title: 'Menghapus...', text: 'Sik, lagi dibusek di Drive...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
      const bodyPayload = {
        action: "removeSpecificAssetPhoto",
        payload: {
          type: type,
          row: row,
          photoUrl: currentUrl
        }
      };

      // Gunakan mode 'no-cors' untuk POST besar, atau CORS standar untuk membaca 'res.all'
        const response = await fetch(urlGAS, {
          method: 'POST',
          body: JSON.stringify(bodyPayload)
        });
      
        const res = await response.json();

        if (res.success) { // Cek dari hasil fungsi removeSpecificAssetPhoto
          // UPDATE RAM LOKAL: Sangat penting biar slider gak error!
         getAsset(type)[row - 1][5] = res.all.join(","); 
          
          assetImages = res.all;
          currentImgIdx = 0;
          updateImageSlider();
          Swal.fire({ title: "Sukses", text: "Foto berhasil dimusnahkan!", icon: "success", width: '80%' });
        }
    } catch (err) {
      console.error("Gagal hapus foto Drive:", err);
      Swal.fire({ title: "Gagal!", text: "Error server saat menghapus foto.", icon: "error", width: '80%' });
    }
  }
}


/**
 * [FUNGSI: EKSPOR DATA KE CSV]
 * Mengunduh daftar pengguna dalam format CSV melalui browser.
 */
async function downloadCSV() {
  try {
    // 1. Indikator Loading (Opsional pakai Swal)
    Swal.fire({ title: 'Menyiapkan CSV...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    // 2. Tembak URL Deployment dengan parameter action
    const response = await fetch(`${APPSCRIPT_URL}?action=exportUsersToCSV`);
    
    if (!response.ok) throw new Error("Gagal terhubung ke server Google.");
    
    const csvData = await response.text(); // Ambil teks CSV langsung

    if (csvData.startsWith("Error")) throw new Error(csvData);

    // 3. Proses Pembuatan File (Blob)
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // 4. Trigger Download Otomatis
    const link = document.createElement("a");
    const tgl = new Date().toLocaleDateString().replace(/\//g, '-');
    
    link.href = url;
    link.download = `Data_User_MANTAP_${tgl}.csv`;
    document.body.appendChild(link);
    link.click();
    
    // 5. Bersihkan Sampah
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    Swal.fire({ title: "Berhasil!", text: "Data berhasil diunduh.", icon: "success", timer: 2000 });

  } catch (err) {
    console.error("Download Error:", err);
    Swal.fire("Gagal Download", err.message, "error");
  }
}