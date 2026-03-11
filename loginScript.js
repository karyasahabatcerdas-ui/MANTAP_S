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
    Swal.fire({ title: "Ops!", text: "Isi Username & Password", icon: "error", width: '80%' });
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = "Autentikasi...";
  }

  try {
    const response = await fetch(APPSCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: "checkLogin",
        payload: { username: u, password: p }
      })
    });

    const res = await response.json();

    if (btn) {
      btn.disabled = false;
      btn.innerText = "Login";
    }

    if (res.status === "success" && res.data.success) {
      const dataUser = res.data;
      loggedInUser = u;
      userRole = dataUser.role.toLowerCase().trim();

      // --- SIMPAN SESI (PENTING!) ---
      localStorage.setItem("userMaint", JSON.stringify({ name: u, role: userRole }));

      // --- LOGIKA UI LEVEL ---
      const adminArea = document.getElementById('adminMenuArea');
      if (adminArea) {
        adminArea.style.display = (userRole === 'admin') ? 'block' : 'none';
      }

      // --- SYNC FOTO (Ambil dari dataUser jika ada, atau fetch ulang) ---
      // Kita asumsikan fungsi getLatestPhotoUrl juga dipindah ke doPost nanti
      const fixAvatar = `https://ui-avatars.com{encodeURIComponent(u)}&background=2980b9&color=fff`;
      syncProfileUI(fixAvatar, true);

      // UI Switch
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('main-content').style.display = 'flex'; // Munculkan konten utama
      document.getElementById('headerUser').innerText = `${u} (${userRole})`;
      
      Swal.fire({ title: "Berhasil!", text: "Selamat Datang, " + u, icon: "success", timer: 1500, showConfirmButton: false });
      
      showPage('history');
      syncDataGhoib(); // Sedot data setelah login sukses

    } else {
      throw new Error(res.message || res.data.message || "Gagal Login!");
    }

  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Login";
    }
    console.error("Login Error:", err);
    Swal.fire({ title: "Gagal Login", text: err.message, icon: "warning", width: '80%' });
  }
}


/**
 * [FUNGSI: LOGOUT & PEMBERSIHAN TOTAL]
 * Menambahkan pencatatan aktivitas ke Log Book di server.
 */
function logout() {

  if (loggedInUser) {
    //console.log("Mencatat logout untuk: " + loggedInUser);
    // Kita gunakan google.script.run tanpa handler karena user sudah berpindah halaman
    google.script.run.processLogout(loggedInUser);
  }

  var overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.style.display = 'flex';
 
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.add('collapsed');
 
  var pages = document.getElementsByClassName('page');
  if (pages) {
    for (var i = 0; i < pages.length; i++) {
      pages[i].classList.add('hidden');
      pages[i].style.display = 'none';
    }
  }

  var adminArea = document.getElementById('adminMenuArea');
  if (adminArea) {
    adminArea.style.display = 'none';
  }

  // 1. Kosongkan isian Form Login
  document.getElementById('user').value = "";
  document.getElementById('pass').value = "";
 
  // 2. Reset Status Global
  loggedInUser = "";
  userRole = "";

  // 3. Bersihkan Sisa Foto di UI (Kembalikan ke inisial Guest)
  var guestAvatar = "https://lh3.googleusercontent.com/d/13Q4RtDMmEMVvErifoZOa_yKiAACUpg7a=s1000";
  var imgIds = ['user_profile_shared', 'set_display_photo', 'admin_edit_photo', "user_profile_mobile"];
  imgIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.src = guestAvatar;
  });

  // 4. Kosongkan Data Tabel (Cache Data Sensitif)
  var tableIds = ['userListBody', 'histBody', 'jadwalBody', 'kelolaBody', 'logTableBody'];
  tableIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  // 5. Bersihkan Cache daftar Type Asset
  cachedAssetTypes = null; 

 // console.log("🧹 Logout Success: Log dicatat & memori browser dibersihkan.");
}

/**=========================================================
 * Mengisi SEMUA Dropdown ID Jadwal via Fetch (GitHub Mode)
 * ============================================================
 */
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
async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        const html = await response.text();
        document.getElementById(elementId).innerHTML = html;
    } catch (error) {
        console.error('Gagal memuat komponen:', filePath, error);
    }
}

// Jalankan fungsi saat halaman dibuka
document.addEventListener("DOMContentLoaded", () => {    
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
