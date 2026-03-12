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
        sessionId: serverData.sessionId, // TOKEN SAKTI KITA
        unlockCode: serverData.unlockCode // <--- BARIS INI WAJIB ADA!
      }));

      // Update Variabel Global
      loggedInUser = u;
      userRole = serverData.role;

      // --- PERBAIKAN: Pastikan Buka Gembok Berhasil ---
      const isUnlocked = bukaGembokSakti(serverData.unlockCode);

      // UI Switch
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('main-content').style.display = 'flex';
      document.getElementById('headerUser').innerText = `${u} (${userRole})`;
      checkSessionAndLogin();

      // Jalankan fungsi awal
      //await syncDataGhoib();
      showPage('history');
      await populateAllDropdowns(); // Pastikan dropdown juga terisi setelah login
      loadProf();
      
      Swal.fire({ title: "Berhasil!", text: "Sesi aman diaktifkan", icon: "success", timer: 1500, showConfirmButton: false });
      updateLockStatus(false);

    } else {
      //throw new Error(res.data.message || "Gagal Login");
      // GANTI: throw new Error(res.data.message || "Gagal Login");

        // MENJADI:
        return Swal.fire({
        title: "Akses Ditolak!",
        text: res.data.message || "Username atau Password salah, Señor!",
        icon: "error",
        background: "#0f172a", // Deep Blue
        color: "#fff",
        confirmButtonColor: "#7a00ff", // Ungu Neon
        width: '80%'
        });
      
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
  //localStorage.removeItem("user_theme_stealth"); // Opsional jika ingin reset tema

  // 2. HANCURKAN DATA DI RAM (PENTING!)
  window.APP_STORE_BLOB = null;
  window._LOCKED_BLOB = null;
  window.DATA_READY = null; // Jika ada sisa cache
  
  console.log("🧨 RAM Purged: Semua data ghoib telah dihancurkan.");

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
  updateLockStatus(true);

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

  // 3. TENDANG KE HALAMAN LOGIN
  location.reload(); // Hard reset untuk memastikan memori benar-benar bersih
  console.log("🧹 Logout Sukses: Sesi dibersihkan.");
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


async function checkSessionAndLogin() {
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
      //await syncDataGhoib(); 
      await showPage('history'); // Halaman default setelah login
      //loadProf();

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


function toggleThemeMenu() {
    const menu = document.getElementById('themeMenu');
    if (menu) menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

function setTheme(themeName) {
    const overlay = document.getElementById('loginOverlay');
    if (!overlay) return;

    overlay.setAttribute('data-theme', themeName);
    
    // Simpan ke memori browser
    localStorage.setItem('user_theme_stealth', themeName);

    // Update Icon Utama
    const icon = document.getElementById('currentThemeIcon');
    if (themeName === 'light') icon.className = 'fas fa-sun';
    else if (themeName === 'dark') icon.className = 'fas fa-moon';
    else icon.className = 'fas fa-user-secret';

    // Tutup menu
    const menu = document.getElementById('themeMenu');
    if (menu) menu.style.display = 'none';
}


// Jalankan otomatis saat halaman dimuat (Auto-Restore)
(function() {
    setTimeout(() => {
        const saved = localStorage.getItem('user_theme_stealth') || 'deep-blue';
        setTheme(saved);
    }, 500); // Tunggu component load
})();