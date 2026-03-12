// Script Toggle leftbar
function toggleleftbar() {
  // Mengambil elemen berdasarkan class
  const side = document.querySelector(".leftbar-container");
  const btn = document.getElementById("btn-toggle");
  
  side.classList.toggle("collapsed");

  const isCollapsed = side.classList.contains("collapsed");
  btn.innerText = isCollapsed ? ">>>" : "<<<";

    //initAssetDropdowns();
}

/**=====================================================================================
 * FUNGSI UTAMA NAVIGASI: Industrial Stealth Edition
 * Sinkron dengan ID 'leftbar' & Sistem Page
 * - Menambahkan efek visual LED flash & hentakan untuk feedback klik
 * - Menambahkan security check untuk halaman admin-only (log_book, aset, db_manager)
 * - Memperbaiki logika active state pada menu item untuk memastikan hanya satu yang aktif
 * - Menambahkan transisi halaman yang lebih halus dengan class 'hidden' dan display toggle
 * - Menambahkan logika pemanggilan data yang lebih aman dengan try-catch dan mapping fungsi
 * ======================================================================================
 */
function showPage(id) {
  console.log("🛠️ Membuka halaman: " + id);

  // --- 1. EFEK VISUAL: LED FLASH & HENTAKAN (Hanya jika ID Leftbar benar) ---
  const side = document.getElementById('leftbar'); // Update ke ID baru
  if (side) {
    side.classList.add('side-glow-flash');
    side.style.transform = "translateX(4px)"; // Hentakan tipis ke kanan
    
    setTimeout(() => {
      side.classList.remove('side-glow-flash');
      side.style.transform = "translateX(0px)";
    }, 500);
  }

  // --- 2. SECURITY CHECK (ADMIN ONLY) ---
  // Menambahkan 'log_book', 'aset', dan 'db_manager' ke daftar terproteksi
  const adminPages = ['kelola', 'm_user', 'aset', 'log_book', 'db_manager'];
  if (adminPages.includes(id) && typeof userRole !== 'undefined' && userRole !== 'admin') {
    if (typeof speakSenor === 'function') speakSenor("Akses ditolak, Señor!");
    alert("⛔ Akses Terbatas: Menu ini hanya untuk Administrator.");
    return;
  }

  // --- 3. UPDATE ACTIVE STATE PADA MENU ITEM ---
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  
  // Mencari menu item berdasarkan id yang dipassing di onclick
  const activeBtn = document.querySelector(`.menu-item[onclick*="'${id}'"]`) || 
                    document.querySelector(`.menu-item[onclick*='"${id}"']`);
  if (activeBtn) activeBtn.classList.add('active');

  // --- 4. TRANSISI HALAMAN (HIDE & SHOW) ---
  const allPages = document.querySelectorAll('.page');
  allPages.forEach(p => {
    p.classList.add('hidden');
    p.style.display = 'none'; 
  });

  const targetPage = document.getElementById('page_' + id);
  if (targetPage) {
    targetPage.classList.remove('hidden');
    targetPage.style.display = 'block';
    
    // Scroll otomatis ke atas saat pindah halaman
    const rightContent = document.querySelector('.inner-content');
    if(rightContent) rightContent.scrollTop = 0;
  } else {
    console.error(`❌ Page ID "page_${id}" tidak ditemukan di DOM!`);
    return;
  }

  // --- 5. LOGIKA PEMANGGILAN DATA (ANTI-CRASH) ---
  try {
    const actions = {
      'history': () => typeof loadHist === 'function' && loadHist(),
      'jadwal': () => {
         if (typeof loadJad === 'function') loadJad();
         //handleJadwalDropdown(); // Fungsi pembantu untuk dropdown
      },
      'kelola': () => typeof loadKel === 'function' && loadKel(),
      'm_user': () => typeof loadUserList === 'function' && loadUserList(),
      'setting': () => typeof loadProf === 'function' && loadProf(),
      'log_book': () => typeof loadAuditLogs === 'function' && loadAuditLogs(),
      'aset': () => typeof loadAssetTypes === 'function' && loadAssetTypes(),
      'lihat_aset': () => typeof loadAssetTypesView === 'function' && loadAssetTypesView(),
      'maintenance': () => typeof showMaintenancePage === 'function' && showMaintenancePage()
      
    };

    if (actions[id]) actions[id]();
    if (typeof closeSidebar === 'function') closeSidebar();

  } catch (err) {
    console.error(`⚠️ Terjadi kesalahan saat memuat data [${id}]:`, err);
  }
}


function updateLockStatus(isLocked) {
    const img = document.getElementById('user_profile_shared');
    if (!img) return;

    if (isLocked) {
        // Efek Terkunci: Foto jadi Hitam Putih & Border Abu-abu
        img.style.filter = "grayscale(100%) brightness(0.5)";
        img.style.borderColor = "#475569"; 
        img.style.boxShadow = "none";
    } else {
        // Efek Terbuka: Foto Normal & Hijau Glowing
        img.style.filter = "none";
        setSecurityGlow('success'); 
    }
}


/**
 * [CLIENT: PENGENDALI GLOW PROFIL]
 * Mengubah aura foto profil sesuai status keamanan data
 * [HELPER: PENGENDALI AURA FOTO PROFIL]
 * Mengubah warna pendaran border foto sesuai status keamanan
 */
function setSecurityGlow(status) {
    const img = document.getElementById('user_profile_shared');
    if (!img) return;

    // Reset Class
    img.classList.remove('sync-warning', 'sync-error');

    if (status === 'processing') {
        img.classList.add('sync-warning'); // Kuning Kedip
    } else if (status === 'error') {
        img.classList.add('sync-error');   // Merah Diam
    } else {
        // Hijau (Default dari CSS)
        img.style.borderColor = "#22c55e";
        img.style.boxShadow = "0 0 15px rgba(34, 197, 94, 0.4)";
    }
}

