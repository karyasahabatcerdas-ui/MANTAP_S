// --- 1. KONFIGURASI & GUDANG DATA ---
//const GAS_URL = "https://script.google.com/macros/s/AKfycbwwJVU-AHjjg3Lhj_zDIVtDCfTWV114zbQMve87e6b6Rh_FQRzuwyVoiGZzd__slPbb/exec";
const GAS_URL = APPSCRIPT_URL; // Gunakan URL yang dibentuk dari APPSCRIPT_ID di index.html

window.APP_STORE = {
  app: {},
  assets: {},
  reference: {},
  maintenance: {},
  key: null,
  lastSync: null
};

// --- 2. FUNGSI SEDOT DATA (READ) ---
async function syncDataGhoib() {
  try {
    // Indikator Loading
    Swal.fire({ 
      title: 'Sinkronisasi Data...', 
      text: 'Menyedot 22 Sheet dari Server...',
      allowOutsideClick: false, 
      didOpen: () => Swal.showLoading() 
    });

    // Fetch ke doGet GAS
    const response = await fetch(`${GAS_URL}?action=getInitialData`);
    const res = await response.json();

    if (res.status !== "success") throw new Error(res.message);

    // BONGKAR GHOIB
    const decodedString = atob(res.blob); 
    const cleanData = JSON.parse(decodedString);

    // Masukkan ke RAM
    window.APP_STORE.app = cleanData.app;
    window.APP_STORE.assets = cleanData.assets;
    window.APP_STORE.reference = cleanData.reference;
    window.APP_STORE.maintenance = cleanData.maintenance;
    window.APP_STORE.lastSync = cleanData.timestamp;
    window.APP_STORE.key = res.key;

    sessionStorage.setItem('DATA_KSC_GHOIB', res.blob);
    
    // Isi Dropdown secara otomatis
    populateAllDropdowns();

    Swal.fire({ title: "Sukses!", text: "Data Sinkron.", icon: "success", timer: 1500 });
    console.log("✅ RAM Updated:", window.APP_STORE);

  } catch (err) {
    console.error("Gagal Sinkron:", err);
    Swal.fire("Error", err.message, "error");
  }
}

// --- 3. FUNGSI KIRIM DATA (WRITE) ---
async function kirimKeGAS(action, sheetName, id, dataRow = []) {
  const payload = { action, sheetName, id, data: dataRow };

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload) 
    });
    
    const hasil = await response.json();
    console.log("🚀 Respon GAS:", hasil);
    return hasil;
  } catch (err) {
    Swal.fire("Gagal Simpan", err.toString(), "error");
  }
}

// --- 4. HELPER (PENGAMBIL DATA RAM) ---
const getAsset = (name) => window.APP_STORE.assets[name] || [];
const getRef   = (name) => window.APP_STORE.reference[name] || [];
const getMaint = (name) => window.APP_STORE.maintenance[name] || [];
const getApp = (name) => window.APP_STORE.app[name] || [];

//------mapping untuk dropdown
const DROPDOWN_MAP = {
  'filterStatusLog':    'Status_Maint',
  'filterJadwalLog':    'ID_Jadwal',
  'sortJadwal':         'Filter_Tgl',
  'filterType':         'Type_Asset',
  'filterStateJadwal':  'ID_Jadwal',
  'assetTypeSelect':    'Type_Asset',
  'viewAssetTypeSelect':'Type_Asset',
  'jenis_id_jadwal':    'ID_Jadwal',
  'm_state':            'Status_Maint',
  'maint_id_jadwal':    'ID_Jadwal',
  'as_status':          'Status_Asset',
  'm_status':           'Status_Maint'
};
function populateAllDropdowns() {
  for (let id in DROPDOWN_MAP) {
    const el = document.getElementById(id);
    if (!el) continue; // Lewati kalau ID tidak ada di halaman ini

    const sheetName = DROPDOWN_MAP[id];
    const data = getRef(sheetName); // Ambil dari RAM

    if (data && data.length > 0) {
      let options = `<option value="">-- Pilih ${sheetName.replace('_', ' ')} --</option>`;
      
      // Lompati Header (Index 0)
      data.slice(1).forEach(row => {
        const val = row[0]; // Isian ID (Sistem)
        const lab = row[1] || row[0]; // Isian Text (Tampilan), kover kalau B kosong
        
        if (val !== undefined && val !== "") {
          options += `<option value="${val}">${lab}</option>`;
        }
      });
      
      el.innerHTML = options;
      console.log(`✅ ID: ${id} terisi dari ${sheetName}`);
    }
  }
}

/*
// --- 5. OTOMATISASI UI ---
function populateAllDropdowns() {
  const mapRef = {
    'maint_id_jadwal': 'ID_Jadwal',
    'assetTypeSelect': 'Type_Asset',
    'statusMaintSelect': 'Status_Maint',
    'statusAssetSelect': 'Status_Asset'
  };

  for (let id in mapRef) {
    const el = document.getElementById(id);
    if (!el) continue;
    
    const data = getRef(mapRef[id]);
    let options = `<option value="">-- Pilih ${mapRef[id]} --</option>`;
    
    data.slice(1).forEach(row => {
      options += `<option value="${row[0]}">${row[0]}</option>`;
    });
    el.innerHTML = options;
  }
}
  */

/**
 * FUNGSI SIMPAN: Kirim perubahan dari Form ke GAS
 */
async function updateAssetData(sheetName, assetId, updatedArray) {
  try {
    // 1. Indikator Loading
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // 2. Tembak ke doPost GAS (Pakai fungsi kirimKeGAS yang kita buat di awal)
    const res = await kirimKeGAS("update", sheetName, assetId, updatedArray);

    if (res.status === "success") {
      // 3. UPDATE RAM LOKAL (PENTING: Biar data di browser langsung berubah tanpa refresh)
      const rows = window.APP_STORE.assets[sheetName];
      const index = rows.findIndex(r => r[0].toString() === assetId.toString());
      if (index !== -1) window.APP_STORE.assets[sheetName][index] = updatedArray;

      Swal.fire("Tersimpan!", "Data di Spreadsheet & GitHub sudah sinkron.", "success");
      return true;
    } else {
      throw new Error(res.msg);
    }
  } catch (err) {
    Swal.fire("Gagal Simpan", err.message, "error");
    return false;
  }
}


async function tambahAset(sheetName, newRow) {
  const res = await kirimKeGAS("append", sheetName, null, newRow);
  if (res.status === "success") {
    // Sync RAM: Langsung push ke array sheet tersebut
    window.APP_STORE.assets[sheetName].push(newRow);
    console.log("✅ Unit Baru Masuk RAM & Server!");
  }
  return res;
}


async function hapusAset(sheetName, assetId) {
  const res = await kirimKeGAS("delete", sheetName, assetId);
  if (res.status === "success") {
    // Sync RAM: Filter keluar ID yang dihapus
    window.APP_STORE.assets[sheetName] = window.APP_STORE.assets[sheetName].filter(
      r => r[0].toString() !== assetId.toString()
    );
    console.log("🗑️ Unit Terhapus dari RAM & Server!");
  }
  return res;
}


/**
 * JEMBATAN SERVER: Namanya sama ama di GAS biar gak pusing
 * Cara pakai: const jam = await getServerTime();
 */
async function getServerTime(dateform = null) {
  try {
    // 1. Kalau ada parameter (Mode Formatter), kita olah di lokal aja biar cepet
    if (dateform) {
      const targetDate = new Date(dateform);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${pad(targetDate.getDate())}/${pad(targetDate.getMonth()+1)}/${targetDate.getFullYear()} ${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}:${pad(targetDate.getSeconds())}`;
    }

    // 2. Kalau GAK ADA parameter (Mode Real-time), baru nembak ke Google
    const resp = await fetch(`${GAS_URL}?action=getServerTime`);
    const res = await resp.json();
    return res.time;

  } catch (err) {
    console.error("Gagal ambil jam server, pakai jam lokal:", err);
    return new Date().toLocaleString('id-ID'); // Fallback biar gak error
  }
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
  
  console.log("🔍 Hasil Pencarian:", hasil);
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
    const rows = window.APP_STORE.assets[tipe] || [];
    
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
      console.error("Error fetch asset:", err);
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
    let statusLabel = "🚀 START";
    let statusColor = "#e67e22"; // Orange

    // Cek Kolom E (Index 4) buat SELESAI
    if (row[4] && row[4] !== "" && row[4] !== "-") { 
      statusLabel = "✅ SELESAI"; 
      statusColor = "#27ae60"; // Hijau
    } 
    // Cek Kolom D (Index 3) buat PENDING
    else if (row[3] && row[3] !== "" && row[3] !== "-") { 
      statusLabel = "⏳ PENDING"; 
      statusColor = "#f39c12"; // Kuning
    }

    tr.innerHTML = `
      <td style="padding:5px; vertical-align:middle;">
        <div style="font-weight:bold; color:#2c3e50; font-size:13px;">${row[0]}</div>
        <div style="font-size:10px; color:#95a5a6; margin-top:4px;">
          <i class="far fa-clock"></i> ${row[2] || "-"}
        </div>
      </td>
      <td style="padding:5px; vertical-align:middle;">
        <div style="font-size:11px; margin-bottom:4px;">
          <i class="fas fa-user-circle" style="color:#3498db;"></i> ${row[5] || "Unknown"}
        </div>
        <div style="padding:5px; vertical-align:middle;font-size:11px; margin-bottom:4px;">
          <i class="fas fa-tag" style="color:#9b59b6;"></i> ${row[6] || "-"}
        </div>
        <div style="padding:5px; font-size:10px; color:#7f8c8d;vertical-align:middle;">
          <i class="fas fa-calendar-alt"></i> JDW: ${row[7] || "-"}
        </div>
      </td>
      <td style="padding:5px;min-width:100px ;vertical-align:middle;">
        <button onclick="openDetailLog('${row[0]}')" 
                style="font-size:10px; height:40px; background: ${statusColor}; color:white; border:none; border-radius:8px; cursor:pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
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
    
    // 1. Ambil Nilai Filter dari UI GitHub
    const fType = document.getElementById('filterType')?.value || "";   
    const fState = document.getElementById('filterState')?.value || ""; 
    const sortBy = document.getElementById('sortJadwal')?.value || "";   
    const keyword = document.getElementById('cari_jadwal')?.value.toUpperCase() || "";

    try {
      // 2. Panggil Server (GET)
      //const response = await fetch(`${urlGAS}?action=getJadwal`);
      //const data = await response.json();

      const data = getMaint("Maintenance").slice(1).reverse(); //pengganti fungsi gas dilokal
      historyJadwal = data ;
      
      if (!data || data.length < 2) return;
      
      // Ambil data tanpa header (asumsi data[0] adalah header)
      let rawData = data.slice(1); 

      // 3. FILTERING (Logika tetap sama di Client)
      if (fType) rawData = rawData.filter(d => String(d[1]) === fType);
      if (fState) rawData = rawData.filter(d => String(d[9]) === fState);
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
      if (sortBy === 'newest') {
        rawData.sort((a, b) => toDate(b[7]) - toDate(a[7]));
      } 
      else if (sortBy === 'oldest') {
        rawData.sort((a, b) => toDate(a[7]) - toDate(b[7]));
      } 
      else if (sortBy === 'two_weeks_ahead') {
        const limitAhead = new Date();
        limitAhead.setDate(now.getDate() + 14);
        rawData = rawData.filter(d => {
          const dDate = toDate(d[7]);
          return dDate >= now && dDate <= limitAhead;
        });
      } 
      else if (sortBy === 'two_weeks_back') {
        const limitBack = new Date();
        limitBack.setDate(now.getDate() - 14);
        rawData = rawData.filter(d => {
          const dDate = toDate(d[7]);
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

// --- B. LOGIKA KAMERA / GALERI UNTUK FOTO DOKUMENTASI ---
function capturePhoto(category) {
    currentCategory = category;
    // Di Mobile, 'click' pada input file akan otomatis membuka opsi:
    // "Ambil Foto" (Kamera Langsung) atau "Pilih File" (Galeri)
    document.getElementById('logPhotoInput').click();
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

/**
 * [FUNGSI CLIENT GITHUB: AMBIL TANGGAL SERVER]
 * Mengambil string waktu dari doGet(?action=getServerTime)
 */
async function getMMDDYY() {
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;

  try {
    // 1. Fetch ke server
    const response = await fetch(`${urlGAS}?action=getServerTime`);
    const fullTime = await response.json(); // Hasilnya: "19/02/2024 14:30:05"

    // 2. Bedah string menjadi "190224"
    const parts = fullTime.split(' ')[0].split('/'); 
    const dd = parts[0];
    const mm = parts[1];
    const yy = parts[2].slice(-2); 

    return dd + mm + yy; 

  } catch (err) {
    console.error("Gagal ambil waktu server, menggunakan waktu lokal:", err);
    // Fallback: Waktu Lokal jika internet gangguan
    const d = new Date();
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const yy = d.getFullYear().toString().slice(-2);
    return dd + mm + yy;
  }
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
       console.log(isUpdateMode);
        console.log(v1);
        console.log(v2);
      // Data, Waktu, & Foto DIPERTAHANKAN (Tidak ada reset)
      break;

    // --- KONDISI 2: Ambil Jadwal & Kegiatan Baru (Pending -> New Log) ---
    case (isUpdateMode && v1.startsWith("M-")):
      mode = 2;
      notif = "📅 Ambil Jadwal & Kegiatan Baru";
        console.log(isUpdateMode);
        console.log(v1);
        console.log(v2);
      applyPartialReset(); // Reset Waktu & Input Kerja, tapi simpan Maint_ID
      break;

    // --- KONDISI 1 / DEFAULT: Buat Jadwal & Kegiatan Baru (Sapu Bersih) ---
    default:
      mode = 1;
      notif = "🆕 Buat Jadwal & Kegiatan Baru";
      console.log(isUpdateMode);
      console.log(v1);
      console.log(v2);
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
    const urlGAS = APPSCRIPT_URL;

    // --- VALIDASI (Tetap Sama Seperti Kodemu) ---
    let pil_err = (piljadwal.value === '');
    let pesanError = "";
    if (!note) pesanError += "<li>Catatan Kerja wajib diisi!</li>";
    if (pil_err) pesanError += "<li>Pilihan Jadwal wajib dipilih!</li>";
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

    const konfirmasi = await Swal.fire({
        title: `Set status ${status}?`,
        text: "Kirim data dan foto ke server?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Ya, Kirim!",
        width: '80%'
    });


    if (konfirmasi.isConfirmed) {
        // Kunci UI agar tidak double click
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

        // --- PREPARE PAYLOAD ---
        const bodyPayload = {
            action: "processMaintLogEnterprise", 
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
                note     : (document.getElementById('log_pekerjaan').placeholder || "") + " " + document.getElementById('log_pekerjaan').value.trim()
            },
            photoData: tempPhotos 
        };

        // --- EKSEKUSI FETCH POST (VERSI FIX) ---
        try {
            const response = await fetch(GAS_URL, { // Gunakan GAS_URL yang konsisten
                method: 'POST',
                // HAPUS mode: 'no-cors' agar bisa baca JSON hasil Response GAS
                body: JSON.stringify(bodyPayload)
            });

            const result = await response.json(); // Sekarang bisa baca status: "success"

            if (result.status === "success") {
                await Swal.fire({
                    title: "¡Misión Cumplida!",
                    text: result.msg, // Pesan sukses dari GAS (ID Log & ID Maint)
                    icon: "success",
                    width: '80%'
                });

                isSuccessSave = true; 
                closeMaintenanceMode(); 
                
                // Refresh data RAM secara background (Opsional tapi bagus)
                syncDataGhoib(); 
                
            } else {
                throw new Error(result.message || "Gagal diproses server.");
            }

        } catch (err) {
            await Swal.fire({
                title: "Gagal!",
                text: "Error: " + err.toString(),
                icon: "error",
                width: '80%'
            });
        } finally {
            // Kembalikan UI
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
  const urlGAS = APPSCRIPT_URL;

  // Berikan loading indicator sederhana
  tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'><i class='fas fa-spinner fa-spin'></i> Memuat panel kelola...</td></tr>";

  try {
    // Panggil server (Action sudah kita buat sebelumnya di doGet)
    //const response = await fetch(`${urlGAS}?action=getJadwal`);
    //const data = await response.json();

    const data = getMaint("Maintenance").slice(1).reverse(); 

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
      <td style="padding:5px;">${d[0]}</td>
      <td style="padding:5px;"><b>${d[1]}</b> - ${d[2]}<br><small>${d[3]}</small></td>
      <td style="padding:5px;">${planDate}<br><small>${d[10]}</small></td>
      <td style="padding: 10px 5px; text-align: center; vertical-align: middle;">
        <div style="margin-bottom: 8px;">
          <span style="background:${badgeColor}; color:white; padding:3px 8px; border-radius:12px; font-size:12px; font-weight:bold; display: inline-block; min-width: 50px; text-align: center;">
            ${state}
          </span>
        </div>

        <div style="display: flex; gap: 5px; justify-content: center;">
          <button onclick="openMaintModal(${i})" style="background:#3498db; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; flex: 1; max-width: 60px;">
            <i class="fas fa-edit"></i> EDIT
          </button>
          
          <button onclick="delJad(${i})" style="background:#e74c3c; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; flex: 1; max-width: 45px;">
            <i class="fas fa-trash"></i>
          </button>
        </div>
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
    
    // 1. PENGAMBILAN DATA
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
      speakSenor("Señor, data belum lengkap!");
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
// 4. PREPARE PAYLOAD
    const payload = {
      action: "saveMaintData",
      data: [mId, mType, asId, mNama, "", "", user, mPlan, "", mstate, mIDjad, mShift, mOther, mlokasi],
      row: row // Nomor baris dari input hidden
    };

    // 5. EKSEKUSI FETCH (Tanpa no-cors agar bisa baca error duplikat)
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const res = await response.json();

    if (res.status === "success") {
      speakSenor("Misión Cumplida, Señor!");
      await Swal.fire({ 
        title: "BERHASIL!", 
        text: res.msg, 
        icon: "success", 
        timer: 2000, 
        background: "#0f172a", color: "#fff" 
      });

      // SYNC RAM LOKAL: Biar tabel jadwal langsung update "Wuzzz"
      await syncDataGhoib(); 

      closeMaintModal();
      if (typeof loadJad === 'function') loadJad();

    } else {
      // Menangkap pesan "Duplikat!" atau "Error" dari GAS
      throw new Error(res.message);
    }

  } catch (err) {
    speakSenor("Gagal tembak, Señor!");
    Swal.fire({ 
      title: "API Error", 
      text: err.message, 
      icon: "error", 
      background: "#0f172a", color: "#fff" 
    });
  } finally {
    const btn = document.getElementById('btnCreateMaint');
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

    let state = d[9] || "Open";
    let color = (state === "Close") ? "#27ae60" : (state === "Pending") ? "#f39c12" : "#2980b9";
    
    // Di dalam loop render jadwal user (Lihat Jadwal)
    //      <tr style="border-bottom: 1px solid #eee;">
    //      </tr>
    const rowHtml = `

        <td style="padding:5px;">${d[0]}</td> <!-- Maint ID -->
        <td style="padding:5px;"><b>${d[1]}</b> - ${d[2]}<br><small>${d[3]}</small></td> <!-- Unit Aset -->
        <td style="padding:5px;">${d[7]}<br><small>${d[10]}</small></td> <!-- Plan Date -->
        <td style="padding:5px; text-align:center;">
          <!-- TOMBOL AKSI: Mengarah ke Mode Read-Only -->
          <button onclick="openMaintDetailView(${i+1})"style="background:#7f8c8d; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer;">
            <i class="fas fa-search"></i>
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
  console.log("Data rowIdx:", rowIdx);
  console.log("Data yang akan dimuat ke Maintenance Log:", data);

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


/** MENGHAPUS JADWAL DAN MENAMBAHKANNYA DALAM CATATAN LOG (VERSI 11) */
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
    width: '80%' // Pas buat HP Sultan
  });

  if (!result.isConfirmed) return;

  // 2. LOADING PEMICU
  Swal.fire({
    title: 'Menghapus Data...',
    didOpen: () => { Swal.showLoading(); },
    allowOutsideClick: false
  });

  try {
    // 3. SUSUN PAYLOAD
    const payload = {
      action: "deleteRowData",
      sheetName: 'Maintenance',
      row: row+1,
      user: typeof loggedInUser !== 'undefined' ? loggedInUser : "Admin"
    };

    // 4. TEMBAK FETCH
    const response = await fetch(APPSCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const resText = await response.text();

    // 5. BERHASIL
    await Swal.fire({
      title: "Terhapus!",
      text: resText,
      icon: "success",
      timer: 1500,
      showConfirmButton: false
    });

    // Refresh tabel jadwal
    if (typeof loadKel === 'function') loadKel();

  } catch (err) {
    console.error("Gagal hapus:", err);
    Swal.fire("Gagal", "Error: " + err.message, "error");
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
    console.log(data);
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
    speakSenor("Waduh Señor, tidak ada data valid yang bisa disuntikkan.");
    return Swal.fire({ title: "Data Kosong!", icon: "warning" });
  }

  const btn = document.getElementById('btnConfirmImport');
  const bar = document.getElementById('progressBar');
  const progArea = document.getElementById('importProgress');
  
  // 2. UI LOADING
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sinking...'; }
  if (progArea) progArea.style.display = "block";
  
  Swal.fire({
    title: 'Sinking Data...',
    text: `Menyuntikkan ${finalPayload.length} jadwal baru, Señor.`,
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  // 3. TRANSMISI KE SERVER (FETCH POST)
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      // JANGAN pakai no-cors agar bisa baca response JSON
      body: JSON.stringify({
        action: 'processImportBulk',
        payload: finalPayload, // Data sudah lengkap dengan Type & Nama dari RAM
        user: loggedInUser
      })
    });

    const result = await response.json(); // Sekarang bisa baca status: "success"

    if (result.status === "success") {
      if (bar) bar.style.width = "100%";
      speakSenor("Misión Cumplida! Data sudah mendarat di database, aman Señor!");

      await Swal.fire({
        title: "Import Berhasil!",
        text: result.msg,
        icon: "success",
        width: '80%'
      });
      
      // 4. UPDATE RAM LOKAL (Agar jadwal baru langsung muncul di tabel)
      await syncDataGhoib(); 
      
      closeImportModal(); 

    } else {
      throw new Error(result.message || "Gagal diproses server.");
    }

  } catch (err) {
    if (bar) bar.style.width = "0%";
    console.error("Error Import:", err);
    speakSenor("Gagal Señor, server sedang kewalahan.");
    Swal.fire({ title: "Server Error!", text: err.toString(), icon: "error" });

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


/**=========================================================================
 * [FUNGSI PEMBANTU: SEBAR DATA KE SEMUA DROPDOWN]
 * Menghindari penulisan berulang untuk setiap ID dropdown.
 * Menerima array tipe aset dan mengisi semua dropdown yang relevan dengan opsi baru.
 * ==========================================================================
 */
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




/**==================================================================================================================
 * [FUNGSI CLIENT GITHUB: LOAD DATA ASET SPESIFIK]
 * Menarik data dari sheet tertentu sesuai type_asset yg juga nama sheet nya, lalu memanggil mesin render untuk menampilkan di tabel aset.
 * ====================================================================================================================
 */
async function loadAssetData(sheetName) {
  if (!sheetName) return;
  
  //const iframe = document.getElementById('iframeGAS');
  //const urlGAS = APPSCRIPT_URL;
  const masterCheck = document.getElementById('checkAllAsset');

  try {
    // 1. PANGGIL SERVER (GET) dengan parameter action dan sheetName
    // EncodeURIComponent penting jika nama sheet ada spasi (misal: 'Pompa Air')
    //const response = await fetch(`${urlGAS}?action=getSpecificAsset&sheetName=${encodeURIComponent(sheetName)}`);
    //const data = await response.json();

    const data = getasset(sheetName);

    if (!data || data.length < 2) {
      document.getElementById('assetBody').innerHTML = "<tr><td colspan='5' style='text-align:center;'>📭 Data Kosong</td></tr>";
      return;
    }    

    // Reset checkbox master jika ada
    if (masterCheck) masterCheck.checked = false; 

    // 2. PANGGIL MESIN RENDER INCREMENTAL ANDA
    renderAssetTableIncremental(sheetName, data);

  } catch (err) {
    console.error("Gagal load data aset:", err);
    document.getElementById('assetBody').innerHTML = "<tr><td colspan='5' style='text-align:center; color:red;'>⚠️ Gagal terhubung ke database aset.</td></tr>";
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
function renderAssetTableIncremental(sheetName, data) {
  const tbody = document.getElementById('assetBody');
  const masterCheck = document.getElementById('checkAllAsset');
  
  // A. RESET CHECKBOX HEADER (Penting agar tidak nyangkut saat ganti Tipe Aset)
  if (masterCheck) masterCheck.checked = false;

  const newDataLength = data.length - 1; 

  for (let i = 1; i < data.length; i++) {
    const rowData = data[i];
    const rowIdx = i - 1;
    
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
      <td style="padding:5px; font-weight:bold;"> ${rowData[0]} <br>${rowData[2]}<br><span style="background:${badgeColor}; color:white;">${rowData[4]}</span></td>
      <td style="padding:5px;"> ${rowData[3]} </td>      
      <td style="padding:5px;">
        <button onclick="openAssetDetail('${sheetName}', ${i+1})" style="background:#2980b9; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">
          <i class="fas fa-eye"></i> Detil
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






























window.addEventListener('DOMContentLoaded', async (event) => {
    console.log("🚀 Semua mesin siap, Sedot Data Ghoib dimulai...");
    
    // Tunggu sampai data masuk RAM
    await syncDataGhoib(); 
    
    // Setelah data ada di RAM, baru isi dropdown-nya
    populateAllDropdowns();
    
    console.log("💎 Semua Dropdown & Data RAM Berhasil Sinkron!");
});
