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
      //await syncDataGhoib();
      showPage('history');
      await populateAllDropdowns(); // Pastikan dropdown juga terisi setelah login
      
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
      await syncDataGhoib(); 
      //await showPage('history'); // Halaman default setelah login

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

