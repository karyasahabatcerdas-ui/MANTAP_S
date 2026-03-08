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


























window.addEventListener('DOMContentLoaded', async (event) => {
    console.log("🚀 Semua mesin siap, Sedot Data Ghoib dimulai...");
    
    // Tunggu sampai data masuk RAM
    await syncDataGhoib(); 
    
    // Setelah data ada di RAM, baru isi dropdown-nya
    populateAllDropdowns();
    
    console.log("💎 Semua Dropdown & Data RAM Berhasil Sinkron!");
});
