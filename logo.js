/**
 * [FUNGSI CLIENT: LOAD LOGO DARI CLOUD]
 * Memuat logo aplikasi dari database Google Sheets
 */

function loadCloudLogo() {
  google.script.run
    .withSuccessHandler(function(res) {
      const img = document.getElementById('appLogo');
      
      // Jika logo ditemukan di database
      if (img && res && res.logo && res.logo !== "") {
        img.src = res.logo;
        console.log("🎨 Logo Berhasil Dimuat: " + res.logo);
      } else {
        // Jika kolom logo kosong, gunakan placeholder agar UI tidak rusak
        if(img) img.src = "https://via.placeholder.com/300x250/000000/FFF?text=Karya+Sahabat+Cemerlang";
      }
    })
    .withFailureHandler(async function(err) {
      // Error handling jika gagal akses server saat startup
      console.error("Gagal memuat logo: ", err);
      
      await Swal.fire({
        title: "Koneksi Lemah",
        text: "Gagal memuat konfigurasi logo dari server.",
        icon: "warning",
        confirmButtonText: "Tetap Masuk",
        width: '80%'
      });
      
      // Tetap tarik ke fullscreen setelah user klik OK
      //activateFullscreen();
    })
    .getAppSettings();
}

// Jalankan saat startup
loadCloudLogo();