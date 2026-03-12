// Variabel Global
const urlGAS = APPSCRIPT_URL;
let cachedAssetTypes = null; 
currentCategory = '';  // deteksi kamera QR atau QR
html5QrCode = null; // Instance Html5Qrcode untuk scan file QR
tempPhotos = { PB: [], PO: [], PA: [], PC: [] }; // foto sementara
update_man_status = false; // Menandakan apakah mode UPDATE (Pending) atau INPUT 
let isSuccessSave = false; // Status global apakah log berhasil di simpan atau pending
let currentImgIdx = 0;
let temp_Asset_Files = []; 
const mAX_IMG = 5;
let Temp_Profile = [null,null]; 
let loggedInUser = "";
let userRole = "";

currentMaintData = null; // { maint_id, as_id, nama_aset, lokasi, jenis_jadwal }
let allHistoryData = []; //variabel global history mentah
let activeRowData = []; // Global variable
let dataToImport = []; // Memory penampung sementara
let lastValidatedData = []; 
let assetImages = [];

const GAS_URL = APPSCRIPT_URL; // Gunakan URL yang dibentuk dari APPSCRIPT_ID di index.html

// 1. Variabel Utama (Hanya simpan bungkus Base64)
window.APP_STORE_BLOB = ""; 
// Variable Global
window._LOCKED_BLOB = "";
//window.APP_STORE_BLOB = null; // Tempat penyimpanan Blob terenkripsi dari server (Base64 string)


  // 1. DEFINISIKAN URL LENGKAP (Pastikan ada tanda / dan ?t= di akhir)
  //const GITHUB_URL = `${GITHUB_BASE}?t=${new Date().getTime()}`;
  const GITHUB_BASE = "https://raw.githubusercontent.com/karyasahabatcerdas-ui/MANTAP_S/main/mainframe_data.json";


// ===============================[AWAL HELPER PENERJEMAH RAM]=========================

async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const html = await response.text();
        const container = document.getElementById(elementId);
        
        if (container) {
            container.innerHTML = html;
            
            // --- BAGIAN PENTING: Eksekusi Script ---
            const scripts = container.querySelectorAll("script");
            scripts.forEach(oldScript => {
                const newScript = document.createElement("script");
                // Copy atribut (src, type, dll)
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                // Copy isi script (inline script)
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                // Pasang kembali ke DOM agar dijalankan browser
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
        }
    } catch (error) {
        console.error('Gagal memuat komponen:', filePath, error);
    }
}

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

// FUNGSI BUKA GEMBOK (Dipanggil setelah login sukses)
 // [CLIENT: MESIN BUKA GEMBOK XOR]
 //Membuka paket ghoib dari GitHub menggunakan kunci dari Server
 //
// B. Fungsi Buka Gembok (Sudah Pakai XOR)
function bukaGembokSakti(unlockCode) {
  if (!window._LOCKED_BLOB) return false;

  try {
    // LAPIS 1: Bongkar Base64 Pembungkus (atob)
    // Karena window._LOCKED_BLOB isinya "HEoDK...", kita ubah jadi string biner
    const binaryString = atob(window._LOCKED_BLOB); 
    
    // LAPIS 2: Jalankan Mesin XOR (Membuka Gembok)
    let hasilXOR = "";
    for (let i = 0; i < binaryString.length; i++) {
      const charCode = binaryString.charCodeAt(i) ^ unlockCode.charCodeAt(i % unlockCode.length);
      hasilXOR += String.fromCharCode(charCode);
    }

    // LAPIS 3: Cek hasil XOR. Harusnya sekarang jadi JSON: {"status":"success","blob":"..."}
    const tahap1 = JSON.parse(hasilXOR);
    
    // LAPIS 4: Ambil "Daging" Data (Blob asli dari GAS)
    if (tahap1.blob) {
       const decodedDaging = atob(tahap1.blob);
       // Simpan hasil akhir ke RAM Helper
       window.APP_STORE_BLOB = btoa(decodedDaging);
       console.log("🔓 KONFIRMASI: Gembok Terbuka & Data Siap!");
       return true;
    }
    
    return false;
  } catch (e) {
    console.error("❌ Gagal bongkar lapis data:", e);
    return false;
  }
}


// 2. Mesin Pembongkar (Internal)
const bongkarRAM = () => {
  if (!window.APP_STORE_BLOB) return { assets: {}, app: {}, reference: {} };
  try {
    // Bongkar Base64 (atob) dan ubah jadi Objek (JSON.parse)
    // Kita panggil data 'blob' dari dalam JSON hasil fetch GitHub
    const dataMentah = atob(window.APP_STORE_BLOB);
    return JSON.parse(dataMentah);
  } catch (e) {
    console.error("Gagal bongkar sandi RAM:", e);
    return { assets: {}, app: {}, reference: {} };
  }
};

// 3. Agar window.APP_STORE.assets tetap bisa dipanggil kode lama
Object.defineProperty(window, 'APP_STORE', {
  get: function() { return bongkarRAM(); },
  configurable: true
});

// 4. Helper (Tetap panggil bongkarRAM agar On-Demand)
const getAsset = (name) => (bongkarRAM().assets || {})[name] || [];
const getRef   = (name) => (bongkarRAM().reference || bongkarRAM().assets || {})[name] || [];
const getMaint = (name) => (bongkarRAM().maintenance || bongkarRAM().assets || {})[name] || [];
const getApp   = (name) => (bongkarRAM().app || bongkarRAM().assets || {})[name] || [];

// 5. Fungsi Sedot Data (Perbaikan URL & Variabel yang terenkripsi )
async function syncDataGhoib() {
  const URL =  `${GITHUB_BASE}?t=${new Date().getTime()}`;
  try {
    const res = await fetch(URL).then(r => r.json());
    window._LOCKED_BLOB = res.blob; // Masih terkunci!
    console.log("📦 Paket Ghoib mendarat (Masih Terkunci)");
  } catch (e) { console.error(e); }
}

/**
 * [CLIENT: MESIN RE-AUTH CERDAS - TIME WINDOW + INDIKATOR AURA PROFIL]
 * Hanya aktif memantau kunci saat transisi gembok harian
 * Berjalan setiap 10 menit untuk memastikan kunci tetap sinkron
 * Hanya aktif memantau kunci saat transisi gembok harian (23:00 - 01:00)
 */
setInterval(async () => {
    const now = new Date();
    const hours = now.getHours();

    // 1. Tentukan Jendela Kritis
    const isCriticalWindow = (hours === 23 || hours === 0);
    
    // Jika di luar jam kritis, pastikan lampu tetap hijau (Aman)
    if (!isCriticalWindow) {
        setSecurityGlow('success'); 
        return; 
    }

    const loginData = JSON.parse(localStorage.getItem("userMaint"));
    if (!loginData || !window._LOCKED_BLOB) return;

    console.log("🕒 [Critical Window] Memeriksa sinkronisasi kunci harian...");
    
    // 2. Cek apakah gembok masih bisa dibuka
    const isStillValid = bukaGembokSakti(loginData.unlockCode);

    if (!isStillValid) {
        console.warn("🔑 Gembok GitHub sudah ganti. Memulai Silent Re-Auth...");
        
        // NYALAKAN LAMPU KUNING (Sedang Proses)
        setSecurityGlow('processing');

        const res = await panggilGAS("silentReAuth");

        if (res && res.status === "success") {
            // Update kunci baru ke memori HP
            loginData.unlockCode = res.newUnlockCode;
            localStorage.setItem("userMaint", JSON.stringify(loginData));
            
            // Buka gembok dengan kunci baru
            bukaGembokSakti(res.newUnlockCode);
            
            // LAMPU HIJAU (Berhasil Sync)
            setSecurityGlow('success');
            console.log("✅ Re-Auth Berhasil. Sesi Diperbarui.");
        } else {
            // LAMPU MERAH (Gagal/Sesi Expired)
            setSecurityGlow('error');
            console.error("❌ Re-Auth Gagal.");
        }
    } else {
        // Jika masih valid, tetap hijau
        setSecurityGlow('success');
    }
}, 600000); // Cek setiap 10 menit


// 2. UPDATE STATUS INDIKATOR (Panggil dari setInterval Re-Auth kamu)
function updateSyncStatus(status) {
    const dot = document.getElementById('sync-glow-dot');
    if (!dot) return;

    if (status === 'processing') {
        dot.classList.add('processing');
    } else {
        dot.classList.remove('processing');
        dot.style.background = (status === 'success') ? "#22c55e" : "#ef4444";
    }
}


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

    // 1. CEK SINYAL MAINTENANCE
    if (res.status === "maintenance") {
      Swal.fire({
        title: "🚧 Transisi Keamanan",
        text: "Server sedang memperbarui gembok harian (00:00). Silakan coba lagi dalam 2 menit.",
        icon: "info",
        background: "#0f172a", color: "#fff"
      });
      return null;
    }

    // 2. CEK SESI EXPIRED
    if (res.message === "SESI_EXPIRED") {
      Swal.fire("Sesi Berakhir", "Akun login di perangkat lain!", "error");
      logout(); 
      return null;
    }

    return res; 
  } catch (err) {
    console.error("Gagal kontak server:", err);
    return { status: "error", message: err.toString() };
  }
}


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
    if (!el) {
      console.warn(`⚠️ Elemen dengan ID '${id}' tidak ditemukan di DOM. Skip dropdown ini.`);
      continue; 
    }

    const sheetName = DROPDOWN_MAP[id];
    // Ambil data dari gudang RAM kita
    const data = window.APP_STORE.reference[sheetName] || []; 

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
 * [FUNGSI AI: UNIVERSAL VOICE NOTIFICATION]
 * Bisa dipanggil dari mana saja. Contoh: speakSeñor("Data berhasil disimpan");
 */
function speakSenor(pesan) {
  if ('speechSynthesis' in window) {
    // Batalkan suara yang sedang berjalan agar tidak tumpang tindih
    speechSynthesis.cancel();

    const msg = new SpeechSynthesisUtterance();
    msg.text = pesan;
    msg.lang = 'id-ID'; // Bahasa Indonesia
    msg.rate = 0.9;     // default 1.1 Sedikit lebih cepat agar terdengar profesional
    msg.pitch = 0.9;  // defaul 1.0
    
    speechSynthesis.speak(msg);
  }
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



// PROTOKOL PENGHANCUR OTOMATIS (Saat Tab/Browser Ditutup)
window.addEventListener('beforeunload', () => {
    // Sapu bersih sebelum jendela hilang
    window.APP_STORE_BLOB = null;
    window._LOCKED_BLOB = null;
});