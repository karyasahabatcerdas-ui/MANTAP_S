async function loadCloudLogo() {
  const img = document.getElementById('appLogo');
  const imgB = document.getElementById('appLogoSecondary'); // Jika ada logo kedua

  try {
    const response = await fetch(APPSCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: "getAppSettings"
      })
    });

    const res = await response.json();

    // Jika server membalas dengan sukses
    if (res.status === "success" && res.data) {
      const settings = res.data;
      
      if (img && settings.logo) {
        img.src = settings.logo;
        console.log("🎨 Logo Utama Dimuat: " + settings.logo);
      }
      
      if (imgB && settings.logo_b) {
        imgB.src = settings.logo_b;
      }
    } else {
      throw new Error("Logo tidak ditemukan di database");
    }

  } catch (err) {
    console.error("Gagal memuat logo: ", err);
    
    // Gunakan Placeholder jika gagal agar UI tidak "pecah" (gambar silang)
    if (img) img.src = "https://via.placeholder.com/300x250/000000/FFF?text=Karya+Sahabat+Cemerlang";
    
    Swal.fire({
      title: "Koneksi Lemah",
      text: "Gagal memuat konfigurasi logo dari server.",
      icon: "warning",
      confirmButtonText: "Tetap Masuk",
      width: '80%'
    });
  }
}

// Jalankan saat startup
loadCloudLogo();


/** FUNGSI LOGO MASA DEPAN SIMPAN DI CHACHE */
/**

async function loadCloudLogo() {
  const img = document.getElementById('appLogo');
  
  // 1. CEK DULU DI CACHE (LOCAL STORAGE)
  const cachedLogo = localStorage.getItem("app_logo_cache");
  if (cachedLogo && img) {
    img.src = cachedLogo; // Tampilkan logo lama dulu biar gak kosong
    console.log("🚀 Memuat logo dari Cache...");
  }

  try {
    // 2. TETAP TARIK DARI SERVER (UNTUK UPDATE JIKA LOGO BERUBAH)
    const response = await fetch(APPSCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "getAppSettings" })
    });

    const res = await response.json();

    if (res.status === "success" && res.data.logo) {
      const newLogo = res.data.logo;
      
      // 3. JIKA LOGO BERBEDA DENGAN CACHE, UPDATE TAMPILAN & SIMPAN KE CACHE
      if (newLogo !== cachedLogo) {
        if (img) img.src = newLogo;
        localStorage.setItem("app_logo_cache", newLogo);
        console.log("✅ Logo diperbarui & disimpan ke Cache.");
      }
    }
  } catch (err) {
    console.error("Gagal sinkron logo terbaru:", err);
    // Jika cache kosong dan server gagal, baru pakai placeholder
    if (!cachedLogo && img) {
      img.src = "https://via.placeholder.com";
    }
  }
}

 * 
 */