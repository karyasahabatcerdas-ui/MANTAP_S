/**
 * [FUNGSI CLIENT: LOAD AUDIT LOGS]
 * Memuat riwayat aktivitas terbaru ke dalam tabel UI
 */
async function loadAuditLogs() {
  const logContainer = document.getElementById('logTableBody'); 
  //const iframe = document.getElementById('iframeGAS');
  
  if (!logContainer) return;
  //if (!iframe || !iframe.src) return console.error("URL GAS tidak ditemukan!");

  const urlGAS = APPSCRIPT_URL;

  // 1. Tampilkan loading spinner
  logContainer.innerHTML = `<tr><td colspan="3" class="text-center">
    <i class="fas fa-spinner fa-spin"></i> Memuat log terbaru...</td></tr>`;

  try {
    // 2. Fetch data dari doGet dengan action getLatestLogs
    const response = await fetch(`${urlGAS}?action=getLatestLogs`);
    
    if (!response.ok) throw new Error("Respon server gagal: " + response.status);

    const logs = await response.json();

    // 3. Cek jika data kosong
    if (!logs || logs.length === 0) {
      logContainer.innerHTML = "<tr><td colspan='3' class='text-center text-muted'>Belum ada aktivitas tercatat.</td></tr>";
      return;
    }

    // 4. Render HTML
    let html = "";
    logs.forEach(log => {
      html += `
        <tr>
          <td style="font-size: 11px; color: #888; white-space: nowrap;">${log.timestamp || "-"}</td>
          <td style="font-weight: bold; font-size: 13px;">${log.pic || "System"}</td>
          <td style="font-size: 12px; color: #444;">${log.action || ""}</td>
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


// --- FUNGSI BACKUP & ARCHIVE LOGS ---
async function backupLogSekarang() {
  const urlGAS = APPSCRIPT_URL;

  const result = await Swal.fire({
    title: "Backup Logs!",
    text: "Arsip dan kosongkan LOG sekarang? Tindakan ini tidak dapat dibatalkan.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#28a745",
    confirmButtonText: "Ya, Arsipkan",
    cancelButtonText: "Batal",
    width: '80%'
  });

  if (result.isConfirmed) {
    Swal.fire({
      title: 'Memproses Backup...',
      text: 'Membuat file arsip di Drive, mohon tunggu...',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const response = await fetch(urlGAS, {
        method: "POST",
        body: JSON.stringify({ action: "archiveLogs" })
      });
      const res = await response.json(); // Asumsi server kirim JSON {message: "..."}

      await Swal.fire({
        title: "Arsip Berhasil",
        text: res.message || res,
        icon: "success",
        width: '80%'
      });
    } catch (err) {
      Swal.fire({ title: "Gagal Backup", text: "Terjadi gangguan: " + err.message, icon: "error", width: '80%' });
    }
  }
}

// --- FUNGSI HAPUS LOGS ---
async function hapusLog() {
  const urlGAS = APPSCRIPT_URL;

  const result = await Swal.fire({
    title: "Kosongkan Logs?",
    text: "PERINGATAN: Semua riwayat aksi akan dihapus permanen. Lanjutkan?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Ya, Hapus Semua",
    cancelButtonText: "Batal",
    width: '80%'
  });

  if (result.isConfirmed) {
    Swal.fire({
      title: 'Membersihkan...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const response = await fetch(urlGAS, {
        method: "POST",
        body: JSON.stringify({ action: "clearLogsOnly" })
      });
      const res = await response.json();

      await Swal.fire({
        title: "Selesai",
        text: res.message || res,
        icon: "success",
        width: '80%'
      });
      if (typeof loadAuditLogs === 'function') loadAuditLogs(); // Refresh tabel log
    } catch (err) {
      Swal.fire({ title: "Gagal", text: "Terjadi kesalahan: " + err.message, icon: "error", width: '80%' });
    }
  }
}
