/**
 * [FUNGSI CLIENT: LOAD AUDIT LOGS]
 * Memuat riwayat aktivitas terbaru ke dalam tabel UI
 */
async function loadAuditLogs() {
  const logContainer = document.getElementById('logTableBody'); 
  //const iframe = document.getElementById('iframeGAS');
  
  if (!logContainer) return;
  //if (!iframe || !iframe.src) return console.error("URL GAS tidak ditemukan!");

  //const urlGAS = APPSCRIPT_URL;

  // 1. Tampilkan loading spinner
  logContainer.innerHTML = `<tr><td colspan="3" class="text-center">
    <i class="fas fa-spinner fa-spin"></i> Memuat log terbaru...</td></tr>`;

  try {
    // 2. Fetch data dari doGet dengan action getLatestLogs
    //const response = await fetch(`${urlGAS}?action=getLatestLogs`);
    
    
    //if (!response.ok) throw new Error("Respon server gagal: " + response.status);

    //const logs = await response.json();

    const logs = getMaint("Logs");
    // 3. Cek jika data kosong
    if (!logs || logs.length === 0) {
      logContainer.innerHTML = "<tr><td colspan='3' class='text-center text-muted'>Belum ada aktivitas tercatat.</td></tr>";
      return;
    }

    // 4. Render HTML
    // Pastikan urutannya sesuai dengan kolom di Google Sheet kamu
// Contoh: A=0 (PIC), B=1 (Timestamp), C=2 (Aksi)

let html = "";
logs.forEach((log, index) => {
  // PENTING: Lewati baris pertama jika itu adalah judul/header (PIC, Timestamp, Aksi)
  if (index === 0) return; 

  html += `
    <tr>
      <td style="font-size: 11px; color: #888; white-space: nowrap;">${log[0] || "-"}</td>
      <td style="font-weight: bold; font-size: 13px;">${log[1] || "System"}</td>
      <td style="font-size: 12px; color: #444;">${log[2] || ""}</td>
    </tr>
  `;
});

logContainer.innerHTML = html;

    console.log("✅ Audit Logs berhasil dimuat.");

  } catch (err) {
    console.error("Gagal memuat log:", err);
    logContainer.innerHTML = "<tr><td colspan='3' class='text-danger text-center'>Gagal memuat data.</td></tr>";
    
    // Notifikasi Swal
    await Swal.fire({
      title: "Gagal Memuat Log",
      text: "Terjadi gangguan koneksi: " + err.message,
      icon: "error",
      confirmButtonText: "OK, Señor!",
      width: '80%'
    });
  }
}


/**
 * [FUNGSI CLIENT: BACKUP LOGS INSTAN DARI RAM]
 * Murni Lokal, Tanpa Fetch ke GAS, Langsung Download!
 */
async function backupLogSekarang() {
  // 1. AMBIL DATA UTUH DARI RAM (Termasuk Header)
  const rawData = getMaint("Logs") || [];
  
  if (rawData.length <= 1) {
    return Swal.fire({ title: "Kosong!", text: "Belum ada log untuk di-backup, Señor.", icon: "info" });
  }

  const result = await Swal.fire({
    title: "Backup Logs?",
    text: `Download ${rawData.length - 1} baris log ke format CSV?`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Ya, Download!",
    background: "#0f172a", color: "#fff"
  });

  if (!result.isConfirmed) return;

  try {
    // 2. LOGIKA RAKIT CSV (Wuzzz!)
    const csvContent = rawData.map(row => {
      return row.map(cell => {
        // Bersihkan tanda petik agar format CSV aman
        let cleanCell = String(cell).replace(/"/g, '""'); 
        return `"${cleanCell}"`;
      }).join(",");
    }).join("\n");

    // 3. BUAT BLOB & LINK DOWNLOAD "SILUMAN"
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const tgl = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `Backup_Logs_KSC_${tgl}.csv`;
    
    // 4. EKSEKUSI DOWNLOAD
    document.body.appendChild(link);
    link.click();

    // 5. BERSIHKAN JEJAK
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      speakSenor("Laporan log berhasil diunduh, Señor.");
      Swal.fire({ title: "Berhasil!", text: "File sudah masuk folder download.", icon: "success", timer: 2000 });
    }, 500);

  } catch (err) {
    console.error("Backup Error:", err);
    Swal.fire({ title: "Gagal", text: err.message, icon: "error" });
  }
}



/**
 * [FUNGSI CLIENT: BACKUP LOKAL & KOSONGKAN LOGS]
 * Memanfaatkan fungsi deleteRowGeneric yang sudah ada di GAS
 */
async function hapusLog() {
  // 1. AMBIL DATA LOGS DARI RAM
  const rawData = getMaint("Logs") || [];
  if (rawData.length <= 1) return Swal.fire("Kosong!", "Logs sudah bersih, Señor.", "info");

  const result = await Swal.fire({
    title: "Kosongkan Logs?",
    text: "Sistem akan mendownload Backup CSV & menghapus semua baris di Server.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, Eksekusi!",
    background: "#0f172a", color: "#fff"
  });

  if (!result.isConfirmed) return;

  try {
    // 2. BACKUP LOKAL (BIAR AMAN)
    const csvContent = rawData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Backup_Logs_${new Date().getTime()}.csv`;
    link.click();

    // 3. LOGIKA HAPUS MASSAL (MEMAKAI DELETE YANG SUDAH ADA)
    Swal.fire({ title: 'Cleaning Server...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // Kita hitung jumlah baris yang mau dihapus (Total baris minus Header)
    const totalData = rawData.length - 1;
    
    // Kirim perintah hapus ke GAS secara berurutan
    // Kita hapus dari baris TERBAWAH dulu agar index tidak geser
    for (let i = rawData.length; i > 1; i--) {
        await fetch(APPSCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "delete", // Pakai action delete yang sudah kamu punya!
                sheetName: "Logs",
                id: i // Hapus baris nomor i
            })
        });
    }

    // 4. SELESAI & SYNC
    await syncDataGhoib(); 
    Swal.fire({ title: "Berhasil!", text: "Logs dibersihkan & Backup terunduh.", icon: "success" });

  } catch (err) {
    Swal.fire({ title: "Gagal", text: err.message, icon: "error" });
  }
}
