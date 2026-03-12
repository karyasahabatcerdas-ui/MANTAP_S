
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


let touchStartX = 0;
let touchEndX = 0;

// 1. FUNGSI SWIPE GESTURE
document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, false);

function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    const leftbar = document.getElementById('leftbar');
    
    // Swipe Kanan (Buka Sidebar) - Jarak minimal 100px
    if (swipeDistance > 100 && touchStartX < 50) { 
        leftbar.classList.remove('collapsed');
        console.log("📱 Swipe Right: Sidebar Open");
    }
    // Swipe Kiri (Tutup Sidebar)
    else if (swipeDistance < -100) {
        leftbar.classList.add('collapsed');
        console.log("📱 Swipe Left: Sidebar Collapsed");
    }
}