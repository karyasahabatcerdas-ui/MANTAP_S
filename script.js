//==================[FUNGSI -FUNGSI UNTUK ASSET]=================================//



async function updateAssetData(sheetName, assetId, updatedArray) {
  try {
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // Gunakan panggilGAS dengan payload objek
    const res = await panggilGAS("update", {
      sheetName: sheetName,
      id: assetId,
      data: updatedArray
    });

    if (res && res.status === "success") {
      // 3. SINKRONISASI DATA (Tarik data terbaru dari GitHub)
      await syncDataGhoib(); 
      
      Swal.fire("Tersimpan!", "Data Aset & GitHub berhasil disinkronkan.", "success");
      return true;
    } else {
      throw new Error(res ? res.message : "Gagal terhubung ke server");
    }
  } catch (err) {
    Swal.fire("Gagal Simpan", err.message, "error");
    return false;
  }
}



async function tambahAset(sheetName, newRow) {
  // Panggil kurir panggilGAS
  const res = await panggilGAS("append", {
    sheetName: sheetName,
    data: newRow
  });

  if (res && res.status === "success") {
    // Tarik data terbaru agar unit baru muncul di tabel
    await syncDataGhoib();
    Swal.fire("Berhasil!", "Unit baru telah terdaftar.", "success");
  }
  return res;
}

async function hapusAset(sheetName, assetId) {
  const res = await panggilGAS("delete", {
    sheetName: sheetName,
    id: assetId
  });

  if (res && res.status === "success") {
    // Tarik data terbaru agar baris di tabel hilang
    await syncDataGhoib();
    console.log("🗑️ Unit Terhapus dari Server & GitHub.");
  }
  return res;
}


/* ----- script inisialisasi berakhir disini------------------*/

/**
 * FUNGSI CARI: Cari ID atau Nama di seluruh kategori Asset
 * @param {string} keyword - Kata kunci yang dicari (misal: "SPL-001")
 */
function cariAssetGlobal(keyword) {
  const hasil = [];
  const semuatyperAsset = Object.keys(window.APP_STORE.assets); // Ambil list 12 tipe AC
  
  semuatyperAsset.forEach(tipe => {
    const rows = getAsset(tipe);
    // Cari baris yang mengandung keyword (Case Insensitive)
    const match = rows.filter(row => 
      row.join("|").toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (match.length > 0) {
      hasil.push({ tipe: tipe, data: match });
    }
  });
  
  //console.log("🔍 Hasil Pencarian:", hasil);
  return hasil;
}

/* ----- konversi script ------------------*/

async function openGlobalSearch() {
  const tbody = document.getElementById('globalResultBody');
  const input = document.getElementById('masterSearchInput');
  
  // 1. Reset tampilan & Fokus
  tbody.innerHTML = ""; 
  input.value = "";
  document.getElementById('globalSearchModal').style.display = 'flex';
  input.focus();

  // 2. Tampilkan pesan awal (instan)
  tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>Silakan ketik ID atau Nama Asset di kolom pencarian...</td></tr>";

  // LOGIKA BARU: Kita tidak pakai FETCH lagi di sini. 
  // Kita akan biarkan fungsi 'input' (onkeyup) yang menyisir RAM nanti.
}

function liveSearchRAM(keyword) {
  const tbody = document.getElementById('globalResultBody');
  if (!keyword || keyword.length < 2) {
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Ketik min. 2 huruf...</td></tr>";
    return;
  }

  let hasilUntukTabel = [];
  const daftarTipe = Object.keys(window.APP_STORE.assets);

  daftarTipe.forEach(tipe => {
    const rows = getAsset(tipe) || [];
    
    // Mulai dari index 1 (Lompati Header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const teksSatuBaris = row.join("|").toLowerCase();
      
      if (teksSatuBaris.includes(keyword.toLowerCase())) {
        // --- ADAPTER: DISESUAIKAN DENGAN fillGlobalTable ---
        hasilUntukTabel.push({
          type: tipe,           // Untuk item.type
          id: row[0] || "-",    // Untuk item.id (Kolom A)
          nama: row[2] || "-",  // Untuk item.nama (Kolom B)
          lokasi: row[2] || "-",// Untuk item.lokasi (Kolom C)
          row: i + 1            // Untuk item.row (Nomor baris asli)
        });
      }
    }
  });

  // Lempar ke fungsi UI kamu yang sudah mantap itu
  fillGlobalTable(hasilUntukTabel);
}

function fillGlobalTable(results) {
  const tbody = document.getElementById('globalResultBody');
  if (!results || results.length === 0) {
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>Data tidak ditemukan...</td></tr>";
    return;
  }

  let html = "";
  results.forEach((item, index) => {
    html += `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:5px; text-align:center;">
          <!-- TAMBAHKAN data-asid="${item.id}" DI SINI -->
          <input type="radio" name="selAset" value="${item.type}|${item.row}" data-asid="${item.id}" style="cursor:pointer;">
        </td>
        <td style="padding:5px;"><b>${item.type}</b></td>
        <td style="padding:5px;">${item.id}</td>
        <td style="padding:5px;">${item.nama}<br>${item.lokasi}</td>
      </tr>`;
  });
  tbody.innerHTML = html;
}


/**============================================================================
 * [FUNGSI: NAVIGASI SAKTI - MODE MULTI-PAGE]
 * Mengarahkan hasil Search ke modal yang tepat sesuai halaman aktif.
 * ============================================================================
 */
async function navigateAsset() {
  const selected = document.querySelector('input[name="selAset"]:checked');
  if (!selected) return alert("Pilih aset dulu bos!");
  
  const [type, row] = selected.value.split('|');
  const unitID = selected.getAttribute('data-asid');   
  const urlGAS = APPSCRIPT_URL; //document.getElementById('iframeGAS').src; // URL Web App Anda

  // --- LOGIKA 1: MODAL MAINTENANCE LOG (SEARCH UNIT ID) ---
  const modalMaintLog = document.getElementById('modalMaintenanceLog');
  if (modalMaintLog && modalMaintLog.style.display === 'block') {
    fetchAssetDetailForLog(unitID);    
    closeGlobalSearch();
    return; 
  }

  // --- LOGIKA 2: INPUT JADWAL (GET SINGLE ASSET) ---
  if (document.getElementById('modalMaint').style.display === 'flex') {
    try {
      // Menggunakan GET dengan query parameter
      //const resp = await fetch(`${urlGAS}?action=getSingleAssetData&sheetName=${type}&row=${row}`);
      //const data = await resp.json();

      //fungsi penganti fetch
      // 1. Ambil gudang sesuai tipe (misal: "AC_Split")
      const gudangAsset = getAsset(type); 
      // 2. Ambil data baris tersebut (Ingat: Index = Baris - 1)
      const data = gudangAsset[row - 1];

      if (!data || data.length === 0) return alert("Data aset gagal diambil!");
      
      document.getElementById('m_as_id').value = data[0];   
      document.getElementById('m_type').value = type;      
      document.getElementById('m_as_nama').value = data[2];
      document.getElementById('m_lokasi').value = data [3];
      
      closeGlobalSearch();
    } catch (err) {
      console.error("Error ambil asset:", err);
    }
    return; 
  }

  // --- LOGIKA 3: NAVIGASI HALAMAN (GET SPECIFIC ASSET DATA) ---
  closeGlobalSearch();
  const currentPage = document.querySelector('.page:not(.hidden)').id;

  try {
    //const resp = await fetch(`${urlGAS}?action=getSpecificAsset&sheetName=${type}`);
    //const data = await resp.json();
    //fungsi pengganti fetch
    data = getAsset(type);

    if (currentPage === 'page_lihat_aset') {
      document.getElementById('viewAssetTypeSelect').value = type;
      renderAssetTableIncrementalView(type, data); 
      executeHighlight(row, 'viewAssetBody', true);
    } else {
      document.getElementById('assetTypeSelect').value = type;
      renderAssetTableIncremental(type, data);
      executeHighlight(row, 'assetBody', false);
    }
  } catch (err) {
    console.error("Error navigasi asset:", err);
  }
}

function executeHighlight(row, bodyId, isView) {
  setTimeout(() => {
    const tbody = document.getElementById(bodyId);
    const targetRow = tbody.rows[parseInt(row) - 2]; 
    
    if (targetRow) {
      // 1. Geser layar sampai baris target ada di tengah (Smooth)
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // 2. Kasih efek kedip kuning (Highlight)
      targetRow.classList.add('highlight-flash');
      
      // 3. OKE GAS! Langsung buka modal detilnya
      const type = isView ? document.getElementById('viewAssetTypeSelect').value : document.getElementById('assetTypeSelect').value;
      
      if (isView) {
        openAssetDetailView(type, row); // Mode Read-Only
      } else {
        openAssetDetail(type, row); // Mode Admin Edit
      }
    }
  }, 600); // Delay 600ms biar tabel sempet ngerender dulu
}


function closeGlobalSearch() {
  document.getElementById('globalSearchModal').style.display = 'none';
}


/**============================================================================
 * [FUNGSI: FETCH DETAIL ASET UNTUK LOG MAINTENANCE]
 * Menarik detail aset dari server berdasarkan ID untuk diisi ke Modal Maintenance Log.
 * Juga menangani logika auto-linking jadwal open jika ada.
 * ============================================================================
 */

async function fetchAssetDetailForLog(unitID) {
  if (!unitID) return;    
  const uiNama = document.getElementById('log_as_id');    
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;
  
  if(uiNama) uiNama.innerHTML = `<span class="text-gradient">Baca Database...</span>`;

  try {
    // Memanggil server dengan parameter action dan unitID
    //const response = await fetch(`${urlGAS}?action=getAssetDetailForLog&unitID=${unitID}`);
    //const res = await response.json();
    const res = getAssetDetailForLogRAM(unitID);//pengganti fungsi gas dilokal
    if (res && res.nama !== "TIDAK DITEMUKAN") {
      
      // 1. TAMPILKAN KONFIRMASI UNIT
      await Swal.fire({
        title: "Unit Ditemukan!",
        text: `${res.nama} (${res.type})`,
        icon: "success",
        confirmButtonText: "Mulai Kerja",
        width: '80%'
      });

      // 2. INJEKSI IDENTITAS KE UI
      document.getElementById('log_as_id').innerText = res.type + "-" + res.asId;
      document.getElementById('log_ui_asid').innerText = res.asId;
      document.getElementById('log_ui_type').innerText = res.type;
      document.getElementById('log_ui_nama').innerText = res.nama;
      document.getElementById('log_ui_lokasi').innerText = res.lokasi || "N/A";
      
      // 3. SET WAKTU MULAI DARI SERVER
      document.getElementById('log_time_mulai').value = res.serverTime;

      // 4. LOGIKA B.1.1 (AUTO-LINKING JADWAL OPEN)
      const logKegId = document.getElementById('log_keg_id');
      const dropdownJadwal = document.getElementById('jenis_id_jadwal');

      if (res.openJadwal && res.openJadwal.length > 0) {
        const hit = res.openJadwal[0]; 
        dropdownJadwal.value = hit.idJadwal; 
        logKegId.value = hit.maintId; 
        if(typeof speakSenor === "function") speakSenor("Jadwal terencana ditemukan Señor, silakan lanjut.");
      } else {
        logKegId.value = ""; 
        //dropdownJadwal.value = ""; 
        if(typeof speakSenor === "function") speakSenor("Tidak ada jadwal, silakan input manual.");
      }

      unlockMaintenanceForm(); 

    } else {
      await Swal.fire({ 
        title: "Unit Ghoib!", 
        text: "ID Unit [" + unitID + "] tidak ada!", 
        icon: "error", 
        width: '80%' 
      });
    }
  } catch (err) {
    console.error("Fetch Error:", err);
    if(uiNama) uiNama.innerText = "Error Koneksi!";
  }
}


/**=================================================================
 * [FUNGSI CLIENT GITHUB: LOAD HISTORY LOG]
 * Mengambil data log history dari server dan menyimpannya di memori untuk filtering/rendering
 * Menarik data log mentah dari Spreadsheet via Fetch GET
 * ==================================================================
 */
async function loadHist() {
  const tbody = document.getElementById("historyBody");
  //const iframe = document.getElementById('iframeGAS');
  //const urlGAS = APPSCRIPT_URL;
  
  // 1. AKTIFKAN ANIMASI THINKING
// Ganti isi if(tbody) kamu dengan logika Cek RAM ini:
const isDataReady = window.APP_STORE && Object.keys(window.APP_STORE.assets).length > 0;

if (!isDataReady) {
  tbody.innerHTML = `
    <tr>
      <td colspan="3" style="text-align:center; padding:40px;">
        <div class="sync-error-icon" style="font-size:30px; margin-bottom:10px;">📡</div>
        <div style="font-weight:bold; color:#ff4757;">Data Belum Sinkron!</div>
        <p style="font-size:12px; color:#777;">Gudang RAM masih kosong melompong, Señor...</p>
        <button onclick="syncDataGhoib()" class="btn-refresh-neon">
          <i class="fas fa-sync-alt"></i> SINKRON SEKARANG
        </button>
      </td>
    </tr>`;
  return; // Stop fungsi di sini
}



  try {

    const res = getMaint("Log_Kegiatan").slice(1).reverse(); // Balik urutan agar yang 
    // 3. HANDLING DATA
    if (!res || res.length === 0) {
      allHistoryData = [];
      if(tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">📭 Data Log Kosong.</td></tr>';
      return;
    }

    // Simpan ke variabel global dan render tabel
    allHistoryData = res;
    applyHistoryFilter(); 


  } catch (err) {
    console.error("❌ Gagal menarik riwayat: ", err);
    if(tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; color:red;">
            Gagal Terhubung: ${err.message}
          </td>
        </tr>`;
    }
  }
}
/**=================================================================
 * [FUNGSI: FILTER HISTORY LOG]
 * Menerapkan filter berdasarkan status dan jadwal, lalu render tabel
 * ==================================================================
 */

function applyHistoryFilter() {
  if (!allHistoryData || allHistoryData.length === 0) return;

  var statusVal = document.getElementById("filterStatusLog").value; // 'selesai' atau 'pending'
  var jadwalVal = document.getElementById("filterJadwalLog").value; // ID Jadwal

  var filtered = allHistoryData.filter(function(row) {
    
    // --- KOREKSI INDEKS SULTAN ---
    // Index 4 = E (Selesai)
    // Index 3 = D (Pending)
    // Index 7 = H (ID_Jadwal)

    var hasSelesai = (row[4] && row[4] !== "" && row[4] !== "-"); 
    var hasPending = (row[3] && row[3] !== "" && row[3] !== "-" && !hasSelesai);
    
    // A. Logika Status
    var matchStatus = true;
    if (statusVal === "selesai") matchStatus = hasSelesai;
    if (statusVal === "pending") matchStatus = hasPending;

    // B. Logika Jadwal (Dropdown filterJadwalLog)
    // Cek ID_Jadwal di Kolom H (Index 7)
    var matchJadwal = (jadwalVal === "" || jadwalVal.toUpperCase() === "ALL") || 
                      (row[7] && row[7].toString() === jadwalVal);

    return matchStatus && matchJadwal;
  });

  renderHistoryTable(filtered);
}
/**=================================================================
 * [FUNGSI: RENDER TABEL HISTORY LOG]
 * Menerima array data log yang sudah difilter dan menampilkannya di tabel
 * ==================================================================
 */

function renderHistoryTable(data) {
  const tbody = document.getElementById("historyBody");
  if (!tbody) return;
  tbody.innerHTML = ""; 

  data.forEach((row) => {
    // --- KOREKSI INDEKS SESUAI DATABASE 13 KOLOM ---
    // row[0]=ID_Log, row[2]=mulai, row[3]=pending, row[4]=selesai
    // row[5]=Petugas, row[6]=Asset_ID, row[7]=ID_Jadwal
    
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #eee";

    // --- LOGIKA STATUS WARNA SULTAN ---
    let statusLabel = '<i class="fa-solid fa-play"></i> START';
    let statusColor = "#2256e6d5"; // Orange

    // Cek Kolom E (Index 4) buat SELESAI
    if (row[4] && row[4] !== "" && row[4] !== "-") { 
      statusLabel = '<i class="fa-solid fa-square-check"></i> SELESAI'; 
      statusColor = "#27ae60"; // Hijau
    } 
    // Cek Kolom D (Index 3) buat PENDING
    else if (row[3] && row[3] !== "" && row[3] !== "-") { 
      statusLabel = '<i class="fa-solid fa-hourglass-start"></i> PENDING'; 
      statusColor = "#f39c12"; // Kuning
    }

    tr.innerHTML = `
      <td style="padding:5px; vertical-align:middle;">
        <div style="font-weight:bold; color:#2c3e50; font-size:13px;">${row[0]}</div>
        <div style="font-size:10px; color:#95a5a6; margin-top:4px;">
          <i class="fa-solid fa-clock"></i> ${row[2] || "-"}
        </div>
      </td>
      <td style="padding:5px; vertical-align:middle;">
        <div style="font-size:11px; margin-bottom:4px;">
          <i class="fa-solid fa-user-circle" style="color:#3498db;"></i> ${row[5] || "Unknown"}
        </div>
        <div style="padding:5px; vertical-align:middle;font-size:11px; margin-bottom:4px;">
          <i class="fa-solid fa-tag" style="color:#9b59b6;"></i> ${row[6] || "-"}
        </div>
        <div style="padding:5px; font-size:10px; color:#7f8c8d;vertical-align:middle;">
          <i class="fa-solid fa-calendar-alt"></i> JDW: ${row[7] || "-"}
        </div>
      </td>
      <td style="padding:5px;min-width:100px ;vertical-align:middle;">
        <button onclick="openDetailLog('${row[0]}')" 
                style=" background: ${statusColor}; color:white; border:none; border-radius:5px; cursor:pointer; padding:6px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
          <span class="status-badge-indicator" > ${statusLabel} </span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  //activeRowData = data;   //trap berfungsi dan ada isinya
  //console.log("🔍 Detail Log Ditemukan:", data); //trap berfungsi dan ada isinya
  //console.table({allHistoryData, activeRowData: data}); //trap berfungsi dan ada isinya
}


/**=================================================================
 * [FUNGSI: BUKA DETAIL LOG]
 * Menerima ID Log, mencari data lengkapnya dari allHistoryData, dan menampilkan di modal detail
 * ==================================================================
 */
function openDetailLog(logId) {
  // Pastikan allHistoryData sudah terisi dari server
  var data = allHistoryData.find(function(row) { return row[0] === logId; });
  if (!data) return Swal.fire("Data Ghoib!", "ID Log tidak ditemukan, Señor!", "error");

  activeRowData = data; 
  // console.log("🔍 Detail Log Ditemukan:", data); trap ok dan dan isinya
  //  console.table({allHistoryData, activeRowData: data}); //trap ok dan dan isinya
  //console.log("data dari opendetail.log :");
  //console.table(data);
  var setEl = function(id, val) {
    var el = document.getElementById(id);
    if (el) el.innerText = val || "-";
  };
  
  // --- INDEKS SESUAI HEADER 13 KOLOM ---
  setEl('det_log_id',    data[0]); // A: ID_Log
  setEl('det_maint_id',  data[1]); // B: Maint_ID (Tambahkan di UI jika perlu)
  setEl('det_start',     data[2]); // C: mulai
  setEl('det_pending',   data[3]); // D: pending
  setEl('det_selesai',   data[4]); // E: selesai
  setEl('det_petugas',   data[5]); // F: Petugas
  setEl('det_asset_id',  data[6]); // G: Asset_ID
  setEl('det_note',      data[8]); // I: Note

  document.getElementById('det_id_jadwal').value = data[7]; // H: ID_Jadwal //select id_jadwal
  // ISI THUMBNAIL FOTO (J, K, L, M)
  updateThumbnail('gal_before', data[9]);  // J: P_Before
  updateThumbnail('gal_on',     data[10]); // K: P_On
  updateThumbnail('gal_after',  data[11]); // L: P_After
  updateThumbnail('gal_check',  data[12]); // M: P_Check

// --- LOGIKA TOMBOL UPDATE (PENDING CHECK) ---
const btn = document.getElementById('btnupdateMaintenance');
if (btn) {
  // Tombol aktif HANYA jika kolom 'pending' (data[3]) TIDAK KOSONG
  const isPending = (data[3] !== "" && data[3] !== "-"); 
  
  btn.disabled = !isPending; 
  
  if (!isPending) {
    // KONDISI: TIDAK PENDING (MATI)
    btn.innerHTML = '<i class="fa-solid fa-calendar-alt"></i> SELESAI';
    btn.className = "btn-base btn-green"; // Class aslimu
    btn.style.opacity = "0.6"; // Lebih baik pakai opacity untuk efek disabled
    btn.style.cursor = "none";
  } else {
    // KONDISI: PENDING (AKTIF/BISA UPDATE)
    btn.innerHTML = '<i class="fa-solid fa-sync-alt"></i> UPDATE'; // Pakai innerHTML agar ikon muncul
    btn.className = "btn-base btn-gold"; // Tetap pakai class dasar
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
  }
}

  var modal = document.getElementById('modalDetailHist');
  if (modal) {
    modal.style.display = 'flex';
  }

}

/**================================================================================================
 * [FUNGSI: TUTUTP MODAL DETAILHIST]
 * Mengambil data dari window.activeRowData indeks 9-12
 * ================================================================================================
 */
function closeDetailHist() {
  document.getElementById('modalDetailHist').style.display = 'none';
}


/**================================================================================================
 * [FUNGSI: INISIALISASI SLIDER]
 * Mengambil data dari window.activeRowData indeks 9-12
 * ================================================================================================
 */
function initPhotoSlider(category) {
  var rawUrls = "";
  var data = activeRowData;
  
  if (!data) return alert("Data log belum termuat sempurna, Bro!");

  // Mapping indeks kolom I=8, J=9, K=10, L=11
  if (category === 'BEFORE') rawUrls = data[9];
  if (category === 'ON')     rawUrls = data[10];
  if (category === 'AFTER')  rawUrls = data[11];
  if (category === 'CHECK')  rawUrls = data[12];

  if (!rawUrls || rawUrls.toString().trim() === "") {
    return alert("Foto kategori " + category + " kosong!");
  }

  // Pecah string jadi array dan konversi ke direct link
  var tempArray = rawUrls.toString().split(",");
  currentPhotoList = tempArray.map(function(item) {
    return driveLinkToDirect(item.trim());
  });
  
  currentSliderIdx = 0;
  showPhotoInSlider();
  
  var modal = document.getElementById('modalPhotoSlider');
  if (modal) modal.style.display = 'flex';
}

/**================================================================================================
 * [FUNGSI: TAMPILKAN FOTO]
 * Hanya manipulasi SRC dan InnerText (Sangat Aman)
 * ================================================================================================
 */
function showPhotoInSlider() {
  var img = document.getElementById("fullPhotoView");
  var count = document.getElementById("photoCounter");
  
  if (!img) return;

  if (!currentPhotoList || currentPhotoList.length === 0) {
    img.src = "";
    if (count) count.innerText = "0 / 0";
    return;
  }

  // Ambil URL sesuai indeks
  var fotoUrl = currentPhotoList[currentSliderIdx];
  img.src = fotoUrl;

  // Update counter angka
  if (count) {
    var total = currentPhotoList.length;
    var sekarang = currentSliderIdx + 1;
    count.innerText = sekarang + " / " + total;
  }
}

/**================================================================================================
 * [FUNGSI: NAVIGASI FOTO]
 * Geser kanan atau kiri
 * ================================================================================================
 */
function changePhoto(step) {
  if (!currentPhotoList || currentPhotoList.length === 0) return;

  currentSliderIdx += step;

  if (currentSliderIdx < 0) {
    currentSliderIdx = currentPhotoList.length - 1;
  } else if (currentSliderIdx >= currentPhotoList.length) {
    currentSliderIdx = 0;
  }

  showPhotoInSlider();
}

/**================================================================================================
 * [FUNGSI: TUTUP PHOTO SLIDER]
 * ================================================================================================
 */
function closePhotoSlider() {
  var modal = document.getElementById('modalPhotoSlider');
  if (modal) modal.style.display = 'none';
  
  var img = document.getElementById('fullPhotoView');
  if (img) img.src = "";
}

/**=========================================================================
 * [FUNGSI: UPDATE THUMBNAIL FOTO ASET]
 * Memperbarui thumbnail foto aset di tampilan utama berdasarkan URL foto yang disimpan, dengan logika khusus untuk menangani kasus URL kosong atau tidak valid.
 * Logika thumbnail: Jika URL foto kosong atau hanya berisi spasi, kita tampilkan ikon placeholder dan label "0 Foto". Jika URL foto valid, kita ambil URL pertama (jika ada banyak), konversi ke direct link jika berasal dari Drive, dan set sebagai background image thumbnail. Kita juga update label jumlah foto berdasarkan jumlah URL yang ada. Untuk label waktu, kita bisa menampilkan waktu saat ini atau data waktu yang terkait dengan foto jika tersedia.
 * Pastikan fungsi ini dipanggil setiap kali data aset diperbarui, agar thumbnail di tampilan utama selalu mencerminkan kondisi terbaru dari foto yang terkait dengan aset tersebut.
 *==========================================================================
 */

function updateThumbnail(targetId, rawUrls) {
  var el = document.getElementById(targetId);
  var suffix = targetId.split('_')[1]; // mengambil 'before', 'on', dll
  var elCount = document.getElementById('cnt_' + suffix);
  var elTime = document.getElementById('time_' + suffix);
  
  if (!el) return;

  if (!rawUrls || rawUrls.toString().trim() === "") {
    el.style.backgroundImage = "none";
    el.innerHTML = '<i class="fas fa-image" style="color:#ccc; font-size:30px;"></i>';
    if (elCount) elCount.innerText = "0 Foto";
    if (elTime) elTime.innerText = "-";
    return;
  }

  var parts = rawUrls.toString().split(",");
  var count = parts.length;
  var firstUrl = parts[0].trim();
  
  // 1. Update Gambar
  el.innerHTML = "";
  el.style.backgroundImage = "url('" + driveLinkToDirect(firstUrl) + "')";
  el.style.backgroundSize = "cover";
  el.style.backgroundPosition = "center";

  // 2. Update Label Jumlah
  if (elCount) elCount.innerText = count + " Foto";

  // 3. Update Label Waktu (Jika namafoto mengandung jam, atau pakai jam input)
  // Untuk sementara kita ambil jam saat ini sebagai simulasi jika data jam tidak ada di kolom
  if (elTime) {
     var now = new Date();
     elTime.innerText = now.getHours() + ":" + (now.getMinutes()<10?'0':'') + now.getMinutes();
  }
}


/**=========================================================================
 * [FUNGSI: KONVERTER DRIVE KE LH3]
 * Memperbaiki URL agar bisa dibaca langsung oleh IMG tag
 * Logika konversi: Jika URL mengandung "drive.google.com", kita ekstrak ID file menggunakan regex yang aman, lalu kita buat URL baru dengan format "https://lh3.googleusercontent.com/d/ID_FILE" yang bisa langsung digunakan sebagai sumber gambar di tag IMG. Jika URL tidak mengandung "drive.google.com", kita kembalikan URL asli tanpa perubahan.
 * Pastikan fungsi ini dipanggil setiap kali kita ingin menampilkan gambar dari URL yang mungkin berasal dari Drive, agar gambar bisa langsung muncul tanpa error di halaman web.
 *==========================================================================
 */
function driveLinkToDirect(url) {
  if (!url || typeof url !== 'string') return "";
  if (url.indexOf("drive.google.com") === -1) return url;

  // Ekstrak ID File (Regex aman)
  var regex = /[-\w]{25,}/;
  var match = url.match(regex);
  
  if (match && match[0]) {
    var fileId = match[0];
    // Pastikan format URL lh3 lengkap dan benar
    return "https://lh3.googleusercontent.com/d/" + fileId;

  }
  return url;
}

/**=================================================================================
 * [FUNGSI UI: LIHAT JADWAL - VERSI FINAL DENGAN FILTER 2 MINGGU & STANDARISASI DATE]
 * [MENGGUNAKAN TI FORMATER KEEPER getServerTime]
 * =================================================================================
 */
let timerPencarian;
let historyJadwal = []; // Variabel global untuk menyimpan data jadwal mentah dari server

async function loadJad() {
  clearTimeout(timerPencarian);
  // Debounce 400ms agar tidak spam request saat user mengetik
  timerPencarian = setTimeout(async function() {
    //const iframe = document.getElementById('iframeGAS');
    //const urlGAS = APPSCRIPT_URL;
    const el = document.getElementById('filterType');
    const sheetName= el.options[el.selectedIndex].text;
    // 1. Ambil Nilai Filter dari UI GitHub
    const fType = el.value ? sheetName : "";
    const fState = document.getElementById('filterStateJadwal')?.value || "";
    const fIdJad = document.getElementById('filterIdJadwal')?.value || ""; 
    const sortBy = document.getElementById('sortJadwal')?.value || "";   
    const keyword = document.getElementById('cari_jadwal')?.value.toUpperCase() || "";

    try {
      // 2. Panggil Server (GET)getref
      //const response = await fetch(`${urlGAS}?action=getJadwal`);
      //const data = await response.json();

      const data = getMaint("Maintenance"); //pengganti fungsi gas dilokal
      historyJadwal = data ;
      
      if (!data || data.length < 2) return;
      
      // Ambil data tanpa header (asumsi data[0] adalah header)
      let rawData = data.slice(1); 

      // 3. FILTERING (Logika tetap sama di Client)
      if (fType) rawData = rawData.filter(d => String(d[1])=== fType);
      if (fState) {
        rawData = rawData.filter(d => {
          // Jika d[9] kosong/null/undefined, anggap sebagai "pending"
          const statusSekarang = (d[9] || "pending").toString().toLowerCase().trim();
          return statusSekarang === fState.toLowerCase().trim();
        });
      }
      if (fIdJad) rawData = rawData.filter(d => String(d[10]) === fIdJad);
      if (keyword) rawData = rawData.filter(d => d.join(" ").toUpperCase().includes(keyword));

      const now = new Date();
      //const now = await getServerTime(); 
      
      // HELPER KONVERSI TANGGAL
      const toDate = (val) => {
        if (!val) return new Date(0);
        const p = String(val).split(/[\/\s:]/); 
        if (p.length < 3) return new Date(0);
        // Format: dd/mm/yyyy
        return new Date(p[2], p[1] - 1, p[0], p[3] || 0, p[4] || 0, p[5] || 0);
      };

      // 4. SORTING & RENTANG WAKTU
        //const now = new Date(); // Pastikan ini ada di paling atas

        if (sortBy === 'terbaru') {
          rawData.sort((a, b) => toDate(b[7]) - toDate(a[7]));
        } 
        else if (sortBy === 'terlama') {
          rawData.sort((a, b) => toDate(a[7]) - toDate(b[7]));
        } 
        else if (sortBy === '2mgdepan') {
          const limitAhead = new Date();
          limitAhead.setDate(now.getDate() + 14);
          rawData = rawData.filter(d => {
            const dDate = toDate(d[7]);
            return dDate >= now && dDate <= limitAhead;
          });
        } 
        else if (sortBy === '2mglalu') {
          const limitBack = new Date();
          limitBack.setDate(now.getDate() - 14);
          rawData = rawData.filter(d => {
            const dDate = toDate(d[7]);
            // LOGIKA: Di antara 14 hari lalu sampai hari ini
            return dDate <= now && dDate >= limitBack;
          });
        }
        else if (sortBy === '1blndepan') {
          const limitAhead = new Date();
          limitAhead.setDate(now.getDate() + 30);
          rawData = rawData.filter(d => {
            const dDate = toDate(d[7]);
            return dDate >= now && dDate <= limitAhead;
          });
        }
        else if (sortBy === '1blnlalu') {
          const limitBack = new Date();
          limitBack.setDate(now.getDate() - 30);
          rawData = rawData.filter(d => {
            const dDate = toDate(d[7]);
            // LOGIKA PERBAIKAN: Di antara 30 hari lalu sampai hari ini
            return dDate <= now && dDate >= limitBack;
          });
        }

      // 5. RENDER KE TABEL/VIEW
      renderJadwalViewIncremental(rawData);

    } catch (err) {
      console.error("Gagal load jadwal:", err);
    }
  }, 400); 
}


/**================================================================================================================================
 * [FUNGSI: OPEN CUSTOM SCANNER]
 * Memanggil input file untuk scan QR, dengan penanda kategori 'SCAN' untuk logika khusus.
 * ============================================================================================================================
 * Catatan: Fungsi ini dipisah agar lebih fleksibel jika nanti ingin menambahkan jenis scan lain (misal: Barcode, NFC, dll) dengan logika berbeda.
 * Logika di handleLogPhotoSelect akan cek kategori 'SCAN' untuk memutuskan apakah akan proses sebagai QR atau sebagai dokumentasi foto biasa.
 */

 //let html5QrCode;

// --- A. LOGIKA SCANNER QR RESPONSIF ---
async function openCustomScanner() {
    currentCategory = 'SCAN';
    const modal = document.getElementById('qrModal');
    modal.style.display = 'flex';

    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    // Coba buka Kamera Belakang (environment)
    html5QrCode.start(
      { facingMode: "environment" }, 
      config, 
        (decodedText) => { 
          // Jika Berhasil Scan
            if (navigator.vibrate) navigator.vibrate(150);
            stopScannerAndProcess(decodedText);
        }, 
        (errorMessage) => { /* scanning... */ }
    ).catch(err => {
        // Jika Kamera Gagal/Tidak Ada
        console.error("Kamera Error:", err);
        Swal.fire({
            title: "Kamera Tidak Ditemukan",
            text: "Gunakan fitur Upload Galeri.",
            icon: "warning",
            width: '80%'
        }).then(() => {
          openGalleryForQR(); // Langsung trigger klik input file
        });
    });
}

// --- B. STOP & PROSES ---
function stopScannerAndProcess(decodedText) {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            const modal = document.getElementById('qrModal');
            //modal.classList.remove('active'); // Sembunyikan modal
              modal.style.display = 'none'; // Sembunyikan modal
            
            // Eksekusi Logika Unit ID Anda
            if (decodedText.includes("-")) {
                const unitID = decodedText.split("-")[1].trim(); 
                fetchAssetDetailForLog(unitID); // Panggil fungsi Fetch yang sudah kita buat
                if(typeof speakSenor === "function") speakSenor("Unit ID ketemu Señor!");
            }
        });
    }
}

// --- C. TUTUP MANUAL ---
function closeQrModal() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            //document.getElementById('qrModal').classList.remove('active');
            document.getElementById('qrModal').style.display = 'none';
        });
    } else {
        //document.getElementById('qrModal').classList.remove('active');
         document.getElementById('qrModal').style.display = 'none';
    }
}

// --- D. QR DARI GALERI ---
function openGalleryForQR() {
    // Tutup kamera dulu jika sedang aktif
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            currentCategory = 'SCAN';
            document.getElementById('logPhotoInput').click();
        });
    } else {
        currentCategory = 'SCAN';
        document.getElementById('logPhotoInput').click();
    }
}

/**================================================================================================================================
 *  FUNGSI CAPTURE PHOTO DENGAN KAMERA & GALERI (DOKUMENTASI MAINTENANCE)
 * ================================================================================================================================
 */ 
 let stream; //variabel global untuk menyimpan stream kamera agar bisa dimatikan saat modal ditutup

// --- 1. BUKA KAMERA DOKUMENTASI ---
async function capturePhoto(category) {
    currentCategory = category;
    document.getElementById('camLabel').innerText = category;
    const modal = document.getElementById('camModal');
    const video = document.getElementById('videoFeed');

    try {
        // Minta akses kamera belakang secara paksa
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: "environment" } }
        });
    } catch (err) {
        // Jika kamera belakang tidak ditemukan (misal di laptop), coba kamera apapun
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (e) {
            console.error("Kamera Error:", e);
            speakSenor("Kamera ghoib Señor, silakan pakai galeri.");
            openGalleryFromCam(); // Auto-switch ke galeri jika kamera gagal
            return;
        }
    }

    video.srcObject = stream;
    modal.style.display = 'flex';
}

/**================================================================================================================================
 * FUNGSI TOMBOL JEPRET FOTO & LOGIKA PENYIMPANAN SEMENTARA
 * ================================================================================================================================
 */

// --- 2. AMBIL FOTO (CAPTURE) ---
async function takeSnapshot() {
    const video = document.getElementById('videoFeed');
    const canvas = document.getElementById('photoCanvas');
    const context = canvas.getContext('2d');
    const cat = currentCategory;

    // Set ukuran canvas sesuai video feed
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Ambil data Base64
    const base64Data = canvas.toDataURL('image/jpeg', 0.8); // Kualitas 80% biar hemat memori
    const asId = document.getElementById('log_ui_asid').innerText.trim();
    const dateTag = await getMMDDYY();

    // Masukkan ke laci memori tempPhotos
    tempPhotos[cat].push({
        name: `${asId}_${dateTag}_${cat}_${tempPhotos[cat].length + 1}.jpg`,
        mimeType: 'image/jpeg',
        data: base64Data.split(',')[1] // Base64 murni tanpa header
    });

    if (typeof renderPhotoPreview === "function") renderPhotoPreview(cat);
    speakSenor(`Foto ${cat} siap Señor!`);
    closeCamModal();
}

/**================================================================================================================================
 * FUNGSI GALERI UNTUK SCAN QR & FOTO DOKUMENTASI
 * ================================================================================================================================
 */

// --- 3. LOGIKA GALERI & TUTUP ---
function openGalleryFromCam() {
    closeCamModal();
    document.getElementById('logPhotoInput').click();
}

function closeCamModal() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop()); // Matikan lampu kamera
    }
    document.getElementById('camModal').style.display = 'none';
}

/**================================================================================================================================
 * FUNGSI HANDLE FILE INPUT UNTUK SCAN QR & FOTO DOKUMENTASI
 * =================================================================================================================================
 */

async function handleLogPhotoSelect(input) {
    if (!input.files || !input.files[0]) return;
    const imageFile = input.files[0];

    // JALUR 1: SCAN QR DARI GALERI
    if (currentCategory === 'SCAN') {        
        speakSenor("Lagi baca QR dari galeri Señor.");

        const scannerFile = new Html5Qrcode("reader"); 
        try {
            const decodedText = await scannerFile.scanFile(imageFile, true);
            if (decodedText.includes("-")) {
                const unitID = decodedText.split("-")[1].trim();
                if (navigator.vibrate) navigator.vibrate(150);
                fetchAssetDetailForLog(unitID);
                speakSenor("QR sukses Señor!");
            } else {
                throw new Error("Format salah");
            }
        } catch (err) {
            console.error("QR Error:", err);
            speakSenor("Gagal baca QR Señor.");
            Swal.fire({ title: "Gagal!", text: "QR tidak terdeteksi di foto ini.", icon: "error" });
        }
        input.value = ""; 
        return;
    }

    // JALUR 2: FOTO DOKUMENTASI (PB, PO, PA, PC)
    const cat = currentCategory;
    const asId = document.getElementById('log_ui_asid').innerText.trim();
    const dateTag = await getMMDDYY(); // Fungsi yang baru kita konversi

    const reader = new FileReader();
    reader.onload = (e) => {
        tempPhotos[cat].push({
            name: `${asId}_${dateTag}_${cat}_${tempPhotos[cat].length + 1}.jpg`,
            mimeType: imageFile.type,
            data: e.target.result.split(',')[1]
        });
        renderPhotoPreview(cat);
        input.value = "";
    };
    reader.readAsDataURL(imageFile);
}

/** ==========================================================================================================
 * [FUNGSI: RENDER PREVIEW FOTO PADA UI MODAL MAINTENANCE]
 * Menampilkan thumbnail foto yang sudah dipilih dengan opsi klik untuk perbesar dan tombol hapus satuan.
 * Juga mengupdate label tombol utama dengan jumlah foto yang sudah dipilih.
 * Fitur ini sangat penting untuk memberikan feedback visual kepada user tentang foto yang sudah mereka pilih, serta memberikan kontrol penuh untuk mengelola foto tersebut sebelum disimpan.
 * Implementasi ini juga mempertimbangkan berbagai sumber gambar (URL langsung dari Drive atau file lokal yang diubah ke Base64) untuk memastikan kompatibilitas maksimal.
 * Mendukung Preview Klik, Hapus Satuan, dan Integrasi Fullscreen
 * ============================================================================================================
 */
function renderPhotoPreview(cat) {
  const btn = document.getElementById(`btn_${cat}`);
  const prevLabel = document.getElementById(`prev_${cat}`);
  if (!btn || !prevLabel) return;

  // Sembunyikan thumb_area bawaan HTML (karena kita pindah ke dalam tombol)
  const externalThumb = document.getElementById(`thumb_area_${cat}`);
  if(externalThumb) externalThumb.style.display = 'none';

  const count = tempPhotos[cat].length;

  // 1. KONDISI KOSONG
  if (count === 0) {
    btn.classList.remove('btn-has-content');
    resetSingleCategoryUI(cat);
    return;
  }

  // 2. KONDISI ISI
  btn.classList.add('btn-has-content');
  btn.style.borderColor = "var(--neon-blue)";
  btn.style.background = "rgba(56, 189, 248, 0.05)";

  // Cari atau buat area thumb di dalam tombol
  let innerThumb = btn.querySelector('.inner-thumb-float');
  if (!innerThumb) {
    innerThumb = document.createElement('div');
    innerThumb.className = 'inner-thumb-float';
    btn.appendChild(innerThumb);
  }
  innerThumb.innerHTML = ""; // Bersihkan

  // 3. RENDER FOTO MELAYANG
  tempPhotos[cat].forEach((img, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = "thumb-wrapper";

    const image = document.createElement('img');
    image.src = (typeof img === 'string' && img.startsWith('http')) 
                ? driveLinkToDirect(img) 
                : "data:" + img.mimeType + ";base64," + img.data;
    
    image.onclick = (e) => {
      e.stopPropagation();
      Swal.fire({ imageUrl: image.src, background: '#0f172a', showConfirmButton: false });
    };

    const delBtn = document.createElement('div');
    delBtn.className = "btn-delete-float";
    delBtn.innerHTML = "&times;";
    delBtn.onclick = (e) => {
      e.stopPropagation(); // Biar kamera gak kebuka pas mau hapus
      removeSinglePhoto(cat, index);
    };

    wrapper.appendChild(image);
    wrapper.appendChild(delBtn);
    innerThumb.appendChild(wrapper);
  });

  // Update Teks Label (Tetap terlihat di sebelah kanan)
  const title = (cat === 'PB') ? 'BEFORE' : (cat === 'PO') ? 'ON WORK' : (cat === 'PA') ? 'AFTER' : 'CHECKSHEET';
  prevLabel.innerHTML = `<b>${title}</b><br><small>${count}/3 FOTO</small>`;
}
/**=========================================================================
 * [FUNGSI: REMOVE FOTO DENGAN KONFIRMASI SWAL]
 * ==========================================================================
 */
async function removeSinglePhoto(cat, index) {
  const result = await Swal.fire({
    title: "HAPUS FOTO?",
    text: "Foto ini akan dihapus dari antrean upload.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444", // Merah Terang (Destructive)
    cancelButtonColor: "#334155",  // Slate Dark (Neutral)
    confirmButtonText: "YA, HAPUS",
    cancelButtonText: "BATAL",
    background: "#1e293b",         // Dark Background
    color: "#f8fafc",              // White Text
    iconColor: "#f59e0b",          // Amber/Gold Icon
    width: '85%',
    padding: '1.5rem',
    customClass: {
      popup: 'border-neon-red'     // Opsi: Jika ingin tambah border merah via CSS
    }
  });

  if (result.isConfirmed) {
    // 1. Hapus data dari memori (array sementara)
    tempPhotos[cat].splice(index, 1);
    
    // 2. Render ulang area thumbnail
    renderPhotoPreview(cat);
    
    // 3. Jika foto habis, kembalikan tampilan tombol ke default (Gahar Theme)
    if (tempPhotos[cat].length === 0) {
      resetSingleCategoryUI(cat);
    }

    // Feedback kecil (Opsional - Toast lebih smooth)
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500,
      background: '#1e293b',
      color: '#fff'
    });
    Toast.fire({
      icon: 'success',
      title: 'Terhapus'
    });
  }
}


/**=====================================================================
 * [FUNGSI: RESET UI TOMBOL FOTO]
 * Mengembalikan tampilan tombol ke kondisi awal (Industrial Neon)
 * ==============================================================
 */
function resetSingleCategoryUI(cat) {
  const btn = document.getElementById(`btn_${cat}`);
  if (!btn) return;

  // BALIKKAN KE SKEMA WARNA INDUSTRIAL (Slate & Dark Border)
  // Kita hapus style inline manual dan gunakan standar CSS kita
  btn.style.background = "var(--bg-input, #1a202c)";
  btn.style.borderColor = "var(--border-dim, #2d3748)";
  btn.style.color = "var(--text-dim, #a0aec0)";
  btn.style.borderStyle = "dashed"; // Memberi kesan "tempat upload"
  
  // Penentuan Icon & Judul berdasarkan Kategori
  let icon = 'camera';
  let title = '';
  
  switch(cat) {
    case 'PB': icon = 'camera'; title = 'BEFORE (PB)'; break;
    case 'PO': icon = 'tools'; title = 'ON WORK (PO)'; break;
    case 'PA': icon = 'check-double'; title = 'AFTER (PA)'; break;
    case 'PC': icon = 'clipboard-list'; title = 'CHECKSHEET'; break;
  }
  
  const maks = (cat === 'PC') ? '1' : '3';
  
  // Update isi tombol (Icon + Teks)
  btn.innerHTML = `
    <div id="prev_${cat}" class="photo-placeholder-content">
      <i class="fas fa-${icon} fa-2x"></i><br>
      <b style="color:var(--text-bright)">${title}</b><br>
      <small>Maks ${maks} Foto</small>
    </div>`;
  
  // PENGHAPUSAN THUMBNAIL AREA
  // Jika Señor nanti membuat area khusus untuk hasil foto (thumbnail), 
  // pastikan ID-nya sesuai agar bisa dibersihkan saat reset.
  const thumb = document.getElementById(`thumb_area_${cat}`);
  if (thumb) thumb.innerHTML = ""; // Bersihkan isinya daripada menghapus elemennya
}

/**=====================================
 * [FUNGSI PEMBANTU: RESET FOTO]
 * Membersihkan array penyimpanan foto dan mereset UI
 * =====================================
 */
function resetTempPhotos() {
  // Reset array penyimpanan global
  tempPhotos = { PB: [], PO: [], PA: [], PC: [] };
  
  // Reset tampilan setiap tombol kategori
  ['PB', 'PO', 'PA', 'PC'].forEach(cat => resetSingleCategoryUI(cat));
  
  console.log("📸 Photo buffers cleared.");
}


/**==============================
 * [FUNGSI CLIENT: START MAINTENANCE MODE]
 * Membuka modal dan mengunci semua input sampai data aset tervalidasi
 * ==============================
 */
function startMaintenanceMode() {
    const modal = document.getElementById('modalMaintenanceLog');
    const modalPlaceholder = document.getElementById('modalMaintenanceLog-placeholder');

    // FIX KLIK TEMBUS: Pastikan placeholder bisa berinteraksi kembali
    if (modalPlaceholder) {
        modalPlaceholder.removeAttribute('inert');
        modalPlaceholder.style.zIndex = "2900"; // Pastikan di depan layer lain
                                                // di atas yang alin di bawah holder dalam 3000
    }

    if (!modal) {
        console.error("❌ Modal Maintenance tidak ditemukan!");
        return;
    }
    
    // 1. Bersihkan sisa data & reset state
    //kita taruh luar biar pemanggil yg tentukan urutan
    /*
    if (typeof prepareMaintenanceLogic === 'function') {
        prepareMaintenanceLogic();
    }
        */

    // 2. --- SISTEM GEMBOK (LOCKDOWN) ---
    // Daftar ID yang harus dikunci di awal
    //initAllJadwalDropdowns();
    const elementsToLock = [
        'log_pekerjaan', 'btn_PB', 'btn_PO', 'btn_PA', 'btn_PC', 
        'btnLogPending', 'btnLogSelesai', 'jenis_id_jadwal'
    ];

    elementsToLock.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // Gunakan atribut 'disabled' untuk elemen input/button
            if (el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                el.disabled = true;
            }
            // Gunakan class untuk elemen div/wrapper agar lebih rapi di CSS
            el.classList.add('maint-locked');
            el.style.pointerEvents = "none";
            el.style.opacity = "0.3"; // Indikator visual gembok
        }
    });


    // 3. Tampilkan Modal
    modal.style.display = 'block';

    // 4. Pastikan tombol QR dan ID man terbuka 
    document.getElementById("btnCekQR").disabled = false ; // kunci klo sudah dibuka
    document.getElementById("btnCekMan").disabled = false ; // kunci klo sudah dibuka
    // Optional: Auto-scroll ke atas jika modal sangat panjang
    modal.scrollTop = 0;
    
}


/**=================================================================
 * [FUNGSI CLIENT GITHUB: EKSEKUSI MAINTENANCE UPDATE]
 * Mengambil data baris Pending dan memuatnya ke form via Fetch
 * ===================================================================
 */

 async function startMaintenanceModeUpdate() {
  //const urlGAS = APPSCRIPT_URL;

  // 1. VALIDASI DATA AWAL
  
  if (!activeRowData || activeRowData.length === 0) {
    await Swal.fire({ title: "Data Tidak Ditemukan!", icon: "error" });
    return; 
  }

  const data = activeRowData; 
  Swal.fire({
    title: 'Mencari Detail Aset...',
    text: 'Membaca dari Database...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    //mencari informasi asset berdasakan variable ID_Asset dari huruf depannya
    //const response = await fetch(`${urlGAS}?action=searchAllAssetsGo&keyword=${encodeURIComponent(data[6])}`);
    //const results = await response.json();

      // --- KODE BARU (KILAT WUZ!) ---
      // data[6] adalah ID Asset yang dikirim user
      const results = searchAssetRAM(data[6]);

    if (results && results.length > 0) {
      const res = results[0]; 
      Swal.close();

      // --- TRANSISI UI DULU (PENTING!) ---
      // Kita buka modal target dulu agar elemen-elemennya "bangun" di DOM
      update_man_status = true; 
      startMaintenanceMode(); 

      // --- PENGISIAN DATA (SETELAH MODAL DIBUKA) ---
      // Gunakan helper untuk menghindari crash jika elemen null
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };
      
      const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
      };

      // Sekarang kita isi datanya dengan aman
      setVal('log_keg_id', data[0]);  //log_id kode log kegiatan
      setVal('maint_id', data[1]);  //Maint_id kode jadwal maintenance
      let pend_sebelum = `Pending [tgl: ${data[3]}] [by: ${data[5]}] [Note: ${data[8]}] - Updated[next]`;
      document.getElementById('log_pekerjaan').placeholder= pend_sebelum; // sebagai placeholder note sekarang agar orang tahu itu catatan terdahulu tapi tidak bisa diubah
      setTxt('log_pekerjaan', ""); // kosongkan isinya
      setTxt('log_as_id', res.type + "-" + res.id); // UNIT ID
      setTxt('log_ui_type', res.type);      //Type_Asset
      setTxt('log_ui_asid', res.id);      //ID_Asset
      setTxt('log_ui_nama', res.nama);    //nama_asset
      setTxt('log_ui_lokasi', res.lokasi); //lokasi_asset

      setVal('jenis_id_jadwal', data[7]) ;
    
        // --- SOLUSI AMAN: TETAP ARRAY 1 DIMENSI ---
        // -- DIMASUKAN KE IMAGE HOLDERNYA MAINTENANCELOG SEBAGAI ARRAY DATAR 1 DIMENSI
        const categories = ['PB', 'PO', 'PA', 'PC'];
        const dataIndices = [9, 10, 11, 12]; 

        categories.forEach((cat, i) => {
          const rawLinks = data[dataIndices[i]]; 

          if (rawLinks && typeof rawLinks === 'string') {
            // KITA PECH JADI ARRAY STRING MURNI
            // Contoh: "link1, link2" -> ["link1", "link2"]
            tempPhotos[cat] = rawLinks.split(',')
              .map(link => link.trim())
              .filter(link => link !== "");
          } else {
            tempPhotos[cat] = [];
          }
        });

        // Jalankan render
        categories.forEach(cat => renderPhotoPreview(cat));
      //['PB', 'PO', 'PA', 'PC'].forEach(cat => renderPhotoPreview(cat));

      // --- FINALISASI ---
      // Tutup modal lama setelah modal baru siap
      const modalDetail = document.getElementById('modalDetailHist');
      if (modalDetail) modalDetail.style.display = 'none';
      prepareMaintenanceLogic(); // Reset logika & UI sesuai mode UPDATE
      unlockMaintenanceForm(); 

    } else {
      Swal.fire("Unit Tidak Ada!", `ID Aset [${data[6]}] tidak ditemukan.`, "error");
    }
  } catch (err) {
    Swal.fire("Server Error", err.toString(), "error");
  }
}
/**=====================================================================================================================================
 * [FUNGSI: RESET PENGGANTI MODAL LOG]
 * Membersihkan semua data sisa agar tidak menumpuk di sesi berikutnya
 * ======================================================================================================================================
 */
function prepareMaintenanceLogic() {
  const v1 = document.getElementById('maint_id').value;     // var1 (M-xxxxx)
  const v2 = document.getElementById('log_keg_id').value;   // var2 (L-xxxxx)
  const isUpdateMode = (typeof update_man_status !== 'undefined' && update_man_status === true);

  let mode = 0;
  let notif = "";

 

  switch (true) {
    // --- KONDISI 3: Update Jadwal & Kegiatan Lama (Full Update) ---
    case (isUpdateMode && v1.startsWith("M-") && v2.startsWith("L-")):
      mode = 3;
      notif = "🔄 Update Jadwal & Kegiatan Lama";
       //console.log(isUpdateMode);
        //console.log(v1);
        //console.log(v2);
      // Data, Waktu, & Foto DIPERTAHANKAN (Tidak ada reset)
      break;

    // --- KONDISI 2: Ambil Jadwal & Kegiatan Baru (Pending -> New Log) ---
    case (isUpdateMode && v1.startsWith("M-")):
      mode = 2;
      notif = "📅 Ambil Jadwal & Kegiatan Baru";
        //console.log(isUpdateMode);
        //console.log(v1);
        //console.log(v2);
      applyPartialReset(); // Reset Waktu & Input Kerja, tapi simpan Maint_ID
      break;

    // --- KONDISI 1 / DEFAULT: Buat Jadwal & Kegiatan Baru (Sapu Bersih) ---
    default:
      mode = 1;
      notif = "🆕 Buat Jadwal & Kegiatan Baru";
      //console.log(isUpdateMode);
      //console.log(v1);
      //console.log(v2);
      applyFullReset(); // Sapu bersih semua elemen UI & Metadata
      break;
  }

  // --- FINAL TOUCH: Kembalikan tombol ke warna/teks standar (Hanya jika mode 1 atau 2) ---
  if (mode !== 3) {
    const btnSelesai = document.getElementById('btnLogSelesai');
    if (btnSelesai) btnSelesai.innerHTML = '<i class="fas fa-check-circle"></i> SELESAI';
    console.log("✅ UI Cleaned & Metadata Reset.");
  }

  console.log(`🚀 Mode Terdeteksi: ${mode} | ${notif}`);
  return { mode, notif };
}

/** 
 * FUNGSI 1: RESET TOTAL (Mode 1)
 */
function applyFullReset() {
  console.log("🧹 Reset Total: Memulai sesi maintenance baru.");
  
  // 1. Reset Values & Placeholder
  const ids = ['maint_id', 'log_keg_id','log_time_mulai', 'log_pekerjaan',  'jenis_id_jadwal'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  if (document.getElementById('log_pekerjaan')) document.getElementById('log_pekerjaan').placeholder = "";

  // 2. Reset Display Text (-)
  ['log_ui_type', 'log_ui_asid', 'log_ui_nama', 'log_ui_lokasi', 'log_as_id'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerText = "-";
  });

  // 3. Reset Foto Visual & Metadata
  resetVisualPhotos();
  currentMaintData = null; 
  if (typeof resetTempPhotos === 'function') resetTempPhotos();
}

/** 
 * FUNGSI 2: RESET PARSIAL (Mode 2)
 */
function applyPartialReset() {
  console.log("♻️ Reset Parsial: Melanjutkan data Pending.");
  
  // Hanya Reset Waktu & Input Kerja & LogID
  const partialIds = ['log_time_mulai', 'log_pekerjaan', 'log_keg_id'];
  partialIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset Metadata & Foto (Karena ini log baru)
  currentMaintData = null;
  resetVisualPhotos();
  if (typeof resetTempPhotos === 'function') resetTempPhotos();
}

/** 
 * FUNGSI 3: RESET VISUAL FOTO (Helper)
 */
function resetVisualPhotos() {
  const icons = { 'PB': 'fa-camera', 'PO': 'fa-tools', 'PA': 'fa-check-double', 'PC': 'fa-clipboard-list' };
  const labels = { 'PB': 'BEFORE (PB)', 'PO': 'ON WORK (PO)', 'PA': 'AFTER (PA)', 'PC': 'CHECKSHEET' };

  Object.keys(icons).forEach(p => {
    const prev = document.getElementById(`prev_${p}`);
    if (prev) {
      prev.innerHTML = `<i class="fas ${icons[p]}"></i><br><b>${labels[p]}</b>`;
    }
  });
}


/**
 * [FUNGSI CLIENT GITHUB: BUKA GEMBOK MODAL]
 * Mengaktifkan input & sinkronisasi waktu/petugas via Fetch
 */
async function unlockMaintenanceForm() {
  //const iframe = document.getElementById('iframeGAS');
  //const urlGAS = APPSCRIPT_URL;
  
  const toUnlock = [
    'log_pekerjaan', 'btn_PB', 'btn_PO', 'btn_PA', 'btn_PC', 
    'btnLogPending', 'btnLogSelesai', 'jenis_id_jadwal'
  ];
  
  // 1. BUKA GEMBOK UI
  toUnlock.forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.disabled = false;
      el.classList.remove('maint-locked');
      el.style.pointerEvents = "auto"; 
      el.style.opacity = "1";
    }
  });

  try {
    // 2. AMBIL WAKTU SERVER (GET)
    //const response = await fetch(`${urlGAS}?action=getServerTime`);
    //const fullTimestamp = await response.json(); // Hasil: "dd/MM/yyyy HH:mm:ss"

    const fullTimestamp = await getServerTime(); // Fungsi lokal yang sudah kamu buat di fungsiGASLokal.js
    const timeInput = document.getElementById('log_time_mulai');
 
    
    if(timeInput) timeInput.value = fullTimestamp;

    document.getElementById("btnCekQR").disabled = true ; // kunci klo sudah dibuka
    document.getElementById("btnCekMan").disabled = true ; // kunci klo sudah dibuka

    console.log("🔓 Form Maintenance dibuka. Waktu Server:", fullTimestamp);

  } catch (err) {
    console.error("Gagal sinkronisasi waktu server:", err);
    // Fallback: Gunakan waktu lokal jika fetch gagal
    const timeInput = document.getElementById('log_time_mulai');
    if(timeInput) timeInput.value = new Date().toLocaleString('id-ID');
  }
}

/**====================================================================
 * [FUNGSI: TUTUP MAINTENANCE]
 * Membersihkan UI dan Reset Data Sementara
 * variable global  update_man_status="" ; 
 * =====================================================================
 */ 
function closeMaintenanceMode() {
  const modal = document.getElementById('modalMaintenanceLog');
  const btnSelesai = document.getElementById('btnLogSelesai');
  const btnPending = document.getElementById('btnLogPending');
  
  // Ambil placeholder/parent modal jika ada untuk 'inert'
  const modalPlaceholder = document.getElementById('modalMaintenanceLog-placeholder');
  
  

  const actionClose = () => {
    // 1. MELEPAS FOKUS (Solusi Error F12)
    // Memaksa browser melepas fokus dari tombol Close/Batal sebelum elemen disembunyikan
    if (document.activeElement) {
      document.activeElement.blur();
    }

    modal.style.display = 'none';
    
    // 2. MENGUNCI INTERAKSI (Aksesibilitas Modern)
    // Mencegah screen reader atau keyboard "melihat" ke dalam modal yang sudah tutup
    if (modalPlaceholder) {
      modalPlaceholder.setAttribute('inert', '');
      modalPlaceholder.removeAttribute('aria-hidden'); // Buang aria-hidden yang bermasalah
      modalPlaceholder.style.zIndex ="-1";
    }

    // --- RESET STATUS TOMBOL KE DEFAULT ---
    if(btnSelesai) {
      btnSelesai.disabled = false;
      btnSelesai.innerHTML = '<i class="fas fa-check-circle"></i> SELESAI';
      btnSelesai.style.opacity = "1";
    }
    if(btnPending) {
      btnPending.disabled = false;
      btnPending.innerHTML = '<i class="fas fa-pause"></i> PENDING';
      btnPending.style.opacity = "1";
    }
    
    modal.style.pointerEvents = "auto";
    modal.style.opacity = "1"; 
    isSuccessSave = false; //reset status apakah ad kegiatan saving atau pending jik ay a= true
    
    
    if (typeof prepareMaintenanceLogic === 'function') {
      prepareMaintenanceLogic(); 
    }
    //reset kembali menjadi baru
    update_man_status = false; 
    // Kembalikan fokus ke body atau tombol pemicu utama agar teknisi bisa lanjut scroll
    document.body.focus();
    console.log("🚪 Maintenance Mode Closed & Cleaned (A11y Fixed).");
  };

  if (isSuccessSave) {    //jika true artinnya tutup dari tombol savelog()
      actionClose();
  } else {
    Swal.fire({
      title: "Batalkan Input?",
      text: "Data dan foto yang belum dikirim akan hilang.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Ya, Batalkan",
      cancelButtonText: "Kembali",
      background: "#1e293b",
      color: "#f8fafc",
      width: '85%'
    }).then((result) => {                
      if (result.isConfirmed) {   
            if (document.activeElement) {
                document.activeElement.blur();
              }            
        actionClose();
      }
    });


  }
}


/**=================================================================
 * [FUNGSI CLIENT GITHUB: SAVE LOG ENTERPRISE]
 * Mengirim data teks & bundle foto Base64 via Fetch POST
 * ==================================================================
 */
async function saveLog(status) {
    const note = document.getElementById('log_pekerjaan').value.trim();
    const btnSelesai = document.getElementById('btnLogSelesai');
    const btnPending = document.getElementById('btnLogPending');
    const modal = document.getElementById('modalMaintenanceLog');
    const piljadwal = document.getElementById('jenis_id_jadwal');

    // --- 1. VALIDASI (Tetap Sama) ---
    let pesanError = "";
    if (!note) pesanError += "<li>Catatan Kerja wajib diisi!</li>";
    if (piljadwal.value === '') pesanError += "<li>Pilihan Jadwal wajib dipilih!</li>";
    if (tempPhotos.PB.length === 0) pesanError += "<li>Foto BEFORE (PB) Kosong!</li>";
    if (tempPhotos.PO.length === 0) pesanError += "<li>Foto ON WORK (PO) Kosong!</li>";
    if (tempPhotos.PA.length === 0) pesanError += "<li>Foto AFTER (PA) Kosong!</li>";
    if (tempPhotos.PC.length === 0) pesanError += "<li>Foto CHECKSHEET (PC) Kosong!</li>";
    
    if (pesanError !== "") {
        await Swal.fire({
            title: "STOP, SEÑOR!",
            html: `<ul style="text-align:left; color:#d33;">${pesanError}</ul>`,
            icon: "error",
            width: '80%'
        });
        return; 
    }

    // --- 2. KONFIRMASI ---
    const konfirmasi = await Swal.fire({
        title: `Set status ${status}?`,
        text: "Kirim data dan foto ke server?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Ya, Kirim!",
        width: '80%'
    });

    if (konfirmasi.isConfirmed) {
        // Kunci UI
        modal.style.pointerEvents = "none"; 
        btnSelesai.disabled = true;
        btnPending.disabled = true;

        const activeBtn = (status === 'Selesai') ? btnSelesai : btnPending;
        activeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SENDING...';

        Swal.fire({
            title: 'Transmitting...',
            text: 'Sedang memproses data & foto ke Google Drive...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // --- 3. PREPARE PAYLOAD (Disesuaikan untuk panggilGAS) ---
        const payloadData = {
            payload: {
                logKegId : document.getElementById("log_keg_id").value,
                maintId  : document.getElementById('maint_id').value,
                mulai    : document.getElementById('log_time_mulai').value,
                status   : status,
                type     : document.getElementById('log_ui_type').innerText,
                asId     : document.getElementById('log_ui_asid').innerText,
                nama     : document.getElementById('log_ui_nama').innerText,
                lokasi   : document.getElementById('log_ui_lokasi').innerText,
                asJadwal : document.getElementById('jenis_id_jadwal').value, 
                petugas  : loggedInUser,
                note     : (document.getElementById('log_pekerjaan').placeholder || "") + " " + note
            },
            photoData: tempPhotos 
        };

        // --- 4. EKSEKUSI VIA panggilGAS ---
        try {
            // Kita kirim action "processMaintLogEnterprise" dan objek payloadData
            const result = await panggilGAS("processMaintLogEnterprise", payloadData);

            if (result && result.status === "success") {
                await Swal.fire({
                    title: "¡Misión Cumplida!",
                    text: result.data || "Data berhasil disimpan!", 
                    icon: "success",
                    width: '80%'
                });

                // Reset & Close
                isSuccessSave = true; 
                if (typeof closeMaintenanceMode === 'function') closeMaintenanceMode(); 
                console.table("savelog payload :",payloadData );
                console.log("savelog payload :",payloadData.payload );
                console.log("savelog payload :",payloadData.photoData );
                // Segera tarik data terbaru dari GitHub karena server sudah push ke sana
                await syncDataGhoib(); 
                
            } else {
                throw new Error(result ? result.message : "Gagal diproses server.");
            }

        } catch (err) {
            console.error("SaveLog Error:", err);
            await Swal.fire({
                title: "Gagal!",
                text: err.message,
                icon: "error",
                width: '80%'
            });
        } finally {
            modal.style.pointerEvents = "auto";
            btnSelesai.disabled = false;
            btnPending.disabled = false;
            btnSelesai.innerHTML = '<i class="fas fa-check-circle"></i> SELESAI';
            btnPending.innerHTML = '<i class="fas fa-pause"></i> PENDING';
        }
    }
}


/**======================================================================================================
 * [FUNGSI CLIENT GITHUB: LOAD TABEL KELOLA JADWAL]
 * Mengambil data jadwal dari server dan memanggil fungsi render khusus untuk panel kelola
 * =======================================================================================================
 */

async function loadKel() {
  const tbody = document.getElementById('kelolaBody');
  if (!tbody) return;

  //const iframe = document.getElementById('iframeGAS');
  //const urlGAS = APPSCRIPT_URL;

  // Berikan loading indicator sederhana
  tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'><i class='fas fa-spinner fa-spin'></i> Memuat panel kelola...</td></tr>";

  try {
    // Panggil server (Action sudah kita buat sebelumnya di doGet)
    //const response = await fetch(`${urlGAS}?action=getJadwal`);
    //const data = await response.json();

    const data = getMaint("Maintenance"); 

    if (!data || data.length < 2) {
      tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Belum ada jadwal maintenance.</td></tr>";
      return;
    }
    
    // Panggil mesin render khusus kelola jadwal Anda
    // window.renderKelolaIncremental(data);
    renderKelolaIncremental(data);

  } catch (err) {
    console.error("Gagal load kelola jadwal:", err);
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:red;'>⚠️ Error koneksi database.</td></tr>";
  }
}



/**=========================================================================================
 * [FUNGSI: MESIN RENDER KELOLA - TRACING: renderKelolaIncremental]
 * Update baris tabel secara cerdas dengan tombol Edit & Hapus di sisi kanan.
 * Fokus pada kolom penting: MaintID, Unit Aset, Plan, Status, dan Aksi (Edit/Hapus).
 * Data diambil langsung dari index yang sesuai (sesuai struktur data jadwal)
 * ==========================================================================================
 */
function renderKelolaIncremental(data) {
  const tbody = document.getElementById('kelolaBody');
  const existingRows = tbody.rows;
  const newDataLength = data.length - 1;

  for (let i = 1; i < data.length; i++) {
    const d = data[i];
    const rowIdx = i - 1;
    
    // Cukup ambil langsung nilainya dari index 7 (Kolom H)
    let planDate = d[7] || "-"; 
    
    // Warna Badge Status (J)
      // 1. Ambil data, bersihkan spasi, dan paksa ke huruf kecil
      const state = (d[9] || "open").toLowerCase().trim();

      // 2. Daftar warna sesuai status (Gak perlu if bertingkat)
      const statusColors = {
        "close":   "#27ae60", // Hijau
        "pending": "#f39c12", // Oranye
        "open":    "#2980b9", // Biru
        "cancel":  "#e74c3c"  // Merah
      };

      // 3. Ambil warna, atau default ke abu-abu (#7f8c8d) jika tidak dikenal
      let badgeColor = statusColors[state] || "#7f8c8d";

    // Susun isi baris: MaintID, Unit Aset, Plan, State, Aksi
    const rowHtml = `
      <td style="padding:5px;text-align: center;"><input type="checkbox" class="userCheckMaint" value="${i}"></td>
      <td style="padding:5px;">${d[0]}<br><b>${d[1]}</b>- ${d[2]}<br><small>${d[3]}</small></td>
      <td style="padding:5px;">${planDate}<br><small>${d[10]}</small></td>
      <td style="padding: 5px; text-align: center; ">
        
          <button onclick="openMaintModal(${i})" style="background:${badgeColor}; color:white; border:none; padding:6px 8px; border-radius:4px; cursor:pointer;">
            <i class="fa-solid fa-edit"></i> 
            EDIT 
          </button>      
      </td>
      `;

    // Update baris jika ada atau tambah baru (Incremental)
    if (existingRows[rowIdx]) {
      if (existingRows[rowIdx].innerHTML !== rowHtml) {
        existingRows[rowIdx].innerHTML = rowHtml;
      }
    } else {
      const newRow = tbody.insertRow();
      newRow.innerHTML = rowHtml;
    }
  }

  // Hapus sisa baris jika data di sheet berkurang
  while (tbody.rows.length > newDataLength) {
    tbody.deleteRow(newDataLength);
  }
}


/**===========================================================================
 * [FUNGSI: BUKA MODAL MAINTENANCE]
 * BUKA JENDELA DETAIL MODAL LOG KEGIATAN MAINTENANCE 
 * ===========================================================================
 */
async function openMaintModal(row = "") {
  const modal = document.getElementById('modalMaint');
  const btnSubmit = document.getElementById('btnCreateMaint'); 
  //const urlGAS = APPSCRIPT_URL; // URL Web App Anda
  
  if (!modal) return console.error("Gawat! Modal tidak ditemukan.");

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = (val !== undefined && val !== null) ? val : "";
  };

  // Set Baris Index
  setVal('maintRowIdx', row);

  if (row === "") {
    // --- MODE: CREATE NEW ---
    if(btnSubmit) btnSubmit.innerHTML = '<i class="fas fa-plus"></i> CREATE';

    try {
      // Ganti google.script.run dengan fetch GET
      //const resp = await fetch(`${urlGAS}?action=getNextMaintId`);
      //const nextId = await resp.json();

      //fungsi bantu mendapat Maint ID sementara
    // historyJadwal adalah array 2D [[A1, B1], [A2, B2], ...]
    let nextId;

    // 1. Cek jumlah baris (length)
    if (!historyJadwal || historyJadwal.length < 2) {
        // Jika kosong atau cuma ada Header (baris 1)
        nextId = "M-00001";
    } else {
        // 2. Ambil baris TERAKHIR (index: length - 1) 
        // dan kolom PERTAMA (index: 0)
        const lastRowIndex = historyJadwal.length - 1;
        const lastVal = String(historyJadwal[lastRowIndex][0]); 

        // 3. Belah (Replace), Tambah 1, dan Pad 5 Digit
        const num = parseInt(lastVal.replace("M-", "")) || 0;
        nextId = "M-" + (num + 1).toString().padStart(5, '0');
    }

    console.log("Next ID:", nextId);
    


      // 1. Isi Data Default
      setVal('m_id', nextId);
      setVal('m_type', "");
      setVal('m_as_id', "");
      setVal('m_as_nama', "");
      setVal('m_state', "open");
      setVal('maint_id_jadwal', "PM");
      setVal('m_shift_note', "");
      setVal('m_other_note', "");
      setVal('m_lokasi', ""); // hidden input lokasi untuk masa depan


      // 2. Set Jam Default 09:00
      let d = new Date();
      d.setHours(9, 0, 0, 0);
      let localTime = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      setVal('m_plan', localTime);

      // 3. Tampilkan Modal
      modal.style.display = 'flex';
      
      if (typeof speakSenor === "function") speakSenor("Siap buat data baru.");

    } catch (err) {
      console.error("Gagal mengambil ID baru:", err);
      alert("Koneksi ke server gagal saat mengambil ID baru.");
    }

  } else {
    // --- MODE: UPDATE ---
    if(btnSubmit) btnSubmit.innerHTML = '<i class="fas fa-save"></i> UPDATE';
    // Pastikan loadMaintDetail juga sudah kamu ubah ke fetch nantinya
    loadMaintDetail(row);
  }
}



/**
 * [FUNGSI UI: EKSEKUSI TOMBOL CREATE/UPDATE - SWAL EDITION]
 * Menjamin Fullscreen Tetap Aktif & Notifikasi Elegan
 */
async function saveMaintData() { 
    // 1. PENGAMBILAN DATA (DOM)
    const row = document.getElementById('maintRowIdx').value || "";             
    const asId = document.getElementById('m_as_id').value || "";                
    const mId = document.getElementById('m_id').value || "";                    
    const mType = document.getElementById('m_type').value || "";                
    const mNama = document.getElementById('m_as_nama').value || "";             
    const mPlan = document.getElementById('m_plan').value || "";                
    const mShift = document.getElementById('m_shift_note').value || "";         
    const mOther = document.getElementById('m_other_note').value || "";         
    const mstate = document.getElementById('m_state').value || "";              
    const mIDjad = document.getElementById('maint_id_jadwal').value || "";
    const mlokasi = document.getElementById('m_lokasi').value || "";       

    const user = typeof loggedInUser !== 'undefined' ? loggedInUser : "Unknown";
    const btn = document.getElementById('btnCreateMaint'); 

    if (!asId || !mPlan) {
      if (typeof speakSenor === 'function') speakSenor("Señor, data belum lengkap!");
      return Swal.fire({ title: "Warning", text: "Isi Aset & Plan Date!", icon: "warning", background: "#1e293b", color: "#fff" });
    }

    // 2. KONFIRMASI
    const confirm = await Swal.fire({
      title: (row === "") ? 'Buat Jadwal Baru?' : 'Simpan Perubahan?',
      text: "Data akan ditembak ke API server.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Tembak!',
      background: "#0f172a",
      color: "#fff"
    });

    if (!confirm.isConfirmed) return;

    // 3. UI LOADING
    Swal.fire({
      title: 'Tembak Data...',
      didOpen: () => { Swal.showLoading(); },
      background: "#0f172a",
      color: "#fff",
      allowOutsideClick: false
    });

    try {
        if(btn) { btn.disabled = true; btn.innerHTML = 'TEMBAK...'; }

        // 4. EKSEKUSI VIA panggilGAS (Interceptor Otomatis)
        // Kita bungkus data dan row ke dalam payload
        const res = await panggilGAS("saveMaintData", {
            data: [mId, mType, asId, mNama, "", "", user, mPlan, "", mstate, mIDjad, mShift, mOther, mlokasi],
            row: row 
        });

        if (res && res.status === "success") {
            if (typeof speakSenor === 'function') speakSenor("Misión Cumplida, Señor!");
            
            await Swal.fire({ 
                title: "BERHASIL!", 
                text: res.data || "Jadwal berhasil diperbarui", 
                icon: "success", 
                timer: 2000, 
                background: "#0f172a", color: "#fff" 
            });

            // 5. SYNC GITHUB & RAM: Sangat penting agar tabel langsung update
            await syncDataGhoib(); 

            if (typeof closeMaintModal === 'function') closeMaintModal();
            if (typeof loadJad === 'function') loadJad();

        } else {
            throw new Error(res ? res.message : "Gagal menyimpan jadwal");
        }

    } catch (err) {
        if (typeof speakSenor === 'function') speakSenor("Gagal tembak, Señor!");
        Swal.fire({ 
            title: "API Error", 
            text: err.message, 
            icon: "error", 
            background: "#0f172a", color: "#fff" 
        });
    } finally {
        if(btn) { 
            btn.disabled = false; 
            btn.innerHTML = (document.getElementById('maintRowIdx').value === "") ? 'CREATE' : 'UPDATE'; 
        }
    }
}


/**===========================================================================
 * [FUNGSI: TUTUP MODAL MAINTENANCE]
 * TUTUP JENDELA DETAIL MODAL LOG KEGIATAN MAINTENANCE 
 * ===========================================================================
 */

function closeMaintModal() {
  document.getElementById('modalMaint').style.display = 'none';

  // Balikkan mode ADMIN
  const btnCreate = document.getElementById('btnCreateMaint');
  const btnSearchInModal = document.getElementById('btnMaintSearch');
  
  if (btnCreate) btnCreate.style.display = "block";
  if (btnSearchInModal) btnSearchInModal.style.display = "block"; // Munculin lagi buat Admin

  // Buka kunci input
  ['m_plan', 'm_shift_note', 'm_other_note', 'm_state'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });

  // Kembalikan tombol Batal ke posisi semula (2 kolom)
  const btnCancel = document.getElementById('btnCancelMaint');
  if (btnCancel) {
    btnCancel.parentElement.style.gridTemplateColumns = "1fr 1fr";
    btnCancel.style.width = "";
    btnCancel.innerHTML = 'BATAL';
  }
}

/**=========================================================================================
 * [FUNGSI: MESIN RENDER JADWAL - TRACING: renderJadwalViewIncremental]
 * Update baris tabel secara cerdas dengan tombol aksi di sisi kanan.
 * Fokus pada kolom penting: MaintID, Unit Aset, Plan, Status, dan Aksi (Lihat Detail & Go To Maintenance).
 * Data diambil langsung dari index yang sesuai (sesuai struktur data jadwal)
 * ==========================================================================================
 */

function renderJadwalViewIncremental(data) {
  const tbody = document.getElementById('jadwalBody');
  tbody.innerHTML = ""; // Bersihkan dulu kalau urutan berubah
   data.forEach((d, i) => {
     
    //let planDate = d[7] ? new Date(d[7]).toLocaleString('id-ID', {dateStyle:'short', timeStyle:'short'}) : "-";

    // Warna Badge Status (J)
      // 1. Ambil data, bersihkan spasi, dan paksa ke huruf kecil
      const state = (d[9] || "open").toLowerCase().trim();

      // 2. Daftar warna sesuai status (Gak perlu if bertingkat)
      const statusColors = {
        "close":   "#27ae60", // Hijau
        "pending": "#f39c12", // Oranye
        "open":    "#2980b9", // Biru
        "cancel":  "#e74c3c"  // Merah
      };

      // 3. Ambil warna, atau default ke abu-abu (#7f8c8d) jika tidak dikenal
      let badgeColor = statusColors[state] || "#7f8c8d";
    
    // Di dalam loop render jadwal user (Lihat Jadwal)
    //      <tr style="border-bottom: 1px solid #eee;">
    //      </tr>
    const rowHtml = `

        <td style="padding:5px;">${d[0]}</td> <!-- Maint ID -->
        <td style="padding:5px;"><b>${d[1]}</b> - ${d[2]}<br><small>${d[3]}</small></td> <!-- Unit Aset -->
        <td style="padding:5px;">${d[7]}<br><small>${d[10]}</small></td> <!-- Plan Date -->
        <td style="padding:5px; text-align:center;">
          <!-- TOMBOL AKSI: Mengarah ke Mode Read-Only -->
          <button onclick="openMaintDetailView(${i+1})"style="background:${badgeColor}; color:white; border:none; padding:6px 8px; border-radius:4px; cursor:pointer;">
            <i class="fa-solid fa-search"></i> LIHAT
          </button>
        </td>
      `;

    tbody.innerHTML += rowHtml;
  });
}


/**=================================================================
 * [FUNGSI CLIENT GITHUB: EKSEKUSI MAINTENANCE UPDATE]
 * Mengambil data baris Pending dan memuatnya ke form via Fetch
 * ===================================================================
 */
async function goMaint(rowIdx) {
  //const urlGAS = APPSCRIPT_URL;

  //data mentah 1 baris yang dipilih
  const data = historyJadwal[rowIdx];
  //console.log("Data rowIdx:", rowIdx);
  //console.log("Data yang akan dimuat ke Maintenance Log:", data);

  // 1. VALIDASI DATA AWAL
  if (!data || data.length === 0) {
    await Swal.fire({
      title: "Data Tidak Ditemukan!",
      text: "Silakan pilih baris terlebih dahulu, Señor.",  
      icon: "error",
      width: '80%'
    });
    return; 
  }

  try {

      // 2. TAMPILKAN LOADING
  Swal.fire({
    title: 'Mencari Detail Aset...',
    text: 'Sik Tak Wocone Dilit...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });
      
      update_man_status = true; // tandai supaya tidak direset saat buka modal maintenancelog
      startMaintenanceMode(); 

      // 2. INJEKSI DATA DASAR
    // Helper Fungsi untuk mengisi value elemen UI GitHub
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val || "";
    };   
    setText('log_as_id',data[1]+"-"+data[2]);  // unit ID log kegiatan
    setText('log_ui_type', data[1]);              // input Type_Asset log kegiatan
    setText('log_ui_asid', data[2]);             // input ID_Asset
    setText('log_ui_nama', data[3]);           // input nama_Asset
    //supaya tidak bentrok
    setText('log_ui_lokasi', data[13]); //label select ID jadwal  log keg
    
    // Helper Fungsi untuk mengisi value elemen UI GitHub
    const setVal = (id, val) => {const el = document.getElementById(id);
      if (el) el.value = val || ""; };
    setVal('maintRowIdx', rowIdx); // hidden input
    setVal('maint_id', data[0]);  //input untuk M-0000X setVal
    setVal('jenis_id_jadwal', data[10]); //input select ID jadwal  log keg
    setVal('log_keg_id', "");  //input hidden kosong karena ambil dari jadwal Maint

    // belum di deklarisakn di database sementara di akhir dulu
    
  
      // --- TRANSISI UI ---
      const modalDetail = document.getElementById('modalDetailHist');
      if (modalDetail) modalDetail.style.display = 'none';

      // Buka modal maintenance log dengan data yang sudah terisi
      prepareMaintenanceLogic()
      unlockMaintenanceForm(); 
      // --- TAMBAHKAN INI UNTUK MENUTUP LOADING ---
    Swal.close(); 
    console.log("✅ Swal Closed, Form Ready.");
  
  } catch (err) {
    await Swal.fire({
      title: "Server Error",
      text: "Gagal memuat detail aset: " + err.toString(),
      icon: "error",
      width: '80%'
    });
  }
}

/** MENGHAPUS JADWAL DAN MENAMBAHKANNYA DALAM CATATAN LOG (VERSI 11 - PANGGIL GAS) */
async function delJad(row) {
  // 1. KONFIRMASI DULU
  const result = await Swal.fire({
    title: "Konfirmasi Hapus",
    text: `Apakah Anda yakin ingin menghapus baris ${row}?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Ya, Hapus!",
    cancelButtonText: "Batal",
    width: '80%' 
  });

  if (!result.isConfirmed) return;

  // 2. LOADING PEMICU
  Swal.fire({
    title: 'Menghapus Data...',
    didOpen: () => { Swal.showLoading(); },
    allowOutsideClick: false,
    background: "#0f172a",
    color: "#fff"
  });

  try {
    // 3. EKSEKUSI VIA panggilGAS
    // Payload disesuaikan dengan kebutuhan router doPost
    const res = await panggilGAS("delete", { 
      sheetName: 'maintenance', // Pastikan nama sheet sesuai di GS (case-sensitive)
      id: row + 1 // Jika 'row' adalah index array, +1 untuk baris spreadsheet (asumsi tanpa header di data)
    });

    if (res && res.status === "success") {
      // 4. BERHASIL & SYNC GITHUB
      await Swal.fire({
        title: "Terhapus!",
        text: res.data || "Baris berhasil dihapus",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#0f172a",
        color: "#fff"
      });

      // Tarik data terbaru dari GitHub agar tabel terupdate
      await syncDataGhoib();

      // Refresh tampilan tabel kelola
      if (typeof loadKel === 'function') loadKel();
      
    } else {
      throw new Error(res ? res.message : "Gagal menghapus data");
    }

  } catch (err) {
    console.error("Gagal hapus:", err);
    Swal.fire({
      title: "Gagal",
      text: err.message,
      icon: "error",
      background: "#0f172a",
      color: "#fff"
    });
  }
}


/**==================================================================
 * [FUNGSI UI: LIHAT JADWAL - MODE LOCK]=
 * =================================================================
 */
function openMaintDetailView(row) {
  // 1. Sembunyikan Tombol Aksi
  const btnCreate = document.getElementById('btnCreateMaint');
  const btnSearch = document.getElementById('btnMaintSearch');
  
  if (btnCreate) btnCreate.style.display = "none";
  if (btnSearch) btnSearch.style.display = "none";

  // 2. Gembok Semua Input (Disabled)
  const inputs = ['m_plan', 'm_shift_note', 'm_other_note', 'm_state'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });

  // 3. Ubah Tombol Batal Jadi Tombol Keluar Lebar  
  const btnCancel = document.getElementById('btnCancelMaint');
  if (btnCancel) {
    btnCancel.parentElement.style.display = "grid"; // Full width
    btnCancel.style.width = auto;
    btnCancel.innerHTML = '<i class="fas fa-times"></i> KELUAR PRATINJAU';
  }
    
  loadMaintDetail(row); // Panggil load data
}


/**=========================================================================
 * [FUNGSI CLIENT GITHUB: LOAD DETAIL JADWAL]
 * Menarik detail satu baris jadwal berdasarkan index baris
 * Menggunakan Fetch GET dengan parameter row untuk mengambil data spesifik dari server
 * ==========================================================================
 */
async function loadMaintDetail(row) {
  //const iframe = document.getElementById('iframeGAS');
  //const urlGAS = APPSCRIPT_URL;

  if (typeof speakSenor === "function") speakSenor("Mencari data, Señor...");

  try {
    // 1. PANGGIL SERVER (GET) dengan parameter action dan row
    //const response = await fetch(`${urlGAS}?action=getSingleMaintData&row=${row}`);
    //const data = await response.json();
    //coba pakai daftar chace yg sdh ada saja
    const data = historyJadwal[row];
    //await initAssetDropdowns();
    if (!data || data.length === 0) {
      if (typeof speakSenor === "function") speakSenor("Data ghoib Señor!");
      return;
    }
    //console.log(data);
    //await initAssetDropdowns();
    // Helper Fungsi untuk mengisi value elemen UI GitHub
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || "";
    };

    // 2. INJEKSI DATA DASAR
    setVal('maintRowIdx', row); // hidden input
    setVal('m_id', data[0]);  //input untuk M-0000X
    setVal('m_type', data[1]); // input Type_Asset
    setVal('m_as_id', data[2]); //input ID_Asset
    setVal('m_as_nama', data[3]);// input nama_Asset
    setVal('m_created', data[4]);// hidden input tanggal buat
    setVal('m_updated', data[5]);// hidden input tanggal diupdate
    setVal('m_updater', data[6]);//hidden input Pengupdate
    setVal('m_actual', data[8]);// hidden input tanggal selesai jika ada
    setVal('m_state', data[9]); // input select status
    setVal('maint_id_jadwal', data[10])
    setVal('m_shift_note', data[11]); //input shift not
    setVal('m_other_note', data[12]); // input other note
    setVal('m_lokasi', data[13]); // hidden input lokasi untuk masa depan
    //document.getElementById('m_state').value = String(data[9]).toLowerCase().trim();
    
    


    // 3. LOGIKA TANGGAL (Plan) 
    // Format dari GAS: "dd/mm/yyyy hh:mm" -> Ubah ke: "yyyy-mm-ddThh:mm"
    const s = data[7]; 
    if (s && s.length >= 16) {
      try {
        const formattedDate = `${s.substring(6,10)}-${s.substring(3,5)}-${s.substring(0,2)}T${s.substring(11,16)}`;
        setVal('m_plan', formattedDate);
      } catch (e) {
        console.error("Format tanggal error:", s);
      }
    }

    // 4. TAMPILKAN MODAL
    const modal = document.getElementById('modalMaint');
    if (modal) {
      modal.style.display = 'flex';
      if (typeof speakSenor === "function") speakSenor("Data dimuat.");
    }

      // 5. Atur Tombol Aksi dan Warna Badge Status (J)
      // 1. Ambil data, bersihkan spasi, dan paksa ke huruf kecil
      const cstate = (data[9] || "open").toLowerCase().trim();

      // 2. Daftar warna sesuai status (Gak perlu if bertingkat)
      const statusColors = {
        "close":   "#27ae60", // Hijau
        "pending": "#f39c12", // Oranye
        "open":    "#2980b9", // Biru
        "cancel":  "#e74c3c"  // Merah
      };

      // 3. Ambil warna, atau default ke abu-abu (#7f8c8d) jika tidak dikenal
      let badgeColor = statusColors[cstate] || "#7f8c8d";

      const btnGoMaint = document.getElementById("btnGoMaint");
  if (btnGoMaint) {
      btnGoMaint.parentElement.style.display = "grid";
      btnGoMaint.style.width = "auto";
      //btnGoMaint.style.backgroundColor = "${badgeColor} !important";
      btnGoMaint.style.setProperty('background', badgeColor, 'important');
      btnGoMaint.onclick = () => goMaint(row); // <--- Perbaikan di sini
   }

  } catch (err) {
    console.error("Gagal load detail jadwal:", err);
    if (typeof speakSenor === "function") speakSenor("Koneksi bermasalah Señor.");
  }
}


/**
 * EXPORT KILAT: Bikin CSV langsung dari RAM tanpa ngetuk pintu Server
 */
async function exportToExcel() {
  const konfirmasi = await Swal.fire({
    title: "Export Laporan?",
    text: "CSV akan dibuat bersih langsung dari RAM, Señor.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Ya, Export",
    background: "#0f172a", color: "#fff"
  });

  if (konfirmasi.isConfirmed) {
    Swal.fire({ title: 'Menyusun CSV...', didOpen: () => Swal.showLoading() });

    try {
      // 1. Ambil data utuh dari RAM (Gak perlu slice karena butuh header)
      const rawData = getMaint("Maintenance"); 

      if (!rawData || rawData.length === 0) throw new Error("Gudang RAM Kosong!");

      // 2. LOGIKA PEMBERSIHAN: Susun baris demi baris
      const csvContent = rawData.map(row => {
        return row.map(cell => {
          // Bersihkan tanda petik ganda agar format CSV tidak pecah
          let cleanCell = String(cell).replace(/"/g, '""'); 
          // Bungkus dengan petik ganda jika mengandung koma
          return `"${cleanCell}"`;
        }).join(",");
      }).join("\n");

      // 3. BUAT BLOB & DOWNLOAD (Tanpa window.location.href ke GAS)
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      const fileName = `Jadwal_Maint_${new Date().getTime()}.csv`;
      
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click(); // Pemicu download otomatis
      document.body.removeChild(link);

      // 4. Feedback
      speakSenor("Laporan bersih berhasil diekspor, Señor.");
      Swal.fire({ title: "BERHASIL!", text: "File sudah meluncur ke Download.", icon: "success", timer: 2000 });

    } catch (err) {
      console.error("Export Error:", err);
      Swal.fire("Gagal!", err.message, "error");
    }
  }
}

/**
 * [FUNGSI CLIENT GITHUB: HAPUS JADWAL MASSAL]
 * Menghapus banyak jadwal sekaligus dari Spreadsheet via Fetch POST
 */
async function doBulkDeleteMaint() {
  const selected = getSelectedRowsMaint(); // Memanggil fungsi pembantu (userCheckMaint)

  // 1. Validasi Pilihan
  if (selected.length === 0) { 
    Swal.fire({ 
      title: "Pilih Data!", 
      text: "Centang jadwal yang ingin dihapus.", 
      icon: "warning", 
      width: '80%',
      background: "#0f172a", color: "#fff"
    });
    return; 
  }
 
  // 2. Konfirmasi Hapus Massal
  const konfirmasi = await Swal.fire({
    title: "Hapus Massal?",
    text: `Kamu akan menghapus ${selected.length} data maintenance. Lanjutkan?`,
    icon: "warning", 
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Ya, Hapus!",
    cancelButtonText: "Batal",
    width: '80%',
    background: "#0f172a", color: "#fff"
  });

  if (konfirmasi.isConfirmed) { 
    Swal.fire({
      title: 'Sedang Menghapus...',
      text: 'Membersihkan database, mohon tunggu...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); },
      background: "#0f172a", color: "#fff"
    });

    try {
      // 3. EKSEKUSI VIA panggilGAS (Otomatis kirim sessionId & username)
      const res = await panggilGAS("deleteSelectedMaint", {
        type: "Maintenance", 
        selected: selected
      });

      if (res && res.status === "success") {
        // res.data.msg berasal dari return object di GS deleteSelectedMaint
        await Swal.fire({ 
          title: "Berhasil!", 
          text: res.data.msg || "Data berhasil dihapus.", 
          icon: "success", 
          width: '80%',
          background: "#0f172a", color: "#fff"
        });
        
        // 4. SINKRONISASI GITHUB & UI
        await syncDataGhoib(); 
        
        if (typeof loadJad === 'function') loadJad();
        if (typeof loadKel === 'function') loadKel();
        
        // Reset checkbox master agar tidak nyangkut
        const master = document.getElementById('selectAllMaint');
        if (master) master.checked = false;

      } else {
        throw new Error(res ? res.message : "Gagal menghapus di server.");
      }

    } catch (err) {
      console.error("Error Bulk Delete:", err);
      Swal.fire({
        title: "Gagal!", 
        text: err.toString(), 
        icon: "error", 
        width: '80%',
        background: "#0f172a", color: "#fff"
      });
    }
  }
}


function getSelectedRowsMaint() {
  let rows = [];
  // Mengambil semua checkbox yang dicentang
  document.querySelectorAll('.userCheckMaint:checked').forEach(cb => {
    const val = parseInt(cb.value);
    if (!isNaN(val)) rows.push(val);
  });
  return rows;
}

function toggleSelectAllMaint() {
  const master = document.getElementById('selectAllMaint');
  if (!master) return;
  
  const checkboxes = document.querySelectorAll('.userCheckMaint');
  checkboxes.forEach(cb => {
    cb.checked = master.checked;
  });
}


//===========================FUNGSI-FUNGSI IMPORT JADWAL=========================================

/**
 * [FUNGSI CLIENT: PARSE & VALIDATE RAM-FIRST]
 * Tanpa nunggu Server, Langsung Sisir RAM!
 */
async function parseCSV(text) {
  // 1. UI FEEDBACK (Animasi & Area)
  const dropZone = document.getElementById('dropZone');
  const animasi = document.getElementById('animasiValidasi');
  if (dropZone) dropZone.style.display = "none";
  if (animasi) animasi.style.display = "block";

  // 2. DETEKSI DELIMITER & HEADER
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length < 2) {
    if (animasi) animasi.style.display = "none";
    if (dropZone) dropZone.style.display = "block";
    return Swal.fire("File Kosong", "Tidak ada data di dalam CSV.", "error");
  }

  const firstLine = lines[0].toLowerCase();
  const delimiter = firstLine.includes(",") ? "," : ";";
  const headers = firstLine.split(delimiter).map(h => h.trim());

  const idxID = headers.indexOf("asset_id");
  const idxPlan = headers.indexOf("plan");
  const idxJad = headers.indexOf("id_jadwal");

  if (idxID === -1 || idxPlan === -1 || idxJad === -1) {
    if (animasi) animasi.style.display = "none";
    if (dropZone) dropZone.style.display = "block";
    return Swal.fire("Header Salah!", "Wajib ada kolom: id_jadwal, asset_id, plan", "error");
  }

  // 3. PEMBENTUKAN LIST DATA
  let rawList = lines.slice(1).map(line => {
    const cols = line.split(delimiter);
    let rawDate = (cols[idxPlan] || "").replace(/[\.-]/g, "/").trim().substring(0, 10);
    return {
      idJad: (cols[idxJad] || "").trim(),
      asId: (cols[idxID] || "").trim(),
      plan: rawDate + " 09:00:00"
    };
  }).filter(item => item.idJad && item.asId);

  // 4. LOGIKA VALIDASI RAM (PENGGANTI FETCH KE GAS)
  try {
    const hasilValidasi = rawList.map(item => {
      // A. Cek Keberadaan di Master (Pakai megaSearch RAM kita)
      const master = megaSearch("ALL", item.asId);
      
      if (master.status !== "success") {
        return { ...item, status: "NG", msg: "ID Asset Tidak Terdaftar" };
      }

      // B. Cek Duplikat di Jadwal Maintenance (RAM)
      const dataMaint = getMaint("Maintenance");
      const isDuplikat = dataMaint.some(row => {
        const dbAsId = String(row[2]).trim().toLowerCase(); // Kolom C
        const dbJadId = String(row[10]).trim().toLowerCase(); // Kolom K
        return dbAsId === item.asId.toLowerCase() && dbJadId === item.idJad.toLowerCase();
      });

      if (isDuplikat) {
        return { ...item, status: "NG", msg: "Jadwal Sudah Ada (Duplikat)" };
      }

      // C. LOLOS: Masukkan info Type & Nama dari RAM untuk dikirim ke GAS nanti
      return { 
        ...item, 
        status: "OK", 
        msg: "Ready", 
        foundType: master.results[0].type, 
        foundName: master.results[0].data[2] // Kolom C (Nama)
      };
    });

    // 5. SELESAI & TAMPILKAN PREVIEW
    if (animasi) animasi.style.display = "none";
    dataToImport = hasilValidasi; // Simpan ke memori global
    
    const okCount = dataToImport.filter(d => d.status === "OK").length;
    speakSenor(okCount > 0 ? `Validasi selesai. Ditemukan ${okCount} data OK.` : "Zonk! Data NG semua.");

    renderImportPreview(dataToImport); 

  } catch (err) {
    console.error("Error Validasi RAM:", err);
    if (animasi) animasi.style.display = "none";
    Swal.fire("Error RAM", "Gagal memproses validasi lokal.", "error");
  }
}


/**
 * [FUNGSI CLIENT: EKSEKUSI PROSES IMPORT JADWAL]
 * Mengirim data hasil validasi RAM ke server GAS
 */
async function processImport() {
  // 1. FILTER: Hanya ambil yang statusnya OK (Lolos Validasi RAM)
  const finalPayload = dataToImport.filter(item => item.status === "OK");

  if (finalPayload.length === 0) {
    if (typeof speakSenor === 'function') speakSenor("Waduh Señor, tidak ada data valid yang bisa disuntikkan.");
    return Swal.fire({ title: "Data Kosong!", text: "Pastikan status data adalah OK", icon: "warning", background: "#0f172a", color: "#fff" });
  }

  const btn = document.getElementById('btnConfirmImport');
  const bar = document.getElementById('progressBar');
  const progArea = document.getElementById('importProgress');
  
  // 2. UI LOADING
  if (btn) { 
    btn.disabled = true; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sinking...'; 
  }
  if (progArea) progArea.style.display = "block";
  if (bar) bar.style.width = "50%"; // Indikator awal proses
  
  Swal.fire({
    title: 'Sinking Data...',
    text: `Menyuntikkan ${finalPayload.length} jadwal baru, Señor.`,
    allowOutsideClick: false,
    background: "#0f172a",
    color: "#fff",
    didOpen: () => { Swal.showLoading(); }
  });

  // 3. EKSEKUSI VIA panggilGAS (Otomatis kirim sessionId & username)
  try {
    // Kita bungkus finalPayload ke dalam objek payload sesuai standar panggilGAS
    const res = await panggilGAS("processImportBulk", {
        payload: finalPayload,
        user: loggedInUser
    });

    if (res && res.status === "success") {
      if (bar) bar.style.width = "100%";
      if (typeof speakSenor === 'function') speakSenor("Misión Cumplida! Data sudah mendarat di database, aman Señor!");

      await Swal.fire({
        title: "Import Berhasil!",
        text: res.data || "Data berhasil disinkronkan.",
        icon: "success",
        width: '80%',
        background: "#0f172a",
        color: "#fff"
      });
      
      // 4. UPDATE RAM LOKAL & GITHUB
      // Sangat krusial agar 22 sheet di GitHub diperbarui dengan data impor baru
      await syncDataGhoib(); 
      
      if (typeof closeImportModal === 'function') closeImportModal(); 

    } else {
      throw new Error(res ? res.message : "Gagal diproses server.");
    }

  } catch (err) {
    if (bar) bar.style.width = "0%";
    console.error("Error Import:", err);
    if (typeof speakSenor === 'function') speakSenor("Gagal Señor, server sedang kewalahan.");
    
    Swal.fire({ 
        title: "Server Error!", 
        text: err.toString(), 
        icon: "error",
        background: "#0f172a",
        color: "#fff"
    });

    if(btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-redo"></i> PROSES ULANG';
    }
  }
}


/**
 * [FUNGSI UI: RENDER PREVIEW - VERSI INTELLIGENT RAM]
 */
function renderImportPreview(data) {
  lastValidatedData = data || [];
  const pArea = document.getElementById('previewArea');
  if (pArea) pArea.style.display = "block";
  
  filterPreview('ALL');
}

/**
 * [FUNGSI UI: FILTER & DISPLAY TABLE]
 */
function filterPreview(mode) {
  const pBody = document.getElementById('previewBody');
  const tableWrap = document.getElementById('tableScrollContainer');
  if (!tableWrap) return;

  let html = `
    <table id="mainPreviewTable" style="width:100%; border-collapse:collapse; font-family:sans-serif;">
      <thead style="background:#f8f9fa; position:sticky; top:0; z-index:10; border-bottom:2px solid #dee2e6;">
        <tr style="text-align:left; font-size:11px; color:#495057; text-transform:uppercase;">
          <th style="padding:12px; width:30px;">#</th>
          <th style="padding:12px;">DETAIL JADWAL (CSV)</th>
          <th style="padding:12px;">VALIDASI MASTER (RAM)</th>
          <th style="padding:12px; text-align:right;">STATUS</th>
        </tr>
      </thead>
      <tbody>`;

  let okCount = 0;

  lastValidatedData.forEach((item, index) => {
    const isOK = (item.status === "OK");
    if (isOK) okCount++;
    
    // Logic Filter (ALL / OK / NG)
    if (mode !== 'ALL' && item.status !== mode) return;

    // --- LOGIKA "MATA RAM": Ambil info asli dari database ---
    const infoMaster = megaSearch("ALL", item.asId);
    const namaAsli = infoMaster.status === "success" ? infoMaster.results.data : "⚠️ ID TIDAK TERDAFTAR";
    const tipeAsli = infoMaster.status === "success" ? infoMaster.results.type : "N/A";

    html += `
      <tr style="border-bottom:1px solid #eee; background:${isOK ? 'white' : '#fff5f5'}; transition: 0.2s;">
        <td style="padding:10px; color:#adb5bd; font-size:10px; vertical-align:top;">${index + 1}</td>
        
        <td style="padding:10px; vertical-align:top;">
          <div style="font-weight:bold; font-size:11px; color:#212529;">${item.idJad}</div>
          <div style="font-size:10px; color:#0d6efd; margin-top:2px;">ID: ${item.asId}</div>
          <div style="font-size:9px; color:#6c757d; margin-top:2px;"><i class="far fa-calendar-alt"></i> ${item.plan.split(" ")[0]}</div>
        </td>

        <td style="padding:10px; vertical-align:top;">
          <div style="font-size:10px; font-weight:bold; color:${isOK ? '#198754' : '#dc3545'};">${namaAsli}</div>
          <div style="font-size:9px; color:#6c757d;">Kategori: ${tipeAsli}</div>
        </td>

        <td style="padding:10px; text-align:right; vertical-align:middle;">
          <span style="display:inline-block; padding:3px 8px; border-radius:10px; font-size:9px; font-weight:bold; 
                background:${isOK ? '#d1e7dd' : '#f8d7da'}; color:${isOK ? '#0f5132' : '#842029'};">
            ${isOK ? 'READY' : 'REJECT'}
          </span>
          <div style="font-size:8px; color:#dc3545; margin-top:4px; font-style:italic;">${isOK ? '' : item.msg}</div>
        </td>
      </tr>`;
  });

  html += `</tbody></table>`;
  
  tableWrap.innerHTML = html;

  // Update Badge Counter (Jika ada elemennya)
  const elCount = document.getElementById('countPreview');
  if (elCount) elCount.innerText = okCount;

  // Update Tombol Eksekusi
  const btn = document.getElementById('btnConfirmImport');
  if (btn) {
    btn.disabled = (okCount === 0);
    btn.style.opacity = (okCount === 0) ? "0.5" : "1";
  }
}

/**
 * [STEP 0: PINTU MASUK FILE]
 * Menangani pemilihan file dari input atau drag-and-drop
 */
function handleFile(input) {
  const file = input.files[0];
  if (!file) return;

  // Ganti teks di area drop zone biar user tahu file lagi dibaca
  const dropText = document.querySelector('#dropZone p');
  if(dropText) dropText.innerText = "Membaca: " + file.name + "...";

  const reader = new FileReader();
  
  // Begitu selesai baca, langsung lempar ke Mesin Validasi RAM (parseCSV)
  reader.onload = (e) => {
    parseCSV(e.target.result); 
  };
  
  reader.onerror = () => {
    Swal.fire("Gagal!", "Waduh Señor, gagal baca filenya!", "error");
  };

  reader.readAsText(file);
}


function resetImport() {
  const ids = ['fileInput', 'previewArea', 'importProgress', 'errorArea', 'animasiValidasi'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      if(id === 'fileInput') el.value = "";
      else el.style.display = "none";
    }
  });

  // PENTING: Kosongkan laci memori RAM kita
  dataToImport = []; 
  lastValidatedData = []; 

  // Reset tampilan DropZone
  const dropZone = document.getElementById('dropZone');
  if(dropZone) {
    dropZone.style.display = "block";
    const p = dropZone.querySelector('p');
    if(p) p.innerText = "Klik atau Taruh CSV di sini";
  }

  // Reset Progress Bar
  const bar = document.getElementById('progressBar');
  if(bar) bar.style.width = "0%";
  
  console.log("🧹 Memori & UI Import Berhasil Disterilkan!");
}


function closeImportModal() {
  resetImport(); // Bersihkan dulu biar gak nyampah
  const modal = document.getElementById('modalImport');
  if (modal) modal.style.display = 'none';
  
  // Opsional: panggil fungsi refresh tabel jadwal utama kalau mau
  if (typeof loadJad === 'function') loadJad(); //opsional refresh jadwal utama setelah import
}

/**
 * [FUNGSI: GENERATE & DOWNLOAD CSV TEMPLATE - VERSI STANDAR RAM]
 * Dibuat instan di browser agar anti-blokir & super cepat.
 */
function downloadTemplate() {
  // 1. Tentukan Header & Contoh Data (Sesuaikan dengan index parseCSV)
  // Kolom: id_jadwal, asset_id, plan, shift_note, other_note
  const csvRows = [
    ["id_jadwal", "asset_id", "plan", "shift_note", "other_note"], // Header Wajib
    ["JAD-2024-001", "A-001", "25/12/2023", "Pagi", "Service Rutin"], // Contoh 1
    ["JAD-2024-002", "F-005", "26/12/2023", "Malam", "Cuci Filter"]    // Contoh 2
  ];

  // 2. Susun jadi string CSV
  const csvContent = csvRows.map(row => row.join(",")).join("\n");

  // 3. Bungkus jadi Blob (File Digital di RAM)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // 4. Buat Link "Siluman" untuk Download
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "Template_Import_Jadwal.csv");
  
  // 5. Eksekusi Download
  document.body.appendChild(link);
  link.click();
  
  // 6. Bersihkan Link dari DOM setelah 0.5 detik
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 500);

  // 7. Notifikasi SweetAlert (Feedback User)
  speakSenor("Template sudah terunduh, silakan cek folder download Anda.");
  Swal.fire({
    title: "Template Ready!",
    text: "Gunakan file ini sebagai acuan import, Señor.",
    icon: "success",
    timer: 2000,
    showConfirmButton: false,
    background: "#0f172a", color: "#fff"
  });
}

/**=========================================================================
 * [FUNGSI CLIENT GITHUB: LOAD TIPE ASET]
 * Sekali ambil dari server (fetch), semua dropdown tipe aset langsung sinkron via Cache.
 * ==========================================================================
 */
/**
async function loadAssetTypes() {
  //const iframe = document.getElementById('iframeGAS');
  //const urlGAS = APPSCRIPT_URL;

  // 1. Jika cache sudah ada di memori browser GitHub, langsung pakai
  if (cachedAssetTypes) {
    renderAllTypeDropdowns(cachedAssetTypes);
    return;
  }

  // 2. Jika belum ada, ambil dari server (GAS)
  try {
    //const response = await fetch(`${urlGAS}?action=getAssetTypes`);
    //const types = await response.json(); // Mengambil array tipe aset

    const types = getAsset("Type_Asset").slice(1).reverse(); // Ambil dari cache global jika sudah pernah dipanggil sebelumnya


    if (types && types.length > 0) {
      cachedAssetTypes = types; // Simpan ke cache global GitHub
      renderAllTypeDropdowns(types); // Sebar ke semua dropdown (filter, modal, dll)
      console.log("📥 Data Tipe Aset Baru Diterima & Disinkronkan.");
    }
  } catch (err) {
    console.error("Gagal memuat tipe aset:", err);
  }
}

*/
/**=========================================================================
 * [FUNGSI PEMBANTU: SEBAR DATA KE SEMUA DROPDOWN]
 * Menghindari penulisan berulang untuk setiap ID dropdown.
 * Menerima array tipe aset dan mengisi semua dropdown yang relevan dengan opsi baru.
 * ==========================================================================
 */
/*
function renderAllTypeDropdowns(types) {
  // Daftar ID dropdown yang harus diisi
  const dropdownIds = ['assetTypeSelect', 'viewAssetTypeSelect', 'filterType', 'm_type'];
  
  dropdownIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return; // Lewati jika elemen tidak ada di halaman saat ini

    // Simpan nilai lama (biar kalau lagi milih gak keriset ke kosong)
    const currentVal = sel.value;
    
    let h = (id === 'filterType') ? '<option value=""> Semua Tipe</option>' : '<option value="">-- Pilih Tipe Aset --</option>';
    
    if (types && types.length > 0) {
      types.forEach(t => {
        h += `<option value="${t}">${t}</option>`;
      });
    }
    sel.innerHTML = h;
    
    // Balikin nilai lama kalau ada
    if (currentVal) sel.value = currentVal;
  });
}
*/



/**==================================================================================================================
 * [FUNGSI CLIENT GITHUB: LOAD DATA ASET SPESIFIK]
 * Menarik data dari sheet tertentu sesuai type_asset yg juga nama sheet nya, lalu memanggil mesin render untuk menampilkan di tabel aset.
 * ====================================================================================================================
 */
async function loadAssetData(sheetName_val) {
  let data; // Siapkan variabel penampung
  let sheetName; // Variabel untuk nama sheet yang akan dipakai di render
  const tbody = document.getElementById('assetBody');

  if (!sheetName_val) {
    // 1. Jika value kosong, ambil SEMUA asset dari SEMUA sheet (Array 2D)
    // Mengambil data dan meratakannya
    let dataRaw = Object.values(window.APP_STORE.assets).flat(1);

    // Filter: Hanya simpan baris yang kolom pertamanya BUKAN 'ID_Asset'
     //data = dataRaw.filter(row => row[0] !== 'ID_Asset');
     data = dataRaw.filter((row, index) => {
      // Jika ini baris pertama (index 0), JANGAN dihapus (return true)
      if (index === 0) return true;
      
      // Untuk baris selanjutnya, hapus jika kolom pertamanya adalah 'ID_Asset'
      return row[0] !== 'ID_Asset';
    });

    sheetName = sheetName_val; //lempar value selector sheetName

  } else {
    // 2. Jika ada value, cari nama sheet yang sesuai di Reference
    const sheetRef = getRef("Type_Asset").slice(1);
    const sheetRow = sheetRef.find(row => row[0] === sheetName_val);
    
    if (sheetRow) {
      sheetName = sheetRow[1];
      data = getAsset(sheetName);
    } else {
      data = []; // Jaga-jaga jika ID tidak ditemukan
    }
  }
   const masterCheck = document.getElementById('checkAllAsset');


try {
  // 3. Eksekusi pengecekan data
  //console.table(data);
  //console.log("Jumlah data yang diambil:", data.length);
  if (!data || data.length === 0) {
    if (tbody) tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>📭 Data Kosong</td></tr>";    
    return;
  }
   
    // Reset checkbox master jika ada
    if (masterCheck) masterCheck.checked = false; 

    // 2. PANGGIL MESIN RENDER INCREMENTAL ANDA
    renderAssetTableIncremental(sheetName, data);

  } catch (err) {
    console.error("Gagal load data aset:", err);
    if (tbody) tbody.innerHTML  = "<tr><td colspan='4' style='text-align:center; color:red;'>⚠️ Gagal terhubung ke database aset.</td></tr>";
  }
}


/**=========================================================================
 * [FUNGSI: RENDER TABEL INCREMENTAL + INTEGRASI CHECK ALL]
 * Mesin render khusus untuk halaman Lihat Aset dengan checkbox, terintegrasi dengan fungsi toggleAllAssets untuk fitur Check All.
 * Fokus pada efisiensi update baris dan sinkronisasi checkbox dengan data yang diambil dari server.
 * Data diambil langsung dari index yang sesuai (sesuai struktur data aset) dan disesuaikan dengan logika status warna yang sudah kita buat sebelumnya.
 * Logika warna status (Baik, Rusak, Perlu Perbaikan) diambil dari kolom 4 (Index 3) dan ditampilkan sebagai badge di bawah nama aset.
 * Setiap checkbox memiliki class 'asetCheck' untuk memudahkan fungsi toggleAllAssets dalam mengontrol semua checkbox sekaligus.
 * Penting: Pastikan struktur data yang dikirim dari server sesuai dengan yang diharapkan (misal: nama di index 0, kondisi di index 4, dll) agar render berjalan dengan benar.
 *==========================================================================
 */
function renderAssetTableIncremental(sheetPass, data) {
  const tbody = document.getElementById('assetBody');
  const masterCheck = document.getElementById('checkAllAsset');
  let sheetName = ""; // Variabel untuk menyimpan nama sheet yang akan dipakai di render
  const typeRefs = getRef("Type_Asset").slice(1); 
  // A. RESET CHECKBOX HEADER (Penting agar tidak nyangkut saat ganti Tipe Aset)
  if (masterCheck) masterCheck.checked = false;
  // jika sheetPass  kosong artinya  data header suda dipotong, jadi nadk perlu dipotong lagi.
// if (sheetPass !== "") {
    const newDataLength = data.length - 1;
//  } else {
 //  const newDataLength = data.length;
// }  

  for (let i = 1; i < data.length; i++) {
    const rowData = data[i];
    const rowIdx = i - 1;
    // cek jika sheetpass =""
    // JIKA sheetPass kosong (Mode Gabungan/All Assets)
    if (!sheetPass) {
      // Ambil huruf pertama dari ID Asset (misal 'a' dari 'a.001')
      const firstLetter = (rowData[0] || "").charAt(0).toLowerCase();
      
      // Cari di Type_Asset mana yang kodenya cocok
      const match = typeRefs.find(ref => ref[0].toLowerCase() === firstLetter);
      sheetName = match ? match[1] : "Unknown"; 
    
    } else {
      sheetName = sheetPass;
    }
    // 1. Ambil data dan paksa jadi huruf kecil + buang spasi ghaib
    const status = (rowData[4] || "").toLowerCase().trim();
    // 2. Mapping Warna (Definisikan 4 kondisimu di sini)
    const colors = {
      "baik":      "#27ae60", // Hijau
      "rusak":     "#e74c3c", // Merah (Saran: Rusak biasanya merah, bukan biru)
      "treatment": "#f39c12", // Oranye
      "baru":      "#2980b9"  // Biru
    };
    // 3. Tentukan warna (Default ke abu-abu jika status tidak dikenal)
    let badgeColor = colors[status] || "#7f8c8d";

    // B. PASTIKAN CLASS SAMA (Gunakan 'assetCheck' sesuai fungsi toggle kita)
    const rowHtml = `
      <td style="padding:5px; text-align:center;"><input type="checkbox" class="asetCheck" value="${i+1}"></td>
      <td style="padding:5px; font-weight:bold;"> ${rowData[0]} <br>${rowData[2]}<br></td>
      <td style="padding:5px;"> ${rowData[3]} </td>      
      <td style="padding:5px;">
        <button onclick="openAssetDetail('${sheetName}', ${i+1})" style="background:${badgeColor}; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">
          <i class="fas fa-eye"></i> 
          Detil
          <span style="background:${badgeColor}; color:white;">${rowData[4]}</span>
        </button>
      </td>`;

    if (tbody.rows[rowIdx]) {
      if (tbody.rows[rowIdx].innerHTML !== rowHtml) {
        tbody.rows[rowIdx].innerHTML = rowHtml;
      }
    } else {
      const newRow = tbody.insertRow();
      newRow.innerHTML = rowHtml;
    }
  }

  while (tbody.rows.length > newDataLength) {
    tbody.deleteRow(newDataLength);
  }
}

/**=========================================================================
 * [FUNGSI: TOGGLE CHECK ALL ASSET]
 * Mengontrol semua checkbox aset dengan satu klik pada checkbox master.
 * Setiap checkbox aset memiliki class 'asetCheck' untuk memudahkan seleksi.
 * Saat master dicentang, semua checkbox aset akan dicentang dan barisnya diberi efek warna (misal: #fff9e6 untuk highlight). Saat master tidak dicentang, semua checkbox aset akan dilepas centangnya dan efek warna dihapus.
 * Pastikan fungsi ini dipanggil setiap kali data aset di-render ulang agar tetap sinkron dengan checkbox yang ada.
 *==========================================================================
 */
function toggleAllAssets() {
  const master = document.getElementById('checkAllAsset');
  const items = document.querySelectorAll('.asetCheck');
  
  items.forEach(cb => {
    cb.checked = master.checked;
    // Beri efek warna pada baris yang dicentang
    const row = cb.closest('tr');
    if (row) {
      row.style.backgroundColor = master.checked ? "#fff9e6" : "";
    }
  });
}


/**=========================================================================
 * [FUNGSI: UPDATE GAMBAR QR]
 * =========================================================================
*/
async function updateQRCode(type, id) {
  // 1. Sanitasi: Ambil bagian pertama saja jika ada tanda "-" (Mencegah Tipe-ID-Tipe-ID)
  let cleanType = type.split('-')[0].trim();
  let cleanId = id.toString().split('-')[0].trim();
  
  // 2. Bentuk string QR yang baku
  const code = cleanType + "-" + cleanId;
  
  // 3. Format URL API stabil Anda
  //const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?data=" + encodeURIComponent(code) + "&size=150x150";
  
  const imgQr = document.getElementById('assetQRCode');  
  const txtQr = document.getElementById('qrText');
  const qrBase64M =  await generateCustomQR(code);
  
 //if (imgQr) imgQr.src = qrUrl;
  if (imgQr) imgQr.src = "data:image/png;base64," + qrBase64M;
  if (txtQr) txtQr.innerText = code;
  
  console.log("✅ QR Clean Generated: " + code);
}



async function openAddAssetModal() {
  // 1. Ambil Tipe Aset yang dipilih
  const type = document.getElementById('assetTypeSelect')?.value || "";

  if (!type) {
    return Swal.fire({
      title: "Pilih Tipe!",
      text: "Pilih Tipe Aset dulu bos!",
      icon: "warning",
      width: '80%',
      background: "#0f172a", color: "#fff"
    });
  }

  try {
    // 2. LOGIKA HITUNG ID DARI RAM (window.APP_STORE)
    // Ambil data sheet sesuai tipe (misal: 'a', 'b', dst)
    const sheetData = window.APP_STORE.assets[type];
    let nextId = "";

    if (sheetData && sheetData.length > 1) {
      // Ambil baris terakhir, kolom pertama (ID_Asset)
      const lastRow = sheetData[sheetData.length - 1];
      const lastId = lastRow[0].toString(); // Contoh: "a.055"
      
      // Pecah ID: "a.055" -> ["a", "055"]
      const parts = lastId.split('.');
      const prefix = parts[0];
      const lastNum = parseInt(parts[1]); // Jadi 55
      
      // Tambah 1 dan kembalikan format 3 digit: "a.056"
      const nextNum = (lastNum + 1).toString().padStart(3, '0');
      nextId = `${prefix}.${nextNum}`;
    } else {
      // Jika sheet masih kosong (hanya header), mulai dari 001
      nextId = `${type}.001`;
    }

    // 3. RESET FORM
    document.getElementById('assetRowIdx').value = ""; 
    window.assetImages = [];    
    window.currentImgIdx = 0;   
    
    const imgEl = document.getElementById('currAssetImg');
    if (imgEl) {
      imgEl.src = "https://lh3.googleusercontent.com"; 
      imgEl.style.opacity = "1";
    }
    
    // 4. ISI DATA OTOMATIS
    document.getElementById('as_type').value = type;
    document.getElementById('as_id').value = nextId;
    document.getElementById('as_nama').value = "";
    document.getElementById('as_lokasi').value = "";
    document.getElementById('as_status').value = "Baik";    

    // 5. UPDATE QR & TAMPILKAN MODAL
    if (typeof updateQRCode === 'function') updateQRCode(type, nextId);
    document.getElementById('assetDetailModal').style.display = 'flex';

    console.log("✅ ID Baru Berhasil Dihitung dari RAM: " + nextId);

  } catch (err) {
    console.error("Gagal hitung ID di RAM:", err);
    Swal.fire("Error", "Gagal menghitung ID otomatis.", "error");
  }
}



/** =========================================================================
 * Fungsi Tambahan: Centang Semua 
 *  =========================================================================
 */
function toggleSelectAset(master) {
  document.querySelectorAll('.asetCheck').forEach(cb => cb.checked = master.checked);
}



/**=========================================================================
 * [FUNGSI CLIENT GITHUB: LOAD TABEL LIHAT ASET - READ ONLY]
 * Menarik data aset spesifik via Fetch GET untuk mode tampilan saja.
 * Menggunakan action getSpecificAsset dengan parameter sheetName untuk mengambil data dari server, lalu memanggil mesin render khusus untuk mode view aset yang sudah kita buat sebelumnya.
 * Fokus pada penyajian data yang bersih dan efisien untuk mode tampilan saja (Read-Only), tanpa checkbox atau fitur edit.
 * Setiap baris memiliki tombol "Lihat Detail" yang memanggil fungsi openAssetDetailView dengan parameter sheetName dan row index untuk menampilkan detail aset di modal.
 * ==========================================================================
 */
async function loadAssetDataView(sheetName_val) {
  let data; // Siapkan variabel penampung
  let sheetName; // Variabel untuk nama sheet yang akan dipakai di render
  const tbody = document.getElementById('viewAssetBody');
  
    if (!sheetName_val) {
    // 1. Jika value kosong, ambil SEMUA asset dari SEMUA sheet (Array 2D)
    // Mengambil data dan meratakannya
    let dataRaw = Object.values(window.APP_STORE.assets).flat(1);

    // Filter: Hanya simpan baris yang kolom pertamanya BUKAN 'ID_Asset'
    data = dataRaw.filter((row, index) => {
      // Jika ini baris pertama (index 0), JANGAN dihapus (return true)
      if (index === 0) return true;      
      // Untuk baris selanjutnya, hapus jika kolom pertamanya adalah 'ID_Asset'
      return row[0] !== 'ID_Asset';
    });
    sheetName = sheetName_val; //lempar value selector sheetName
    
  } else {
    // 2. Jika ada value, cari nama sheet yang sesuai di Reference
    const sheetRef = getRef("Type_Asset").slice(1);
    const sheetRow = sheetRef.find(row => row[0] === sheetName_val);
    
    if (sheetRow) {
      sheetName = sheetRow[1];
      data = getAsset(sheetName);
    } else {
      data = []; // Jaga-jaga jika ID tidak ditemukan
    }
  }


  try {  
    //console.table(data);
    //console.log("Jumlah data yang diambil untuk view:", data.length);
  // 3. Eksekusi pengecekan data
    if (!data || data.length === 0) {

      if (tbody) tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>📭 Data Kosong</td></tr>";
      return;
    }

    // 2. PANGGIL MESIN RENDER KHUSUS VIEW (READ-ONLY)
    renderAssetTableIncrementalView(sheetName, data);

  } catch (err) {
    console.error("Gagal load data aset view:", err);
    if (tbody) tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:red;'>⚠️ Gagal memuat data aset.</td></tr>";
  }
}


/**=========================================================================
 * [FUNGSI: RENDER TABEL VIEW INCREMENTAL]
 * Mesin khusus untuk halaman Lihat Aset (Tanpa Checkbox).
 * Fokus pada efisiensi update baris dan penyajian data yang bersih untuk mode tampilan saja (Read-Only).
 * Setiap baris memiliki tombol "Lihat Detail" yang memanggil fungsi openAssetDetailView dengan parameter sheetName dan row index untuk menampilkan detail aset di modal.
 * Data diambil langsung dari index yang sesuai (sesuai struktur data aset) dan disesuaikan dengan logika status warna yang sudah kita buat sebelumnya.
 * Logika warna status (Baik, Rusak, Perlu Perbaikan) diambil dari kolom 4 (Index 3) dan ditampilkan sebagai badge di bawah nama aset.
 * Penting: Pastikan struktur data yang dikirim dari server sesuai dengan yang diharapkan agar render berjalan dengan benar.
 *==========================================================================
 */
function renderAssetTableIncrementalView(sheetPass, data) {
  const tbody = document.getElementById('viewAssetBody');
  const existingRows = tbody.rows;
  let sheetName = ""; // Variabel untuk menyimpan nama sheet yang akan dipakai di render
  const typeRefs = getRef("Type_Asset").slice(1); 
    // jika sheetPass  kosong artinya  data header suda dipotong, jadi nadk perlu dipotong lagi.
  //if (sheetPass !== "") {
      const newDataLength = data.length - 1;
   // } else {
   // const newDataLength = data.length;
 // }  


  for (let i = 1; i < data.length; i++) {
    const rowData = data[i];
    const rowIdx = i - 1;
       // cek jika sheetpass =""
    // JIKA sheetPass kosong (Mode Gabungan/All Assets)
    if (!sheetPass) {
      // Ambil huruf pertama dari ID Asset (misal 'a' dari 'a.001')
      const firstLetter = (rowData[0] || "").charAt(0).toLowerCase();
      
      // Cari di Type_Asset mana yang kodenya cocok
      const match = typeRefs.find(ref => ref[0].toLowerCase() === firstLetter);
      sheetName = match ? match[1] : "Unknown"; 
    
    } else {
      sheetName = sheetPass;
    }
    // 1. Ambil data dan paksa jadi huruf kecil + buang spasi ghaib
    const status = (rowData[4] || "").toLowerCase().trim();
    // 2. Mapping Warna (Definisikan 4 kondisimu di sini)
    const colors = {
      "baik":      "#27ae60", // Hijau
      "rusak":     "#e74c3c", // Merah (Saran: Rusak biasanya merah, bukan biru)
      "treatment": "#f39c12", // Oranye
      "baru":      "#2980b9"  // Biru
    };
    // 3. Tentukan warna (Default ke abu-abu jika status tidak dikenal)
    let badgeColor = colors[status] || "#7f8c8d";
    // Template baris tanpa checkbox, tombol manggil openAssetDetailView
    const rowHtml = `
      <td>${rowData[0]}</td><td>${rowData[2]}</td><td>${rowData[3]}</td>
      <td>
        <button onclick="openAssetDetailView('${sheetName}', ${i+1})" style="background:${badgeColor}; color:white; border:none; padding:5px; border-radius:3px; cursor:pointer;">
          <i class="fas fa-search"></i> 
          Lihat
          <span style="background:${badgeColor}; color:white;">${rowData[4]}</span>
        </button>
      </td>`;

    if (existingRows[rowIdx]) {
      if (existingRows[rowIdx].innerHTML !== rowHtml) {
        existingRows[rowIdx].innerHTML = rowHtml;
      }
    } else {
      const newRow = tbody.insertRow();
      newRow.innerHTML = rowHtml;
    }
  }

  while (tbody.rows.length > newDataLength) {
    tbody.deleteRow(newDataLength);
  }
}




/**=========================================================================
 * [FUNGSI PEMBANTU: RENDER DROPDOWN LIHAT ASET]
 * Menerima array tipe aset dan mengisi dropdown filter di tab Lihat Aset.
 * Setiap opsi dropdown akan memiliki value yang sesuai dengan tipe aset untuk memudahkan filtering saat user memilih.
 * Pastikan fungsi ini dipanggil dengan data yang benar (array tipe aset) agar dropdown terisi dengan benar.
 * ==========================================================================
 */
/*
function renderViewDropdown(types) {
  const sel = document.getElementById('viewAssetTypeSelect');
  let h = '<option value="">-- Pilih  --</option>';
  types.forEach(t => h += `<option value="${t}">${t}</option>`);
  sel.innerHTML = h;
}
*/


/**
 * [FUNGSI UTAMA: BUKA MODAL DETIL ASET]
 * Dipakai oleh Admin (Edit) maupun User (Lihat).
 * Kita tambahkan Reset UI di awal agar tidak ada tombol yang "ketinggalan" hidden.
 */
/**
 * [FUNGSI UTAMA: BUKA MODAL DETIL ASET - VERSI GET]
 */
async function openAssetDetail(sheetName, row) {
  // --- 1. RESET & PERSIAPAN UI ---
  const btnSave = document.getElementById('btnSaveAsset');
  const btnBatal = document.getElementById('btnCancelAsset');
  const actionArea = document.getElementById('assetActionArea');
  const btnTake = document.querySelector("button[onclick='takeAssetPhoto()']");
  const modal = document.getElementById('assetDetailModal');

  //console.log("nama sheet atau type_asset pada openDAssetDetail :", sheetName);
  //console.log("nama sheet atau row pada openDAssetDetail :", row);

  // Munculkan elemen yang mungkin tersembunyi
  if (btnSave) btnSave.style.display = "block";
  if (btnTake && btnTake.parentElement) btnTake.parentElement.style.display = "flex";
  if (actionArea) actionArea.style.gridTemplateColumns = "1fr 1fr";
  
  if (btnBatal) {
    btnBatal.style.width = "";
    btnBatal.style.gridColumn = "auto";
    btnBatal.innerHTML = '<i class="fas fa-times"></i> BATAL/KELUAR';
  }

  // Buka kunci input (Editable mode)
  document.getElementById('as_nama').readOnly = false;
  document.getElementById('as_lokasi').readOnly = false;
  document.getElementById('as_status').disabled = false;

  // Set ID baris ke hidden input agar tahu baris mana yang akan di-update nanti
  document.getElementById('assetRowIdx').value = row;
  document.getElementById('as_type').value = sheetName;

  // --- 2. AMBIL DATA DARI DATABASE (GOOGLE APPS SCRIPT) ---
  // Pastikan variabel global APPSCRIPT_URL sudah ada
  //if (typeof APPSCRIPT_URL === 'undefined' || !APPSCRIPT_URL) {
  //    return alert("Error: URL Script (GAS) tidak ditemukan!");
  //}

  // Kita tidak perlu baseUrl dari iframe lagi, langsung pakai variabel global
  //const urlGAS = APPSCRIPT_URL;
  
  // Susun Query Parameter untuk doGet
  //const params = new URLSearchParams({
  //  action: 'getSingleAssetData',
  //  sheetName: sheetName,
  //  row: row
  //});

  //const finalUrl = `${urlGAS}?${params.toString()}`;
  //console.log("Fetching Data (GET):", finalUrl);

  // Indikator loading pada input nama
  const inputNama = document.getElementById('as_nama');
  const originalPlaceholder = inputNama.placeholder;
  inputNama.value = "Memuat data...";

  try {
    //const response = await fetch(finalUrl);
    
    //if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

    const data = getAsset(sheetName)[row-1];
    //console.log("Data aset untuk view:", data);
    //console.log('namasheet :', sheetName);
    //const data = await response.json();
    //console.log("table data di openassetdetai: ");
    //console.table(data);

    // Cek jika data kosong atau ada error dari server
    if (!data || data.length === 0 || data.error) {
      throw new Error(data.error || "Data tidak ditemukan di database.");
    }

    // --- 3. MAPPING DATA KE FORM ---
    // Sesuai urutan kolom Spreadsheet: A=0(ID), B=1(Tipe), C=2(Nama), D=3(Lokasi), E=4(Status), F=5(Foto)
    document.getElementById('as_id').value     = data[0] || ""; 
    document.getElementById('as_nama').value   = data[2] || "";   
    document.getElementById('as_lokasi').value = data[3] || ""; 
    document.getElementById('as_status').value = data[4] || "Baik";

    // Mapping Foto (Kolom F / Index 5)
    const photoString = data[5] ? data[5].toString() : ""; 
    // assetImages adalah variabel global untuk slider
    assetImages = photoString.split(",").map(s => s.trim()).filter(s => s !== "");
    currentImgIdx = 0;
    
    // Update Slider & QR Code (Jika fungsi tersedia)
    if (typeof updateImageSlider === 'function') updateImageSlider();
    if (typeof updateQRCode === 'function') {
      // data[0] adalah ID Aset untuk generate QR
      updateQRCode(sheetName, data[0]);
    }

    // Tampilkan Modal setelah semua data siap
    if (modal) modal.style.display = 'flex';

  } catch (err) {
    console.error("Gagal Memuat Detail Aset:", err);
    alert("⚠️ Error: " + err.message);
    inputNama.value = "";
    inputNama.placeholder = originalPlaceholder;
  }
}



/**=========================================================================
 * [FUNGSI: LIHAT ASET DETIL - MODE VIEW ONLY]
 * Kita balik logikanya: Panggil detil dulu, baru timpa dengan mode Read-Only.
 * Tujuannya agar fungsi openAssetDetail tetap berjalan normal (mengisi data, render foto, dll), baru setelah itu kita "Sikat" semua input dan tombol untuk memastikan benar-benar tidak bisa diedit.
 * Dengan cara ini, kita meminimalisir risiko bug atau data yang tidak terisi dengan benar karena mode view hanya merubah state tampilan setelah data sudah dimuat.
 * Pastikan fungsi openAssetDetail sudah benar-benar berjalan dan mengisi semua data sebelum kita kunci inputnya, jadi kita beri sedikit jeda (setTimeout) untuk memastikan urutan eksekusi yang benar.
 *==========================================================================
 */
function openAssetDetailView(sheetName, row) {
  // 1. Jalankan fungsi load data utama dulu
  openAssetDetail(sheetName, row);

  // 2. Gunakan sedikit jeda (100ms) agar fungsi utama selesai merender, 
  // baru kemudian kita "Sikat" tombol-tombolnya untuk mode View
  setTimeout(function() {
    console.log("🔒 Mengaktifkan Mode Read-Only...");

    // Kunci Input
    document.getElementById('as_nama').readOnly = true;
    document.getElementById('as_lokasi').readOnly = true;
    document.getElementById('as_status').disabled = true;
    
    const btnSave = document.getElementById('btnSaveAsset');
    const btnBatal = document.getElementById('btnCancelAsset');
    const actionArea = document.getElementById('assetActionArea');
    const btnTake = document.querySelector("button[onclick='takeAssetPhoto()']");

    // Sembunyikan Simpan & Baris Foto
    if (btnSave) btnSave.style.display = "none"; 
    if (btnTake && btnTake.parentElement) {
      btnTake.parentElement.style.display = "none"; 
    }

    // Buat Batal jadi Full Width
    if (actionArea) actionArea.style.gridTemplateColumns = "1fr";
    if (btnBatal) {
      btnBatal.style.width = "100%";
      btnBatal.innerHTML = '<i class="fas fa-times"></i> KELUAR';
    }

    // Visual Galeri Read-Only
    const gallery = document.getElementById('as_gallery_box');
    if (gallery) {
      gallery.style.opacity = "1"; 
      gallery.style.pointerEvents = "auto";
      const label = gallery.querySelector('label');
      if (label) label.innerText = "DOKUMENTASI FOTO (VIEW ONLY)";
    }
  }, 2000); // 200ms cukup untuk memastikan openAssetDetail sudah jalan
}


/**=========================================================================
 * [FUNGSI: AMBIL FOTO ASET]
 * Membuka dialog file untuk memilih foto, menyimpan file asli di laci sementara, dan menampilkan pratinjau instan di slider.
 * Logika kuota foto: Cek jumlah foto yang sudah ada di assetImages (yang tampil di slider) sebelum membuka dialog. Jika sudah mencapai mAX_IMG, tampilkan alert dan hentikan proses.
 * Saat user memilih foto, kita simpan file aslinya di temp_Asset_Files untuk nanti diupload ke Drive saat simpan, dan kita buat URL pratinjau untuk langsung ditampilkan di slider dengan menambahkannya ke assetImages. Setelah itu, kita update slider agar user bisa langsung melihat foto yang baru saja dipilih.
 * Pastikan fungsi updateImageSlider sudah benar-benar menggunakan assetImages untuk menampilkan foto di slider agar perubahan langsung terlihat saat user memilih foto baru.
 *==========================================================================
 */
function takeAssetPhoto() {
  // Cek kuota laci
  if (temp_Asset_Files.length >= mAX_IMG) { Swal.fire({title: "Maksimal!",text: "Maksimal " + mAX_IMG + " foto saja!",icon: "warning", confirmButtonText: "OK", width: '80%' });
        return; // Berhenti di sini, tidak lanjut ke proses simpan
     }
  // Buka dialog file dan kedepan menggunakan kamera jika memungkinkan (fitur ini lebih optimal di mobile)
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  
  input.onchange = function() {
    const file = this.files[0];
    if (!file) return;

    // 1. Simpan file asli ke Laci
    temp_Asset_Files.push(file);

    // 2. Buat pratinjau instan untuk Slider
    const pratinjauUrl = URL.createObjectURL(file);
    
    // Kita masukkan ke array assetImages (yang dipakai slider)
    // agar user bisa langsung melihat foto yang baru saja dipilih
    assetImages.push(pratinjauUrl);
    currentImgIdx = assetImages.length - 1; // Geser ke foto terbaru
    
    updateImageSlider();
    console.log("Foto ditambahkan ke laci. Total: " + temp_Asset_Files.length);
  };

  input.click();
}



/**=========================================================================
 * [FUNGSI CLIENT GITHUB: SAVE ASSET EDIT & QR]
 * Mengirim data aset, QR Code, dan foto massal via Fetch POST
 * =========================================================================
 */
async function saveAssetEdit() {
  const asId = document.getElementById('as_id').value;
  const type = document.getElementById('as_type').value;
  const row = document.getElementById('assetRowIdx').value;
  const btn = document.getElementById('btnSaveAsset');

  // 1. VALIDASI INPUT
  if (!asId) { 
    await Swal.fire({ title: "Input Kosong!", text: "ID Aset tidak boleh kosong!", icon: "warning", width: '80%', background: "#0f172a", color: "#fff" });
    return; 
  }

  // 2. PERSIAPAN UI & QR
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Menyiapkan QR...";
  }

  // Generate QR Teks
  const qrTeksMurni = await generateCustomQR(type + "-" + asId); 
  const qrBlob = {
    base64: qrTeksMurni,
    mimeType: "image/png"
  };

  // 3. SUSUN DATA DASAR (Akan diolah server ke Spreadsheet)
  const dataArray = [
    asId, 
    "", // Link QR (diisi server)
    document.getElementById('as_nama').value,
    document.getElementById('as_lokasi').value,
    document.getElementById('as_status').value
  ];

  // 4. SUSUN PAYLOAD UTAMA
  let assetPayload = {
    asId: asId,
    type: type,
    row: row,
    qrBase64: qrBlob ? qrBlob.base64 : null,
    allFiles: [] 
  };

  // 5. PROSES FOTO DARI LACI (temp_Asset_Files)
  if (window.temp_Asset_Files && window.temp_Asset_Files.length > 0) {
    if (btn) btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Memproses Foto...";
    try {
      const filePromises = window.temp_Asset_Files.map(file => getBase64(file));
      assetPayload.allFiles = await Promise.all(filePromises);
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "SIMPAN PERUBAHAN";
      }
      await Swal.fire({ title: "Gagal Memproses Foto", text: e.toString(), icon: "error", width: '80%', background: "#0f172a", color: "#fff" });
      return;
    }
  }

  // 6. TRANSMISI VIA panggilGAS (Interceptor Sakti)
  if (btn) btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Mengunggah...";

  try {
    // panggilGAS otomatis menyelipkan 'userData' (username & sessionId)
    const res = await panggilGAS("saveAssetEnterpriseWithQR", {
      payload: assetPayload,
      userData: dataArray // Kita kirim dataArray sebagai userData tambahan untuk di-inject ke sheet
    });

    if (res && res.status === "success") {
      await Swal.fire({
        title: "Sukses",
        text: res.data.msg || "Aset berhasil disimpan!",
        icon: "success",
        width: '80%',
        background: "#0f172a", color: "#fff"
      });

      // SYNC GITHUB & RAM
      await syncDataGhoib(); 

      window.temp_Asset_Files = []; 
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "SIMPAN PERUBAHAN";
      }
      
      if (typeof closeAssetModal === 'function') closeAssetModal();
      if (typeof loadAssetData === 'function') loadAssetData(type); 

    } else {
      throw new Error(res ? res.message : "Gagal diproses server.");
    }

  } catch (err) {
    console.error("Save Asset Error:", err);
    await Swal.fire({
      title: "Gagal",
      text: err.message,
      icon: "error",
      width: '80%',
      background: "#0f172a", color: "#fff"
    });
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "SIMPAN PERUBAHAN";
    }
  }
}


/**
 * [FUNGSI CLIENT GITHUB: HAPUS ASET MASSAL]
 * Menghapus banyak aset sekaligus dari Spreadsheet & Drive via Fetch POST
 */
async function doBulkDeleteAsset() {
  const type = document.getElementById('assetTypeSelect')?.value; 
  
  // 1. AMBIL PILIHAN (Checkbox .asetCheck)
  let selected = [];
  document.querySelectorAll('.asetCheck:checked').forEach(cb => {
    const val = parseInt(cb.value);
    if (!isNaN(val)) selected.push(val);
  });

  // 2. VALIDASI PILIHAN
  if (selected.length === 0) { 
    Swal.fire({ 
      title: "Pilih Dulu!", 
      text: "Pilih aset yang ingin dihapus!", 
      icon: "warning", 
      width: '80%',
      background: "#0f172a", color: "#fff"
    });
    return; 
  }
 
  // 3. KONFIRMASI GAHAR
  const konfirmasi = await Swal.fire({
    title: "Hapus Asset!",
    text: `⚠️ HAPUS ${selected.length} ASET? \n\nFolder foto dan QR di Drive juga akan dihapus.`,
    icon: "warning", 
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Ya, Hapus!",
    cancelButtonText: "Batal",
    width: '80%',
    background: "#0f172a", color: "#fff"
  });

  if (konfirmasi.isConfirmed) { 
      Swal.fire({
        title: 'Memproses Penghapusan...',
        text: 'Membersihkan database dan Drive, mohon tunggu...',
        allowOutsideClick: false,
        background: "#0f172a", color: "#fff",
        didOpen: () => { Swal.showLoading(); }
      });

      // 4. EKSEKUSI VIA panggilGAS (Interceptor Otomatis)
      try {
        const res = await panggilGAS("deleteSelectedAssets", {
          type: type,
          selected: selected
        });

        if (res && res.status === "success") {
          await Swal.fire({ 
            title: "Terhapus!", 
            text: res.data.msg || "Aset berhasil dibersihkan.", 
            icon: "success", 
            width: '80%',
            background: "#0f172a", color: "#fff"
          });
          
          // 5. SYNC GITHUB & RE-RENDER
          // Sangat krusial agar RAM lokal langsung bersih mengikuti data terbaru di GitHub
          await syncDataGhoib(); 
          
          if (typeof loadAssetData === 'function') loadAssetData(type);
          
          // Reset checkbox master
          const master = document.getElementById('checkAllAsset');
          if (master) master.checked = false;

        } else {
          throw new Error(res ? res.message : "Gagal menghapus di server.");
        }

      } catch (err) {
        console.error("Gagal hapus massal:", err);
        Swal.fire({
          title: "Gagal!", 
          text: err.message, 
          icon: "error", 
          width: '80%',
          background: "#0f172a", color: "#fff"
        });
      }
  }
}


async function bulkUpdateQR() {
  const type = document.getElementById('assetTypeSelect')?.value;
  let selected = [];
  
  // 1. AMBIL ASET YANG DICENTANG
  document.querySelectorAll('.asetCheck:checked').forEach(cb => {
    const row = cb.closest('tr');
    // Ambil ID Asset dari kolom kedua (index 1)
    const asId = row.cells[1].innerText.split('\n')[0].trim(); 
    selected.push({
      rowIdx: cb.value,
      asId: asId
    });
  });

  if (selected.length === 0) {
    return Swal.fire({ 
      title: "Pilih aset dulu!", 
      icon: "info", 
      width: '80%',
      background: "#0f172a", color: "#fff"
    });
  }

  // 2. KONFIRMASI
  const konfirmasi = await Swal.fire({
    title: "Update QR Massal",
    text: `Proses ${selected.length} aset sekaligus?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, Proses",
    width: '80%',
    background: "#0f172a", color: "#fff"
  });

  if (konfirmasi.isConfirmed) {
    Swal.fire({
      title: 'Menyiapkan Data...',
      html: '<b id="progress-text" style="color:#3498db;">Konversi QR: 0%</b>',
      allowOutsideClick: false,
      background: "#0f172a", color: "#fff",
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const progEl = document.getElementById('progress-text');
      if (progEl) progEl.innerText = "Memulai Konversi Paralel...";

      // 3. PROSES SEMUA QR SEKALIGUS (PARALEL)
      const promises = selected.map(async (item, index) => {
        const code = type + "-" + item.asId;
        
        // Panggil mesin lokal (Custom QR)
        const fullImageBase64 = await generateCustomQR(code);

        // Update progress UI secara real-time
        const progressVal = Math.round(((index + 1) / selected.length) * 100);
        if (progEl) progEl.innerText = `Konversi QR: ${progressVal}% (${index + 1}/${selected.length})`;

        return {
          asId: item.asId,
          row: item.rowIdx,
          qrBase64: fullImageBase64.split(',')[1] // Ambil data murni base64
        };
      });

      const bulkData = await Promise.all(promises);

      // 4. EKSEKUSI VIA panggilGAS (Interceptor Otomatis)
      if (progEl) progEl.innerText = "Mengirim ke Database (Server)...";

      const res = await panggilGAS("saveBulkQR_Optimized", {
        bulkData: bulkData,
        type: type
      });

      if (res && res.status === "success") {
        await Swal.fire({ 
          title: "Misión Cumplida!", 
          text: res.data.msg || "QR Berhasil Diperbarui.", 
          icon: "success", 
          width: '80%',
          background: "#0f172a", color: "#fff"
        });
        
        // 5. SINKRONISASI GITHUB & UI
        await syncDataGhoib(); 
        
        if (typeof loadAssetData === 'function') loadAssetData(type);
        
        // Reset checkbox master
        const master = document.getElementById('checkAllAsset');
        if (master) master.checked = false;

      } else {
        throw new Error(res ? res.message : "Gagal simpan di server");
      }

    } catch (err) {
      console.error("Gagal Bulk Update QR:", err);
      Swal.fire({ 
        title: "Error", 
        text: "Gagal memproses QR: " + err.toString(), 
        icon: "error",
        background: "#0f172a", color: "#fff"
      });
    }
  }
}


/**=========================================================================
 * HELPER: GENERATE QR BASE64 (Safe for CORS)**
 * [FUNGSI CLIENT: GENERATOR QR CUSTOM + LOGO PT-KSC]
 * Menghasilkan Base64 murni untuk dikirim ke GAS
 */
async function generateCustomQR(textCode, options = {}) {
    return new Promise((resolve, reject) => {
        // 1. Setting Default (Ambil dari options atau pakai standar)
        const w = options.width || 300;
        const h = options.height || 300;
        const logoUrl = options.logoUrl || "./assets/logo/PT-KSC.png";
        const labelColor = options.labelColor || "#1e293b";

        const tempDiv = document.createElement("div");
        
        // 2. Render QR Mentah (Pakai library QRCode.js)
        new QRCode(tempDiv, {
            text: textCode,
            width: w,
            height: h,
            colorDark: options.colorDark || "#000000",
            colorLight: options.colorLight || "#ffffff",
            correctLevel: QRCode.CorrectLevel.H // Wajib H biar logo gak ganggu scan
        });

        // Tunggu sebentar biar library selesai nggambar di canvas
        setTimeout(() => {
            const qrCanvas = tempDiv.querySelector('canvas');
            if (!qrCanvas) return reject("Gagal merender QR Lokal");

            // 3. Siapkan Canvas Akhir (Tambah area teks di bawah)
            const finalCanvas = document.createElement("canvas");
            const ctx = finalCanvas.getContext("2d");
            
            finalCanvas.width = w + 20;  // Padding kiri-kanan
            finalCanvas.height = h + 50; // Area teks bawah
            
            // Background Putih
            ctx.fillStyle = options.colorLight || "#ffffff";
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            
            // Gambar QR ke tengah
            ctx.drawImage(qrCanvas, 10, 10);
            
            // 4. Proses Logo & Teks
            const img = new Image();
            img.crossOrigin = "anonymous"; // Hindari error CORS jika logo dari URL luar
            img.src = logoUrl;
            
            img.onload = () => {
                const logoSize = w * 0.22; 
                const centerX = (finalCanvas.width / 2) - (logoSize / 2);
                const centerY = (10 + h / 2) - (logoSize / 2);
                
                // Safe Zone Putih di tengah logo
                ctx.fillStyle = options.colorLight || "#ffffff";
                ctx.fillRect(centerX - 2, centerY - 2, logoSize + 4, logoSize + 4);
                
                ctx.drawImage(img, centerX, centerY, logoSize, logoSize);
                finish();
            };

            img.onerror = () => {
                console.warn("⚠️ Logo gagal dimuat, lanjut tanpa logo.");
                finish();
            };

            function finish() {
                // Tambah Label Teks ID di bawah
                ctx.fillStyle = labelColor;
                ctx.font = "bold 16px Arial";
                ctx.textAlign = "center";
                ctx.fillText(textCode, finalCanvas.width / 2, finalCanvas.height - 15);
                
                // Kirim Base64 Murni (tanpa header data:image/png;base64,)
                const base64Raw = finalCanvas.toDataURL("image/png");
                resolve(base64Raw.split(',')[1]); 
            }
        }, 200); 
    });
} // <--- SEKARANG KURUNGNYA SUDAH PAS, SEÑOR!




function updateImageSlider() {
  const imgEl = document.getElementById('currAssetImg');
  if (!imgEl) return;

  // 1. Jika ada foto di array assetImages
  if (assetImages.length > 0 && assetImages[currentImgIdx]) {
    let rawUrl = assetImages[currentImgIdx].trim();

    // LOGIKA PERBAIKAN:
    if (rawUrl.startsWith("blob:")) {
      // JIKA BLOB: Langsung tampilkan tanpa timestamp agar tidak ERROR
      imgEl.src = rawUrl;
    } else {
      // JIKA DARI DRIVE (http/lh3): Tambahkan timestamp agar gambar selalu refresh
      // Pastikan membersihkan tanda tanya lama jika ada
      imgEl.src = rawUrl.split('?')[0] + "?t=" + Date.now();
    }
    
    imgEl.style.opacity = "1";
  } 
  // 2. Jika Kosong, gunakan URL Placeholder
  else {
    imgEl.src = "https://lh3.googleusercontent.com/d/13Q4RtDMmEMVvErifoZOa_yKiAACUpg7a=s1000";
    imgEl.style.opacity = "1";
  }
}



function nextAssetImg() {
  if (assetImages.length > 0) {
    currentImgIdx = (currentImgIdx + 1) % assetImages.length;
    updateImageSlider();
  }
}


function prevAssetImg() {
  if (assetImages.length > 0) {
    currentImgIdx = (currentImgIdx - 1 + assetImages.length) % assetImages.length;
    updateImageSlider();
  }
}

function closeAssetModal() {
  document.getElementById('assetDetailModal').style.display = 'none';

  const btnSave = document.getElementById('btnSaveAsset');
  const btnBatal = document.getElementById('btnCancelAsset');
  const actionArea = document.getElementById('assetActionArea');

  // Balikkan Grid ke 2 kolom (Admin Mode)
  if (actionArea) actionArea.style.gridTemplateColumns = "1fr 1fr";
  if (btnSave) btnSave.style.display = "block";
  if (btnBatal) {
    btnBatal.style.width = "";
    btnBatal.innerHTML = '<i class="fas fa-times"></i> BATAL/KELUAR';
  }

  // Balikkan input ke mode Edit
  document.getElementById('as_nama').readOnly = false;
  document.getElementById('as_lokasi').readOnly = false;
  document.getElementById('as_status').disabled = false;

  // --- BUKA/RESET KUNCI DI SINI ---
  const gallery = document.getElementById('as_gallery_box');
  if (gallery) {
    gallery.style.opacity = "1";
    gallery.style.pointerEvents = "auto";
    const label = gallery.querySelector('label');
    if (label) label.innerText = "KELOLA FOTO ASET";
  }
}


/**=========================================================================
 * [FUNGSI: LOAD USER LIST]
 * Mengambil data user dari server  dan menampilkannya di tabel dengan logika khusus untuk menangani data yang mungkin kosong atau tidak lengkap.
 *==========================================================================
 */
async function loadUserList() {
  const tbody = document.getElementById('userListBody');
  //const urlGAS = APPSCRIPT_URL;

  // Tampilkan loading sebentar
  if (tbody) tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'><i class='fas fa-spinner fa-spin'></i> Menghubungi Server...</td></tr>";

  try {
    // 1. Fetch ke doGet dengan action getAllUsers
    //const response = await fetch(`${urlGAS}?action=getAllUsers`);
    
    //if (!response.ok) throw new Error("Gagal terhubung ke server (Status: " + //response.status + ")");

    // 2. Ambil data JSON (Asumsi server mengembalikan array of array)
    //const data = await response.json();

    const data = getApp("Users").slice(1);
    //console.table(data);  

    // JIKA data ternyata masih String (akibat double stringify di server), 
    // maka kita paksa jadi Object/Array
    //if (typeof data === 'string') {
       // data = JSON.parse(data);
    //}

    

    if (!data || data.length <= 1) {
      tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Data terdeteksi kosong oleh sistem</td></tr>";
      return;
    }

    let html = "";
    // 3. Loop mulai i=1 untuk melewati header (A=0, B=1, C=2, G=6, H=7, I=8)
    for (let i = 1; i < data.length; i++) {
      let row = data[i];
      
      let username  = row[0] || "Unknown";
      let role      = (row[2] || "user").toLowerCase();
      let status    = (row[6] || "aktif").toLowerCase();
      let lastLogin = row[7] || "-";

      html += `
        <tr data-role="${role}">
          <td style="padding:5px;text-align: center;""><input type="checkbox" class="userCheck" value="${i + 1}"></td>
          <td style="padding:5px;">
            <b>${username}</b><br>
            <small style="color:#666;">${role.toUpperCase()}</small><br>
            <span style="color:${status === 'aktif' ? 'green' : 'red'}; font-weight:bold;">${status.toUpperCase()}</span>
          </td>
          <td style="padding:5px; font-size:10px;">${lastLogin}</td>
          <td style="padding:5px;">
            <button onclick="openEditModal(${i + 1})"
                    style="background:#2980b9; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:3px;">
              <i class="fa fa-address-card"></i> Edit
            </button>
          </td>
        </tr>`;
    }
    
    tbody.innerHTML = html;
    console.log("✅ User List berhasil diperbarui.");

  } catch (err) {
    console.error("Gagal total mengambil user list:", err);
    
    // Tampilan Error menggunakan Swal (Sesuai style kamu)
    Swal.fire({
      title: "Gagal",
      text: "Error: " + err.message,
      icon: "warning",
      confirmButtonText: "OK, Señor!",
      width: '80%'
    });

    if (tbody) tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:red;'>Gagal memuat data.</td></tr>";
  }
}



/**=========================================================================
 * [FUNGSI: BUKA MODAL EDIT USER]
 * Mengambil data user berdasarkan row index, lalu menampilkan di modal edit dengan logika khusus untuk menangani data yang mungkin kosong atau tidak lengkap.
 * = =========================================================================
 */  

async function openEditModal(row) {
  //const urlGAS = APPSCRIPT_URL;
  
  try {
    // 1. Ambil data user spesifik berdasarkan baris (row)
    const d = getApp("Users")[row];
    // Debugging data di console
    //console.table(d);
    // 1. TAMPILKAN MODAL DULU (Agar elemen di dalamnya "bangun")
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        throw new Error("Elemen 'editModal' tidak ditemukan di HTML!");
    }


    // 2. Isi Form Modal
    document.getElementById('m_row_idx').value = row;
    document.getElementById('m_user').value = d[0] || "";
    document.getElementById('m_pass').value = ""; // Kosongkan demi keamanan
    document.getElementById('m_phone').value = d[3] || "";
    document.getElementById('m_role').value = (d[2] || "user").toLowerCase();
    document.getElementById('m_email').value = d[4] || "";
    document.getElementById('m_status').value = (d[6] || "aktif").toLowerCase();
    document.getElementById('m_attempts').value = d[8] || 0;
    
    // --- 3. LOGIKA LOAD GAMBAR (PHOTO) ---
    const photoFromDB = d[5]; 
    const nameFromDB = d[0] || "User"; 
    const imgPreview = document.getElementById('admin_edit_photo');
    
    if (imgPreview) {
      if (photoFromDB && photoFromDB.includes("http")) {
        // Gunakan link Drive asli + anti-cache
        imgPreview.src = photoFromDB + (photoFromDB.includes("?") ? "&" : "?") + "t=" + Date.now();
      } else {
        // Perbaikan format URL UI-Avatars agar lebih rapi
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameFromDB)}&background=2980b9&color=fff&size=128`;
        imgPreview.src = avatarUrl;
      }
    }

    // 4. Tampilkan Modal
    //document.getElementById('editModal').style.display = 'flex';

  } catch (err) {
    console.error("Gagal load detail user:", err);
    Swal.fire({
      title: "Gagal",
      text: "Gagal memproses data: " + err.message,
      icon: "warning",
      confirmButtonText: "OK, Señor!",
      width: '80%'
    });
  }
}


/**=================================================================================================
 * [FUNGSI: BUKA MODAL UNTUK USER BARU]
 * Membersihkan field dan memuat placeholder Avatar.
 * ================================================================================================
 */
function openAddUserModal() {
  // Gunakan helper function sederhana agar kode lebih bersih
  const id = "modalMaint";
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = val;
    } else {
      console.warn(`⚠️ Señor, elemen dengan ID "${id}" tidak ditemukan di HTML!`);
    }
  };

  // 1. Reset Semua Input dengan Aman
  setVal('m_row_idx', ""); 
  setVal('m_user', "");
  setVal('m_pass', "");
  setVal('m_phone', "");
  setVal('m_email', "");
  setVal('m_role', "user");
  setVal('m_status', "aktif");
  setVal('m_attempts', 0);
  
  // 2. Update Foto Preview
  var imgPreview = document.getElementById('admin_edit_photo');
  if (imgPreview) {
    var defaultName = "New User";
    imgPreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultName)}&background=2980b9&color=fff&size=128`;
  }
  
  // 3. Tampilkan Modal
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.style.display = 'flex';
  } else {
    Swal.fire("Error UI", "Modal 'editModal' tidak ditemukan!", "error");
  }
}


/**
 * [FUNGSI CLIENT: BULK UPDATE STATUS USER]
 * Mengubah status Aktif/Non-Aktif banyak user sekaligus lewat RAM & API
 */
async function doBulkAction(status) {
  // 1. AMBIL DAFTAR BARIS (Contoh: [2, 5, 10])
  const selectedRows = getSelectedRows(); 
  
  if (selectedRows.length === 0) {
    return Swal.fire({ 
      title: "Pilih User", 
      text: "Centang user dulu, Señor!", 
      icon: "info",
      background: "#0f172a", color: "#fff"
    });
  }

  // 2. KONFIRMASI
  const confirm = await Swal.fire({
    title: `${status === "aktif" ? "Aktifkan" : "Non-aktifkan"} User`,
    text: `Ubah status ${selectedRows.length} user sekaligus?`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: status === "aktif" ? "#28a745" : "#d33",
    confirmButtonText: "Ya, Lanjutkan",
    background: "#0f172a", color: "#fff"
  });

  if (!confirm.isConfirmed) return;

  // 3. UI LOADING
  Swal.fire({ 
    title: 'Processing...', 
    text: 'Menyinkronkan status ke database...',
    allowOutsideClick: false, 
    didOpen: () => { Swal.showLoading(); },
    background: "#0f172a", color: "#fff"
  });

  try {
    // 4. SIAPKAN DATA BORONGAN
    // Kita buat daftar data yang mau diupdate agar server cuma kerja SEKALI
    const bulkPayload = selectedRows.map(rowIdx => {
      // Ambil data asli dari RAM (Users ada di window.APP_STORE.assets.Users atau .app.Users)
      // Pastikan path-nya benar sesuai struktur APP_STORE kamu
      let rowData = [...window.APP_STORE.assets["Users"][rowIdx - 1]]; 
      
      // Ubah Status di Kolom G (Index 6)
      rowData[6] = (status === "aktif") ? "Aktif" : "Nonaktif";
      
      return {
        id: rowIdx,
        data: rowData
      };
    });

    // 5. TEMBAK SEKALI SAAT (MENGGUNAKAN panggilGAS)
    // Gunakan action baru "bulkUpdateUsers" agar server memprosesnya efisien
    const res = await panggilGAS("bulkUpdateUsers", {
      sheetName: "Users",
      updates: bulkPayload
    });

    if (res && res.status === "success") {
      if (typeof speakSenor === 'function') speakSenor("Misión Cumplida! Status user diperbarui.");
      
      await Swal.fire({ 
        title: "Berhasil!", 
        text: `${selectedRows.length} User telah diperbarui.`, 
        icon: "success",
        background: "#0f172a", color: "#fff" 
      });
      
      // 6. SYNC DATA DARI GITHUB
      await syncDataGhoib(); 
      
      if (typeof loadUserList === 'function') loadUserList();

    } else {
      throw new Error(res ? res.message : "Gagal update massal.");
    }

  } catch (err) {
    console.error("Bulk Action Error:", err);
    if (typeof speakSenor === 'function') speakSenor("Gagal Señor, server sedang kewalahan.");
    Swal.fire({ 
      title: "Error!", 
      text: err.message, 
      icon: "error",
      background: "#0f172a", color: "#fff" 
    });
  }
}



function getSelectedRows() {
  let rows = [];
  document.querySelectorAll('.userCheck:checked').forEach(cb => rows.push(parseInt(cb.value)));
  return rows;
}

function toggleSelectAll() {
    let master = document.getElementById('selectAll');
    document.querySelectorAll('.userCheck').forEach(cb => cb.checked = master.checked);
}




/**=================================================================================================
 * [FUNGSI: LOAD USER PROFILE]
 * Menghapus baris di Spreadsheet dan file foto di Google Drive.
 * ===================================================================================================
 */
async function loadProf() {
  //const urlGAS = APPSCRIPT_URL;
  
  // Pastikan variabel 'loggedInUser' tersedia (biasanya dari session/global)
  if (!loggedInUser) {
    console.error("Username tidak ditemukan di sesi browser.");
    return;
  }

  try {
    const d = getApp("Users").slice(1).find(row=>String(row[0]).trim().toLowerCase()===String(loggedInUser).trim().toLowerCase())
    //console.table(d);
    // Struktur: [User, Pass, Role, Phone, Email, Photo, Status, LastLogin, Attempts]

    // 2. Mapping Data ke Input Profil
    document.getElementById('set_user').value = d[0] || "-";
    document.getElementById('set_role').value = (d[2] || "user").toUpperCase();
    document.getElementById('set_status').value = (d[6] || "aktif").toUpperCase();
    document.getElementById('set_attempts').value = (d[8] || 0) + " / 5";
    document.getElementById('set_email').value = d[4] || "";
    document.getElementById('set_phone').value = d[3] || "";
    
    // --- 3. LOGIKA ANTI-CACHE FOTO ---
    const photoUrl = d[5];
    const userName = d[0] || "User";
    let finalSrc = "";

    if (photoUrl && photoUrl.includes("http")) {
      // Tambahkan anti-cache agar foto terbaru langsung muncul
      const separator = photoUrl.includes("?") ? "&" : "?";
      finalSrc = photoUrl + separator + "t=" + new Date().getTime();
    } else {
      // Perbaikan URL UI-Avatars agar valid
      finalSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=2980b9&color=fff&size=128`;;
    }

    // Update semua elemen foto profil (Desktop, Shared, Mobile)
    const photoElements = ['set_display_photo', 'user_profile_shared', 'user_profile_mobile'];
    photoElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.src = finalSrc;
    });

  } catch (err) {
    console.error("Gagal load profil:", err);
    Swal.fire({
      title: "Gagal",
      text: "Gagal load profil: " + err.message,
      icon: "warning",
      confirmButtonText: "OK, Señor!",
      width: '80%'
    });
  }
}



async function saveProf() {
  const displayPhoto = document.getElementById('set_display_photo');
  const btn = document.getElementById('btnsaveprofile');
  const imgSidebar = document.getElementById('user_profile_shared');

  // 1. Susun Payload Utama (Intinya saja)
  let payload = {
    adminAktif: typeof loggedInUser !== 'undefined' ? loggedInUser : document.getElementById('set_user').value,
    username:   document.getElementById('set_user').value,
    phone:      document.getElementById('set_phone').value,
    email:      document.getElementById('set_email').value,
    pass:       document.getElementById('set_pass').value,
    photoData:  null,
    photoUrl:   displayPhoto.src.includes("blob:") ? "" : displayPhoto.src.split('?')[0]
  };

  // 2. Proses Foto jika ada di temp
  if (window.Temp_Profile && window.Temp_Profile[0]) {
    try {
      const file = window.Temp_Profile[0];
      const fileInfo = await getBase64(file); 
      payload.photoData = fileInfo.base64; 
      payload.mimeType  = fileInfo.mimeType;
      payload.fileName  = "Profile_" + payload.username; 
    } catch (e) {
      return Swal.fire({ title: "Gagal", text: "Proses foto: " + e.message, icon: "warning" });
    }
  }

  // 3. UI FEEDBACK (Loading)
  if (displayPhoto) displayPhoto.style.opacity = "0.3";
  if (imgSidebar) imgSidebar.style.opacity = "0.3";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Menyimpan...";
  }

  // 4. KIRIM KE SERVER VIA panggilGAS (Interceptor Sakti)
  try {
    // panggilGAS otomatis menambahkan p.userData {username, sessionId}
    const res = await panggilGAS("universalUpdateUser", payload);

    if (res && res.status === "success") {
      await Swal.fire({
        title: "¡Misión Cumplida!",
        text: res.data || "Profil berhasil diperbarui",
        icon: "success",
        confirmButtonText: "OK, Señor!",
        width: '80%'
      });

      // UPDATE RAM & UI
      await syncDataGhoib();
      window.Temp_Profile = [null, null]; 
      
      if (typeof loadProfile === 'function') loadProfile(); 
      if (typeof loadProf === 'function') loadProf(); 

    } else {
      throw new Error(res ? res.message : "Gagal menyimpan");
    }

  } catch (err) {
    console.error("Error Save Profile:", err);
    Swal.fire({
      title: "Gagal",
      text: err.message,
      icon: "error",
      width: '80%'
    });
    if (btn) btn.innerHTML = "<i class='fa fa-floppy-o'></i> COBA LAGI";
  } finally {
    if (displayPhoto) displayPhoto.style.opacity = "1";
    if (imgSidebar) imgSidebar.style.opacity = "1";
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "<i class='fa fa-floppy-o'></i> SIMPAN PERUBAHAN";
    }
  }
}



// --- 2. HELPER FUNCTION (Letakkan di sini agar bisa diakses semua fungsi) ---
const getBase64 = (file) => new Promise((resolve, reject) => {
  if (!file) return reject("Tidak ada file untuk diproses");
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve({
    // Kita ambil indeks [1] untuk membuang header "data:image/png;base64,"
    base64: reader.result.split(',')[1], 
    mimeType: file.type
  });
  reader.onerror = error => reject(error);
});
/**
 * [FUNGSI: UPLOAD FOTO PROFIL MANDIRI] =============================================================================================================================================
 * Memastikan opacity kembali ke 1 baik saat sukses maupun gagal.
 */
function uploadOwnPhoto(input) {
  const file =input.files[0];
  if (file) {
    // 1. Simpan file asli ke dalam array (untuk kebutuhan upload nanti)
    Temp_Profile[0] = file; 

    // 2. Buat URL sementara untuk pratinjau
    const pratinjauUrl = URL.createObjectURL(file);

    // 3. Tampilkan langsung di elemen <img> yang memicu fungsi ini
    // Catatan: Jika inputElemen adalah <input type="file">, 
    // kita perlu mencari elemen <img> yang terkait.
    document.getElementById("set_display_photo").src = pratinjauUrl;

    //console.log("File tersimpan sementara -name :", file.name);
    //console.log("File tersimpan sementara - temp profile :", Temp_Profile[0]);
  }

}

// Fungsi Pembantu untuk Payload (Update/Add)
async function preparePayload(rowValue, usernameValue) {
  let payload = {
    adminAktif: loggedInUser, // PIC yang bertanggung jawab
    roleAktor: userRole,      // Peran PIC saat ini
    row: rowValue,
    username: usernameValue,
    pass: document.getElementById('m_pass').value,
    role: document.getElementById('m_role').value,
    phone: document.getElementById('m_phone').value,
    email: document.getElementById('m_email').value,
    status: document.getElementById('m_status').value,
    photoUrl: document.getElementById('admin_edit_photo').src,
    photoData: null
  };

  // Cek jika ada foto baru
  if (Temp_Profile && Temp_Profile[1]) {
    const fileInfo = await getBase64(Temp_Profile[1]);
    payload.photoData = fileInfo.base64;
    payload.mimeType = fileInfo.mimeType;
  }
  return payload;
}

function uploadPhotoFromAdmin(input) {
  const file = input.files[0];
  
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
        Swal.fire({
          title: "File Gendut!",
          text: "File terlalu besar! Maksimal 2MB.", // Ini isi pesan 
          icon: "warning",
          confirmButtonText: "OK, Señor!",
          width: '80%' // Biar pas di layar HP Sultan
        });
    //alert("File terlalu besar! Maksimal 2MB.");
    input.value = "";
    return;
  }

  if (file) {    
    // Pastikan variabelnya ada sebelum diisi
    if (!Temp_Profile) Temp_Profile = [null, null];
    
    Temp_Profile[1] = file; // Simpan di indeks 1 sesuai kode Save Anda
    
    // Preview
    document.getElementById("admin_edit_photo").src = URL.createObjectURL(file);
  }
}



/**
 * [FUNGSI CLIENT: EKSPOR USER KE CSV - VERSI RAM WUZ!]
 * Membuat file CSV langsung dari memori tanpa ngetuk pintu Server.
 */
async function downloadCSV() {
  try {
    Swal.fire({ 
      title: 'Menyusun Laporan...', 
      text: 'Mengambil data dari RAM, Señor.',
      allowOutsideClick: false, 
      didOpen: () => Swal.showLoading(),
      background: "#0f172a", color: "#fff"
    });

    // 1. AMBIL DATA DARI RAM (Termasuk Header)
    const rawData = APP_STORE.app["Users"]; 

    if (!rawData || rawData.length === 0) {
      throw new Error("Gudang RAM Kosong! Silakan Sinkron Data dulu.");
    }

    // 2. LOGIKA PENYUSUNAN CSV (Cleaning & Mapping)
    const csvContent = rawData.map(row => {
      return row.map(cell => {
        // Bersihkan tanda petik agar tidak pecah di Excel
        let cleanCell = String(cell).replace(/"/g, '""'); 
        // Bungkus dengan petik ganda untuk menangani koma di dalam teks
        return `"${cleanCell}"`;
      }).join(",");
    }).join("\n");

    // 3. PROSES DOWNLOAD (BLOB)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    const tgl = new Date().toISOString().slice(0, 10); // Format YYYY-MM-DD
    
    link.href = url;
    link.download = `Data_User_MANTAP_${tgl}.csv`;
    
    // 4. TRIGGER & CLEANUP
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      Swal.close();
      speakSenor("Laporan User berhasil diekspor, Señor.");
      Swal.fire({ title: "Berhasil!", text: "File sudah masuk folder download.", icon: "success", timer: 2000 });
    }, 500);

  } catch (err) {
    console.error("Download Error:", err);
    Swal.fire({ title: "Gagal Download", text: err.message, icon: "error" });
  }
}
  
/**
 * [FUNGSI CLIENT: SAVE ADMIN EDIT - VERSI RAM-SYNC]
 * Menyimpan perubahan user (siapapun) dari panel Admin ke GAS & RAM.
 */
async function saveAdminEdit() {
  const rowIdx = document.getElementById('m_row_idx').value;
  const username = document.getElementById('m_user').value;
  const displayPhoto = document.getElementById('admin_edit_photo');

  // 1. VALIDASI AWAL
  if (!username) return Swal.fire("Peringatan", "Username harus diisi!", "warning");

  // 2. UI FEEDBACK & LOADING
  const btn = document.getElementById('saveprofilmodal');
  const preview = document.getElementById('admin_edit_photo');
  const imgSidebar = document.getElementById('user_profile_shared');
  
  const isSelf = (username.toLowerCase() === (typeof loggedInUser !== 'undefined' ? loggedInUser.toLowerCase() : ""));

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Menyimpan...";
  }
  if (preview) preview.style.opacity = "0.3";
  if (isSelf && imgSidebar) imgSidebar.style.opacity = "0.3";

  try {
    // 3. SUSUN PAYLOAD (Payload intinya saja)
    let payload = {
      adminAktif: typeof loggedInUser !== 'undefined' ? loggedInUser : "System", 
      row:      rowIdx, 
      username: username,
      pass:     document.getElementById('m_pass').value,
      role:     document.getElementById('m_role').value,
      phone:    document.getElementById('m_phone').value,
      email:    document.getElementById('m_email').value,
      status:   document.getElementById('m_status').value,
      attempts: document.getElementById('m_attempts').value || 0,
      photoUrl: (displayPhoto.src.includes("blob:") || displayPhoto.src.includes("ui-avatars.com")) ? "" : displayPhoto.src.split('?')[0],
      photoData: null,
      mimeType: "image/png",
      fileName: "Profile_" + username
    };

    // 4. PROSES FOTO BARU
    if (window.Temp_Profile && window.Temp_Profile[1]) {
      const fileInfo = await getBase64(window.Temp_Profile[1]);
      payload.photoData = fileInfo.base64;
      payload.mimeType = fileInfo.mimeType;
    }

    // 5. EKSEKUSI VIA panggilGAS (Interceptor Otomatis)
    const res = await panggilGAS("universalUpdateUser", payload);

    if (res && res.status === "success") {
      await Swal.fire({
        title: "¡Misión Cumplida!",
        text: res.data || "Data user berhasil diperbarui.",
        icon: "success",
        confirmButtonText: "OK, Señor!",
        width: '80%',
        background: "#0f172a", color: "#fff"
      });

      // 6. SYNC DATA GITHUB & RAM
      await syncDataGhoib(); 

      if (window.Temp_Profile) window.Temp_Profile[1] = null; 
      if (typeof closeModal === 'function') closeModal(); 
      if (typeof loadUserList === 'function') loadUserList(); 
      
      // Sinkronkan Foto Profil di Sidebar jika Edit Diri Sendiri
      if (isSelf) {
        const userBaru = findUserByName(username); 
        if (userBaru.status === "success") {
          const urlTerbaru = userBaru.data[5]; 
          if (typeof syncProfileUI === 'function') syncProfileUI(urlTerbaru, true);
        }
      }
    } else {
      throw new Error(res ? res.message : "Gagal diproses server.");
    }

  } catch (err) {
    console.error("Gagal simpan admin edit:", err);
    await Swal.fire({
      title: "Gagal!",
      text: "Terjadi kendala: " + err.message,
      icon: "error",
      confirmButtonText: "Coba Lagi",
      width: '80%',
      background: "#0f172a", color: "#fff"
    });
  } finally {
    if (preview) preview.style.opacity = "1";
    if (imgSidebar) imgSidebar.style.opacity = "1";
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "<i class='fa fa-floppy-o'></i> SIMPAN PERUBAHAN";
    }
  }
}


/**=============================================================================================
 * [FUNGSI: SAVE ADMIN EDIT]
 * SIMPAN USER SIAPAPUN KETIKA BERADA DI LOGIN ADMIN.
 * =============================================================================================
 */
function closeModal() {
  document.getElementById('editModal').style.display = 'none';
}