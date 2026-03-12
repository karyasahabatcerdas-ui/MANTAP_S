
// --- HANDLE KLIK FLOATING PROFIL ---
function handleMobileToggle() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('mobile-toggle-wrapper');
  
  // Toggle class untuk Sidebar dan Tombol secara bersamaan
  const isOpen = sidebar.classList.toggle('mobile-open');
  toggleBtn.classList.toggle('mobile-toggle-active', isOpen);

  // Efek Haptic/Suara jika ada
  if (isOpen && typeof speakSenor === 'function') {
    speakSenor("Menu Aktif");
  }
}

// --- OPTIONAL: TUTUP OTOMATIS SETELAH PILIH MENU ---
// Modifikasi fungsi showPage Anda sedikit:
// Di dalam function showPage(id) { ... } tambahkan di baris akhir:
// if (window.innerWidth <= 768) handleMobileToggle();
let touchstartX = 0;
let touchendX = 0;

document.addEventListener('touchstart', e => {
  // Hanya rekam start jika jempol mulai dari pinggir kiri (khusus buka)
  touchstartX = e.changedTouches[0].screenX;
}, {passive: true});

document.addEventListener('touchend', e => {
  touchendX = e.changedTouches[0].screenX;
  handleSwipe();
}, {passive: true});

function handleSwipe() {
  const sidebar = document.getElementById('leftbar'); // Pastikan ID sesuai
  const diffX = touchendX - touchstartX;

  if (Math.abs(diffX) > 80) { // Threshold 80px biar lebih responsif di HP
    
    if (diffX > 0 && touchstartX < 60) { 
      // SWIPE KANAN (Buka)
      sidebar.classList.add('active');
      sidebar.classList.remove('collapsed'); // Pastikan lebar penuh
      if (navigator.vibrate) navigator.vibrate(15);
      createOverlay(); // Munculkan background gelap
      console.log("➡️ Menu Terbuka");
    } 
    else if (diffX < 0 && sidebar.classList.contains('active')) {
      // SWIPE KIRI (Tutup)
      sidebar.classList.remove('active');
      removeOverlay(); // Hapus background gelap
      console.log("⬅️ Menu Tertutup");
    }
  }
  // Reset koordinat agar tidak "nyangkut" untuk swipe berikutnya
  touchstartX = 0;
  touchendX = 0;
}


/**
let touchStartX = 0;
let touchEndX = 0;

// 1. Inisialisasi Area Pemicu
document.addEventListener("DOMContentLoaded", () => {
    const zone = document.createElement('div');
    zone.className = 'swipe-trigger-zone';
    document.body.appendChild(zone);

    // Event Sentuhan
    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, false);

    document.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeLogic();
    }, false);
});

// 2. Logika Geser (Swipe)
function handleSwipeLogic() {
    const leftbar = document.getElementById('leftbar');
    const distance = touchEndX - touchStartX;
    const threshold = 80; // Jarak minimal geser (pixel)

    // SWIPE KANAN (Buka dari pinggir kiri < 50px)
    if (distance > threshold && touchStartX < 50) {
        openSidebar();
    } 
    // SWIPE KIRI (Tutup saat sidebar sedang terbuka)
    else if (distance < -threshold && leftbar.classList.contains('active')) {
        closeSidebar();
    }
}

// 3. Fungsi Kontrol Sidebar
function openSidebar() {
    const lb = document.getElementById('leftbar');
    lb.classList.remove('collapsed'); // BUANG INI agar sidebar melebar
    lb.classList.add('active');
    if (navigator.vibrate) navigator.vibrate(15); // Getar halus (Haptic)
    createOverlay();
}

function closeSidebar() {
    const lb = document.getElementById('leftbar');
    lb.classList.remove('active');
    removeOverlay();
}

function toggleleftbar() {
    const lb = document.getElementById('leftbar');
    (lb.classList.contains('active')) ? closeSidebar() : openSidebar();
}

// 4. Overlay (Agar layar belakang gelap saat menu buka)
function createOverlay() {
    if (document.getElementById('side-ov')) return;
    const ov = document.createElement('div');
    ov.id = 'side-ov';
    ov.style = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);backdrop-filter:blur(2px);z-index:2800;";
    ov.onclick = closeSidebar;
    document.body.appendChild(ov);
}

function removeOverlay() {
    const ov = document.getElementById('side-ov');
    if (ov) ov.remove();
}
*/