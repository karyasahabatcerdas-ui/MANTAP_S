
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


///========================================
// --- DETEKSI SWIPE (Kiri ke Kanan) ---
let touchstartX = 0;
let touchendX = 0;

document.addEventListener('touchstart', e => {
  touchstartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', e => {
  touchendX = e.changedTouches[0].screenX;
  handleSwipe();
});

// Update fungsi Swipe agar tombol ikut menyala/mati
function handleSwipe() {
  const leftbar = document.getElementById('leftbar');
  //const toggleBtn = document.getElementById('mobile-toggle-wrapper');
  const diffX = touchendX - touchstartX;

  if (Math.abs(diffX) > 100) { // Threshold minimal geseran 100px
    if (diffX > 0) { // Swipe Kanan (Buka)
      leftbar.classList.add('mobile-open');
      //toggleBtn.classList.add('mobile-toggle-active');
    } else { // Swipe Kiri (Tutup)
      leftbar.classList.remove('mobile-open');
      //toggleBtn.classList.remove('mobile-toggle-active');
    }
  }
}

