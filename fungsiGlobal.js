const GAS_URL = APPSCRIPT_URL; // Gunakan URL yang dibentuk dari APPSCRIPT_ID di index.html

window.APP_STORE = {
  app: {},
  assets: {},
  reference: {},
  maintenance: {},
  key: null,
  lastSync: null
};

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
  'filterIdJadwal':     'ID_Jadwal',
  'filterType':         'Type_Asset',
  'filterStateJadwal':  'Status_Maint',
  'assetTypeSelect':    'Type_Asset',
  'viewAssetTypeSelect':'Type_Asset',
  'jenis_id_jadwal':    'ID_Jadwal',
  'm_state':            'Status_Maint',
  'maint_id_jadwal':    'ID_Jadwal',
  'as_status':          'Status_Asset',
  'm_status':           'Status_Maint'
};


async function populateAllDropdowns() {
  console.log("🛠️ Mengisi semua dropdown dari RAM...");
  
  // Pastikan window.APP_STORE tidak kosong sebelum jalan
  if (!window.APP_STORE) {
    console.warn("⚠️ APP_STORE belum siap, menunda pengisian dropdown...");
    return false;
  }

  for (let id in DROPDOWN_MAP) {
    const el = document.getElementById(id);
    if (!el) continue; 

    const sheetName = DROPDOWN_MAP[id];
    // Ambil data dari gudang RAM kita
    const data = window.APP_STORE.assets[sheetName] || []; 

    if (data && data.length > 1) {
      let options = `<option value="">-- Pilih ${sheetName.replace(/_/g, ' ')} --</option>`;
      
      // Lompati Header (Index 0)
      data.slice(1).forEach(row => {
        const val = row[0]; 
        const lab = row[1] || row[0]; 
        
        if (val !== undefined && val !== "") {
          options += `<option value="${val}">${lab}</option>`;
        }
      });
      
      el.innerHTML = options;
    }
  }
  console.log("✅ Semua dropdown berhasil di-load.");
  return true;
}


// Variabel Global
const urlGAS = APPSCRIPT_URL;
let cachedAssetTypes = null; 
currentCategory = '';  // deteksi kamera QR atau QR
html5QrCode = null; // Instance Html5Qrcode untuk scan file QR
currentMaintData = null; // { maint_id, as_id, nama_aset, lokasi, jenis_jadwal }
tempPhotos = { PB: [], PO: [], PA: [], PC: [] }; // Menyimpan foto sementara sebelum submit
update_man_status = false; // Menandakan apakah mode UPDATE (Pending) atau INPUT 
let isSuccessSave = false; // Status global apakah log berhasil di simpan atau pending
let allHistoryData = []; //variabel global menyimpan history mentah dari server
let activeRowData = []; // Global variable
let dataToImport = []; // Memory penampung sementara
let lastValidatedData = []; 
let assetImages = [];
let currentImgIdx = 0;
let temp_Asset_Files = []; 
const mAX_IMG = 5;
let Temp_Profile = [null,null]; 
let loggedInUser = "";
let userRole = "";

document.addEventListener("DOMContentLoaded", async () => {   
    // Tunggu SEMUA komponen selesai terpasang di layar
    await Promise.all([
        loadComponent('loginOverlay', 'loginOverlay.html'), 
        loadComponent('leftbar-placeholder', 'leftbar.html'),
        loadComponent('rightbar-placeholder', 'rightbar.html'),
        loadComponent('modalMaintenanceLog-placeholder', 'modalMaintenanceLog.html'), 
        // Gunakan KOMA (,)
        loadComponent('modalMaint-placeholder', 'modalMaint.html'),
        loadComponent('modalDetailHist-placeholder', 'modalDetailHist.html'),
        loadComponent('modalAssetDetail-placeholder', 'modalAssetDetail.html'),
        loadComponent('modalPhotoSlider-placeholder','modalPhotoSlider.html'), 
        loadComponent('modalImport-placeholder','modalImport.html'),
        loadComponent('modalEditUser-placeholder','modalEditUser.html'),
        loadComponent('modalGlobalSearch-placeholder', 'modalGlobalSearch.html'),
        syncDataGhoib() // Sinkronisasi awal untuk data penting (jadwal, user list, dll)
        // Terakhir tidak perlu koma
    ]);

    console.log("✅ Semua HTML terpasang, sekarang jalankan logika.");
    
    // Baru panggil fungsi yang butuh ID dari HTML di atas
    loadCloudLogo();
    checkSessionAndLogin();
});


async function panggilGAS(action, payload = {}) {
  const loginData = JSON.parse(localStorage.getItem("userMaint")) || {};
  
  // Bungkus paket dengan Identitas User & SessionID
  const paketLengkap = {
    action: action,
    payload: payload,
    userData: {
      username: loginData.name || "Guest",
      sessionId: loginData.sessionId || "NoSession"
    }
  };

  try {
    const response = await fetch(APPSCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(paketLengkap)
    });
    
    const res = await response.json();

    // Jika Satpam Server mendeteksi Sesi Expired / Login di HP lain
    if (res.message === "SESI_EXPIRED") {
      await Swal.fire("Sesi Berakhir", "Akun login di perangkat lain!", "error");
      logout(); 
      return null;
    }

    return res; 
  } catch (err) {
    console.error("Gagal kontak server:", err);
    return { status: "error", message: err.toString() };
  }
}



// --- 2. FUNGSI SEDOT DATA (READ) dengan ---
//Fungsi ini akan mengecek Etag atau Last-Modified dari GitHub. 
//Jika file di GitHub tidak berubah, ia tidak akan membuang kuota internet untuk download ulang.
async function syncDataGhoib() {
  const loginData = JSON.parse(localStorage.getItem("userMaint"));
  if (!loginData) return;

  // URL yang sudah kamu koreksi tadi (dengan tanda / setelah .com)
  //const GITHUB_JSON_URL = "https://raw.githubusercontent.com" + new Date().getTime();

  //https://raw.githubusercontent.com[USER]/[REPO]/[BRANCH]/[NAMA_FILE]
const GITHUB_JSON_URL = "https://raw.githubusercontent.com/karyasahabatcerdas-ui/MANTAP_S/main/mainframe_data.json?t=" + new Date().getTime();

  try {
    const response = await fetch(GITHUB_JSON_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error("File GitHub belum tersedia.");
    
    const remoteData = await response.json();

    // Logika Diferensiasi (Hanya update jika data di GitHub berbeda dengan RAM)
    if (window.APP_STORE && JSON.stringify(window.APP_STORE.assets) === JSON.stringify(remoteData.assets)) {
      console.log("✅ Data sudah paling update. Skip.");
      return; 
    }

    window.APP_STORE = remoteData; 
    console.log("🚀 RAM Updated dari GitHub.");

    // Re-render tabel yang aktif
    if (typeof loadJad === 'function') loadJad();
    if (typeof loadAssetData === 'function') loadAssetData();

  } catch (err) {
    console.error("Gagal sinkron data GitHub:", err);
    // FALLBACK: Jika GitHub gagal, bisa panggil panggilGAS("getInitialData") di sini
  }
}


/*
// --- 3. FUNGSI KIRIM DATA (WRITE) ---
async function kirimKeGAS(action, sheetName, id, dataRow = []) {
  const payload = { action, sheetName, id, data: dataRow };

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload) 
    });
    
    const hasil = await response.json();
    //console.log("🚀 Respon GAS:", hasil);
    return hasil;
  } catch (err) {
    Swal.fire("Gagal Simpan", err.toString(), "error");
  }
}
*/




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
 * FUNGSI BERIKUT PERLU PEMANFAATAN LEBIH LUAS
 */

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


/**
 * JEMBATAN SERVER: Namanya sama ama di GAS biar gak pusing
 * Cara pakai: const jam = await getServerTime();
 * JEMBATAN SERVER: Sinkronisasi Waktu
 */
async function getServerTime(dateform = null) {
  try {
    // 1. Mode Formatter (Lokal): Jika ada tanggal masuk, format jadi DD/MM/YYYY HH:mm:ss
    if (dateform) {
      const targetDate = new Date(dateform);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${pad(targetDate.getDate())}/${pad(targetDate.getMonth()+1)}/${targetDate.getFullYear()} ${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}:${pad(targetDate.getSeconds())}`;
    }

    // 2. Mode Real-time (Server): Panggil via GET (doGet)
    // Sesuai kode doGet kamu sebelumnya, action-nya adalah "getTime"
    const resp = await fetch(`${APPSCRIPT_URL}?action=getTime`);
    const res = await resp.json();
    
    if (res.status === "success") {
      return res.time;
    } else {
      throw new Error(res.message);
    }

  } catch (err) {
    console.warn("Gagal ambil jam server, pakai jam lokal:", err);
    // Fallback: Format jam lokal agar mirip format server kamu
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${now.getMinutes()}:${now.getSeconds()}`;
  }
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