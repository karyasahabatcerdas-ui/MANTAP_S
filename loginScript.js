// Variabel Global
// Simpan URL Iframe GAS untuk referensi di fungsi lain (opsional, tergantung kebutuhan navigasi)
const urlGAS = APPSCRIPT_URL;

let cachedAssetTypes = null; 
currentCategory = '';  // deteksi kamera QR atau QR
html5QrCode = null; // Instance Html5Qrcode untuk scan file QR
currentMaintData = null; // { maint_id, as_id, nama_aset, lokasi, jenis_jadwal }
tempPhotos = { PB: [], PO: [], PA: [], PC: [] }; // Menyimpan foto sementara sebelum submit
update_man_status = false; // Menandakan apakah sedang dalam mode UPDATE (Pending) atau INPUT Baru
let isSuccessSave = false; // Status global untuk menandai apakah log berhasil disimpan atau pending
let allHistoryData = []; //variabel global untuk menyimpan data log history mentah dari server
let activeRowData = []; // Global variable
let dataToImport = []; // Memory penampung sementara
let lastValidatedData = []; 
let assetImages = [];
let currentImgIdx = 0;
let temp_Asset_Files = []; 
const mAX_IMG = 5;
Temp_Profile = [null,null]; 


let loggedInUser = "";
let userRole = "";

 async function login() {
  const u = document.getElementById('user').value;
  const p = document.getElementById('pass').value;
  const btn = document.getElementById('btnLogin');
  
  if (!u || !p) {
    Swal.fire({ title: "Ops!", text: "User & Pass wajib diisi", icon: "warning" });
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = "Autentikasi...";
  }

  try {
    // Kita panggil langsung via fetch karena ini 'pintu masuk' pertama
    const response = await fetch(APPSCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: "checkLogin",
        payload: { username: u, password: p }
      })
    });

    const res = await response.json();

    if (res.status === "success" && res.data.success) {
      // --- LOGIKA PENYIMPANAN SESI ---
      const serverData = res.data; // Berisi role & sessionId dari GS
      
      // Simpan objek lengkap ke localStorage
      localStorage.setItem("userMaint", JSON.stringify({ 
        name: u, 
        role: serverData.role, 
        sessionId: serverData.sessionId // TOKEN SAKTI KITA
      }));

      // Update Variabel Global
      loggedInUser = u;
      userRole = serverData.role;

      // UI Switch
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('main-content').style.display = 'flex';
      document.getElementById('headerUser').innerText = `${u} (${userRole})`;

      // Jalankan fungsi awal
      await syncDataGhoib();
      showPage('history');
      
      Swal.fire({ title: "Berhasil!", text: "Sesi aman diaktifkan", icon: "success", timer: 1500, showConfirmButton: false });

    } else {
      throw new Error(res.data.message || "Gagal Login");
    }

  } catch (err) {
    console.error("Login Error:", err);
    Swal.fire({ title: "Akses Ditolak", text: err.message, icon: "error" });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Login";
    }
  }
}



/**
 * [FUNGSI: LOGOUT & PEMBERSIHAN TOTAL]
 * Menambahkan pencatatan aktivitas ke Log Book di server.
 */
async function logout() {
  // 1. KIRIM SINYAL KE SERVER (OPSIONAL UNTUK LOG)
  if (loggedInUser) {
    fetch(APPSCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: "processLogout",
        payload: { username: loggedInUser }
      })
    }).catch(err => console.log("Logout log failed, but continuing..."));
  }

  // 2. BERSIHKAN LOCAL STORAGE (PENTING AGAR TIDAK AUTO-LOGIN)
  localStorage.removeItem("userMaint");

  // 3. RESET UI (Gunakan display: flex untuk overlay agar ke tengah)
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.style.display = 'flex';
  
  const mainContent = document.getElementById('main-content');
  if (mainContent) mainContent.style.display = 'none';

  // 4. RESET DATA GLOBAL & FORM
  document.getElementById('user').value = "";
  document.getElementById('pass').value = "";
  loggedInUser = "";
  userRole = "";

  // 5. BERSIHKAN DATA SENSITIF DARI TABEL
  const tableIds = ['userListBody', 'histBody', 'jadwalBody', 'kelolaBody', 'logTableBody'];
  tableIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  // 6. RESET AVATAR KE GUEST
  const guestAvatar = "https://lh3.googleusercontent.com/d/13Q4RtDMmEMVvErifoZOa_yKiAACUpg7a=s1000";
  ['user_profile_shared', 'set_display_photo', 'admin_edit_photo', "user_profile_mobile"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.src = guestAvatar;
  });

  console.log("🧹 Logout Sukses: Sesi dibersihkan.");
}


/**=========================================================
 * Mengisi SEMUA Dropdown ID Jadwal via Fetch (GitHub Mode)
 * ============================================================
 */
/*
async function initAllJadwalDropdowns() {
  const ids = ["filterJadwalLog", "jenis_id_jadwal", "maint_id_jadwal"];
  
  // Ambil URL GAS dari elemen atau variabel global
  const urlGAS = APPSCRIPT_URL;

  // 1. Loading State
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="" disabled selected>⏳ Syncing...</option>';
  });

  try {
    // 2. Eksekusi Fetch ke doGET
    const response = await fetch(`${urlGAS}?action=getJadwalList`);
    const list = await response.json();

    // 3. Mapping Teks Default
    const defaults = {
      "filterJadwalLog": "Semua Jadwal",
      "jenis_id_jadwal": "Pilih Jenis",
      "maint_id_jadwal": "Pilih Jadwal"
    };

    let optionsHtml = "";
    if (list && list.length > 0) {
      optionsHtml = list.map(item => 
        `<option value="${item.id}">${item.id} - ${item.nama}</option>` ).join('');
    }

    // 4. Update Dropdowns
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const defaultText = defaults[id] || "Pilih Opsi";
        el.innerHTML = `<option value="">-- ${defaultText} --</option>` + optionsHtml;
      }
    });

    console.log("🚀 Jadwal Synchronized via GitHub Fetch!");

  } catch (err) {
    console.error("❌ Gagal Fetch Jadwal:", err);
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<option value="">⚠️ Server Error</option>';
    });
  }
}

*/
/*
async function initAssetDropdowns() {
  const urlGAS = APPSCRIPT_URL;

  // --- FUNGSI HELPER: Menunggu elemen muncul di DOM ---
  const waitForElement = (id) => {
    return new Promise(resolve => {
      const el = document.getElementById(id);
      if (el) return resolve(el); // Jika sudah ada, langsung bungkus

      const observer = new MutationObserver(() => {
        const target = document.getElementById(id);
        if (target) {
          observer.disconnect();
          resolve(target);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  };

  try {
    console.log("⏳ Menunggu elemen DOM tersedia...");
    
    // 1. Tunggu semua elemen ID muncul secara paralel
    const [elTgl, elMaint, elAsset,elStatusJad,elStateMaint] = await Promise.all([
      waitForElement('sortJadwal'),
      waitForElement('filterStatusLog'),
      waitForElement('as_status'),
      waitForElement('filterStateJadwal'),
      waitForElement('m_state') 
    ]);

    const elements = {
      filterTgl: elTgl,
      statusMaint: elMaint,
      statusAsset: elAsset,
      filterState : elStatusJad,
      mState : elStateMaint
    };

    // 2. Set Loading Status
    Object.values(elements).forEach(el => {
      el.innerHTML = '<option value="">⏳ Loading...</option>';
    });

    // 3. Satu kali Fetch untuk semua data
    console.log("📡 Mengambil data dari GAS...");
    const response = await fetch(`${urlGAS}?action=getAssetDropdowns`);
    const data = await response.json();

    // 4. Fungsi pembantu untuk merender opsi
    const renderOptions = (el, list, defaultText) => {
      // Karena kita pakai waitForElement, el di sini pasti ada
      console.log(`Populasi: ${el.id} (${list ? list.length : 0} data)`);

      let html = `<option value="">-- ${defaultText} --</option>`;
      if (list && list.length > 0) {
        html += list.map(item => `<option value="${item.id}">${item.nama}</option>`).join('');
      }
      el.innerHTML = html;
    };

    // 5. Tebarkan data ke masing-masing dropdown
    renderOptions(elements.filterTgl, data.filterTgl, "Pilih Tanggal");
    renderOptions(elements.statusMaint, data.statusMaint, "Status Maintenance");
    renderOptions(elements.statusAsset, data.statusAsset, "Status Aset");
    renderOptions(elements.filterState, data.statusMaint, "Status Jadwal");
    renderOptions(elements.mState,data.statusMaint, "Pilih Status");

    console.log("✅ Asset Dropdowns Synchronized!");

  } catch (err) {
    console.error("❌ Gagal Fetch Dropdown Asset:", err);
    // Jika terjadi error fetch, beri tanda di UI yang tersedia
    ['sortJadwal', 'filterStatusLog', 'as_status'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<option value="">⚠️ Error Load</option>';
    });
  }
}

*/
/* ----- script lama------------------*/
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js') // Memanggil file fisik
        .then(function(reg) {
          console.log('MANTAP: ServiceWorker Aktif!', reg.scope);
        })
        .catch(function(err) {
          console.log('MANTAP: ServiceWorker Gagal:', err);
        });
    });
  }

  // Fungsi untuk memuat komponen HTML
  /**
async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        const html = await response.text();
        document.getElementById(elementId).innerHTML = html;
    } catch (error) {
        console.error('Gagal memuat komponen:', filePath, error);
    }
}
*/

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


// Jalankan fungsi saat halaman dibuka
/**
document.addEventListener("DOMContentLoaded", () => {   
    loadComponent('loginOverlay', 'loginOverlay.html'); 
    loadComponent('leftbar-placeholder', 'leftbar.html');
    loadComponent('rightbar-placeholder', 'rightbar.html');
    loadComponent('modalMaintenanceLog-placeholder', 'modalMaintenanceLog.html');    
    loadComponent('modalMaint-placeholder', 'modalMaint.html');
    loadComponent('modalDetailHist-placeholder', 'modalDetailHist.html');
    loadComponent('modalAssetDetail-placeholder', 'modalAssetDetail.html');
    loadComponent('modalPhotoSlider-placeholder','modalPhotoSlider.html'); 
    loadComponent('modalImport-placeholder','modalImport.html');
    loadComponent('modalEditUser-placeholder','modalEditUser.html');
    loadComponent('modalGlobalSearch-placeholder', 'modalGlobalSearch.html');
});
*/




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

function checkSessionAndLogin() {
  const savedUser = localStorage.getItem("userMaint");

  if (savedUser) {
    try {
      const userObj = JSON.parse(savedUser);
      loggedInUser = userObj.name;
      userRole = userObj.role;

      console.log("🔐 Sesi Ditemukan: Selamat Datang Kembali, " + loggedInUser);

      // 1. Tampilkan Konten Utama, Sembunyikan Login
      const loginOverlay = document.getElementById('loginOverlay');
      const mainContent = document.getElementById('main-content');
      
      if (loginOverlay) loginOverlay.style.display = 'none';
      if (mainContent) mainContent.style.display = 'flex';

      // 2. Update UI Header & Admin Menu
      const headerUser = document.getElementById('headerUser');
      if (headerUser) headerUser.innerText = `${loggedInUser} (${userRole})`;

      const adminArea = document.getElementById('adminMenuArea');
      if (adminArea) {
        adminArea.style.display = (userRole === 'admin') ? 'block' : 'none';
      }

      // 3. Jalankan Sinkronisasi Data (Wuzzz!)
      syncDataGhoib(); 
      showPage('history'); // Halaman default setelah login

    } catch (e) {
      console.error("Sesi Rusak, silakan login ulang.");
      localStorage.removeItem("userMaint");
      showLoginForm();
    }
  } else {
    // Jika tidak ada sesi, pastikan Form Login muncul
    console.log("👋 Tidak ada sesi. Silakan Login.");
    showLoginForm();
  }
}

// Fungsi pembantu jika butuh menampilkan form login manual
function showLoginForm() {
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.display = 'flex';
    
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.style.display = 'none';
}

/**
 * [FUNGSI: SYNC UI FOTO DENGAN FALLBACK AVATAR]
 * Jika link foto kosong, otomatis menggunakan UI-Avatar.
 */

function syncProfileUI(newUrl, isSelf) {
  var finalUrl = "";
  var timestamp = "?t=" + Date.now();

  // 1. Logika Keamanan URL
  if (newUrl && newUrl.toString().startsWith("blob:")) {
    // JIKA BLOB: Gunakan URL murni tanpa modifikasi apa pun
    finalUrl = newUrl; 
  } else if (newUrl && newUrl.toString().includes("http")) {
    // JIKA HTTP (Drive/lh3): Bersihkan parameter lama dan tambah timestamp baru
    finalUrl = newUrl.split('?')[0] + timestamp;
  } else {
    // JIKA KOSONG: Gunakan UI-Avatars
    var targetName = isSelf ? loggedInUser : (document.getElementById('m_user') ? document.getElementById('m_user').value : "User");
    finalUrl = "https://ui-avatars.com/api/?name=" + encodeURIComponent(targetName) + "&background=2980b9&color=fff";
  }
  
  // 2. Daftar Target Update
  var targets = ['admin_edit_photo']; 
  if (isSelf) {
    targets.push('user_profile_shared');
    targets.push('user_profile_mobile')
    targets.push('set_display_photo');
  }

  // 3. Eksekusi Perubahan ke DOM
  targets.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.src = finalUrl;
      el.style.opacity = "1"; // Kembalikan opacity ke normal
    }
  });

  console.log("✅ UI Sync Executed. Final URL: " + finalUrl);
}

document.addEventListener("DOMContentLoaded", async () => {   
    // Tunggu SEMUA komponen selesai terpasang di layar
    await Promise.all([
        loadComponent('loginOverlay', 'loginOverlay.html'), 
        loadComponent('leftbar-placeholder', 'leftbar.html'),
        loadComponent('rightbar-placeholder', 'rightbar.html'),
        loadComponent('modalMaintenanceLog-placeholder', 'modalMaintenanceLog.html'), // Gunakan KOMA (,)
        loadComponent('modalMaint-placeholder', 'modalMaint.html'),
        loadComponent('modalDetailHist-placeholder', 'modalDetailHist.html'),
        loadComponent('modalAssetDetail-placeholder', 'modalAssetDetail.html'),
        loadComponent('modalPhotoSlider-placeholder','modalPhotoSlider.html'), 
        loadComponent('modalImport-placeholder','modalImport.html'),
        loadComponent('modalEditUser-placeholder','modalEditUser.html'),
        loadComponent('modalGlobalSearch-placeholder', 'modalGlobalSearch.html') // Terakhir tidak perlu koma
    ]);

    console.log("✅ Semua HTML terpasang, sekarang jalankan logika.");
    
    // Baru panggil fungsi yang butuh ID dari HTML di atas
    loadCloudLogo(); 
    checkSessionAndLogin(); 
});