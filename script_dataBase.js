/**
 * 1. MEMERIKSA STATUS KONEKSI DB
 */
async function checkDBStatus() {
  const statusEl = document.getElementById('db_connection_status');
  if (statusEl) statusEl.innerHTML = "Memeriksa koneksi...";

  try {
    // Menembak URL lengkap dengan parameter action
    const response = await fetch(`${APPSCRIPT_URL}?action=checkMainDatabaseConnection`);
    const res = await response.json();

    if (res.success) {
      statusEl.innerHTML = `<span style="color:green;">✅ Terhubung ke: ${res.name} (${res.totalSheets} tab)</span>`;
    } else {
      statusEl.innerHTML = `<span style="color:red;">❌ ${res.message}</span>`;
    }
  } catch (err) {
    console.error("Conn Error:", err);
    if (statusEl) statusEl.innerHTML = `<span style="color:red;">❌ Gagal Terhubung ke Server</span>`;
  }
}

/**
 * 2. INSPEKSI FISIK DATABASE
 */
async function inspectDatabase() {
  console.log("Memulai inspeksi database...");
  Swal.fire({ title: 'Inspeksi DB...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  try {
    const response = await fetch(`${APPSCRIPT_URL}?action=getPhysicalDatabaseInfo`);
    const res = await response.json();
    Swal.close();

    if (res.success) {
      let msg = "Database Terdeteksi: " + res.fileName + "\n\n";
      res.sheets.forEach(s => {
        msg += `- Tab: ${s.name} (${s.rows} baris) [${s.isHidden ? 'Hidden' : 'Visible'}]\n`;
      });
      Swal.fire({ title: "Detail Database", text: msg, icon: "info" });
    } else {
      Swal.fire("Gagal", res.message, "error");
    }
  } catch (err) {
    Swal.fire("Error", "Gagal melakukan inspeksi: " + err.toString(), "error");
  }
}

/**
 * 3. LOAD TABEL KOMPARASI INTEGRITAS
 */
async function loadDBComparison() {
  const container = document.getElementById('dbTableBody');
  if (container) container.innerHTML = "<tr><td colspan='4'>Memeriksa integritas...</td></tr>";

  try {
    const response = await fetch(`${APPSCRIPT_URL}?action=getDatabaseComparison`);
    const res = await response.json();

    if (!res.success) return Swal.fire("Error", res.message, "error");
    
    let html = "";
    res.data.forEach(item => {
      let badgeColor = item.exists ? "#27ae60" : "#e74c3c";
      let rowStyle = item.remark.includes("Mati") ? "background:#fdf2f2;" : "";

      html += `
        <tr style="${rowStyle}">
          <td style="font-weight:bold;">${item.name}</td>
          <td style="text-align:center;">${item.status}</td>
          <td style="text-align:center;">
            <span style="background:${badgeColor}; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">
              ${item.exists ? "FISIK ADA" : "TIDAK ADA"}
            </span>
          </td>
          <td>
            ${!item.exists && item.status === "Y" ? 
              `<button onclick="repairSheet('${item.name}')" style="background:#f39c12; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">
                <i class="fas fa-tools"></i> Repair (Buat Tab)
              </button>` : 
              `<span style="color:#7f8c8d; font-size:11px;">${item.remark}</span>`
            }
          </td>
        </tr>`;
    });
    if (container) container.innerHTML = html;
  } catch (err) {
    if (container) container.innerHTML = "<tr><td colspan='4'>Gagal memuat data.</td></tr>";
  }
}

/**
 * 4. REPAIR SHEET & SYNC JADWAL
 */
async function repairSheet(typeName) {
  const konfirm = await Swal.fire({
    title: "Repair?",
    text: `Buat ulang tab '${typeName}'?`,
    icon: "question",
    showCancelButton: true
  });

  if (konfirm.isConfirmed) {
    try {
      const response = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'syncDatabaseSchema', type: typeName })
      });
      const res = await response.text();
      Swal.fire("Hasil", res, "success");
      loadDBComparison();
    } catch (err) {
      Swal.fire("Gagal", err.toString(), "error");
    }
  }
}

async function runSyncJadwal() {
  const btn = event.target;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Sinkronisasi...";

  try {
    const response = await fetch(APPSCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'syncAssetToJadwal', user: loggedInUser })
    });
    const res = await response.text();
    Swal.fire("Sukses", res, "success");
    if (typeof loadJad === 'function') loadJad();
  } catch (err) {
    Swal.fire("Error", err.toString(), "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

/**
 * 5. TAMBAH TIPE ASET BARU
 */
async function addNewTypeAsset() {
  const idType = document.getElementById('new_type_id').value.trim();
  const typeName = document.getElementById('new_type_name').value.trim();

  if (!idType || !typeName) return Swal.fire("Batal", "ID dan Nama Tipe harus diisi!", "warning");

  const btn = event.target;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Memproses...";

  try {
    const response = await fetch(APPSCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'addNewTypeRegistry',
        payload: { idType, typeName, adminAktif: loggedInUser }
      })
    });
    const res = await response.text();
    Swal.fire("Berhasil", res, "success");
    
    document.getElementById('new_type_id').value = "";
    document.getElementById('new_type_name').value = "";
    
    loadDBComparison();
    if (typeof loadAssetTypes === 'function') loadAssetTypes(); 
  } catch (err) {
    Swal.fire("Error", err.toString(), "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

/**
 * [FUNGSI: EKSEKUSI TAMBAH TIPE DARI UI]
 */
function execAddType() {
  const idType = document.getElementById('new_type_id').value.trim();
  const typeName = document.getElementById('new_type_name').value.trim();
  
  if (!idType || !typeName) return alert("Isi ID dan Nama Tipe!");

  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Memproses Database...";

  const payload = {
    idType: idType,
    typeName: typeName,
    adminAktif: loggedInUser
  };

  google.script.run
    .withSuccessHandler(function(res) {
      alert(res);
      btn.disabled = false;
      btn.innerHTML = "<i class='fas fa-plus'></i> Tambah";
      
      // Reset Input
      document.getElementById('new_type_id').value = "";
      document.getElementById('new_type_name').value = "";
      
      // Muat ulang tabel komparasi agar terlihat perubahannya
      if (typeof loadDBComparison === 'function') loadDBComparison();
    })
    .addNewTypeRegistry(payload);
}