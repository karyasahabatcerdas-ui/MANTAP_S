/** 
function login() {
    // Gunakan try-catch agar jika satu ID tidak ketemu, yang lain tidak mati
    try {
        // 1. UI Reset - Pastikan ID loginOverlay ada di HTML
        const overlay = document.getElementById('loginOverlay');
        if (overlay) overlay.style.display = 'none';

        // 2. Load Data dari Server (GitHub to GAS)
        //initAllJadwalDropdowns();
        
        //loadAssetTypes();
        //initAssetDropdowns();      

        // 3. Navigasi
        //showPage('history');

        // 4. Identity Management
        window.loggedInUser = "admin1"; 
        window.userRole = "admin"; 
        
        const leftbar = document.getElementById('leftbar');
        if (leftbar) leftbar.classList.remove('collapsed');

        const headerUser = document.getElementById('headerUser');
        if (headerUser) {
            // Pastikan variabel 'u' (username) sudah didefinisikan sebelumnya
            headerUser.innerText = loggedInUser + " (" + userRole + ")";
        }

        console.log("✅ Login Success & UI Initialized.");

    } catch (error) {
        console.error("❌ Error saat login initialization:", error);
    }
}

*/




// Pastikan ini ada di bagian paling atas tag <script>



/**
 * [FUNGSI: SIMPAN PROFIL MANDIRI]
 * Digunakan oleh user untuk mengupdate profilnya sendiri.
 */
/*
async function saveProf() {
  const displayPhoto = document.getElementById('set_display_photo');
  const btn = document.getElementById('btnsaveprofile');

  // 1. Susun Payload (Gunakan properti 'payload' agar terbaca 'p' di server)
  var requestData = {
    action: "universalUpdateUser",
    payload: {
      adminAktif: typeof loggedInUser !== 'undefined' ? loggedInUser : document.getElementById('set_user').value,
      row: "", 
      username: document.getElementById('set_user').value,
      phone:    document.getElementById('set_phone').value,
      email:    document.getElementById('set_email').value,
      pass:     document.getElementById('set_pass').value,
      photoData: null,
      photoUrl:  displayPhoto.src.includes("blob:") ? "" : displayPhoto.src.split('?')[0]
    }
  };

  // 2. Proses Foto jika ada
  if (window.Temp_Profile && window.Temp_Profile[0]) {
    try {
      const fileInfo = await getBase64(window.Temp_Profile[0]); 
      requestData.payload.photoData = fileInfo.base64; 
      requestData.payload.mimeType = fileInfo.mimeType;
      requestData.payload.fileName = "Profile_" + requestData.payload.username; 
    } catch (e) {
      return Swal.fire("Gagal", "Proses foto error: " + e.message, "warning");
    }
  }

  // 3. UI Loading
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Menyimpan...";
  }

  // 4. KIRIM VIA FETCH
  try {
    const response = await fetch(APPSCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(requestData)
    });

    const res = await response.json(); // Server mengembalikan {status: "success", message: "..."}

    Swal.fire({ title: "¡Misión Cumplida!", text: res.message, icon: "success" });
    
    window.Temp_Profile = [null, null]; 
    if (typeof syncProfileUI === 'function') syncProfileUI(displayPhoto.src, true); 
    loadProf(); 

  } catch (err) {
    Swal.fire("Gagal", err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "<i class='fa fa-floppy-o'></i> SIMPAN PERUBAHAN";
    }
  }
}
*/

/**
 * [FUNGSI: EKSPOR DATA KE CSV]
 * Mengunduh daftar pengguna dalam format CSV melalui browser.
 */
/*
async function downloadCSV() {
  try {
    Swal.fire({ title: 'Menyiapkan CSV...', didOpen: () => Swal.showLoading() });

    // Panggil action via GET
    const response = await fetch(`${APPSCRIPT_URL}?action=exportUsersToCSV`);
    
    // Server Anda mengembalikan Base64 atau Teks? 
    // Jika server mengembalikan base64 dalam JSON:
    const base64Content = await response.text(); 
    
    // Jika data dari server adalah base64 murni, kita decode
    const csvData = atob(base64Content);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    const tgl = new Date().toLocaleDateString().replace(/\//g, '-');
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Data_User_MANTAP_${tgl}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    Swal.fire("Berhasil", "Data CSV berhasil diunduh", "success");
  } catch (err) {
    Swal.fire("Gagal", "Error: " + err.message, "error");
  }
}
*/
/**
 * [FUNGSI: UPLOAD FOTO OLEH ADMIN]
 * Menggunakan logika asli Anda dengan proteksi opacity & Sinkronisasi instan.
 */



/**
 * [FUNGSI: SIMPAN ADMIN EDIT]
 * Menangani Tambah User Baru (jika row kosong) atau Update User (jika row ada).
 */
/*
async function saveAdminEdit() {
  const rowIdx = document.getElementById('m_row_idx').value;
  const username = document.getElementById('m_user').value;
  const displayPhoto = document.getElementById('admin_edit_photo');
  const btn = document.getElementById('saveprofilmodal');

  if (!username) return Swal.fire("Waduh!", "Username wajib diisi, Señor!", "warning");

  // 1. Susun Request (Gunakan label 'payload' agar nyambung ke 'p' di doPost)
  let requestData = {
    action: "universalUpdateUser",
    payload: {
      adminAktif: typeof loggedInUser !== 'undefined' ? loggedInUser : "", 
      row:      rowIdx, 
      username: username,
      pass:     document.getElementById('m_pass').value,
      role:     document.getElementById('m_role').value,
      phone:    document.getElementById('m_phone').value,
      email:    document.getElementById('m_email').value,
      status:   document.getElementById('m_status').value,
      attempts: document.getElementById('m_attempts').value || 0,
      photoUrl: displayPhoto.src.includes("blob:") || displayPhoto.src.includes("ui-avatars.com") ? "" : displayPhoto.src.split('?')[0],
      photoData: null
    }
  };

  // 2. Cek Foto Baru di Temp_Profile[1]
  if (window.Temp_Profile && window.Temp_Profile[1]) {
    try {
      const fileInfo = await getBase64(window.Temp_Profile[1]);
      requestData.payload.photoData = fileInfo.base64;
      requestData.payload.mimeType = fileInfo.mimeType;
      requestData.payload.fileName = "Profile_" + username;
    } catch (e) {
      console.error("Gagal memproses foto:", e);
    }
  }

  // 3. UI Loading & Opacity
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Menyimpan...";
  }
  if (displayPhoto) displayPhoto.style.opacity = "0.3";

  // 4. EKSEKUSI FETCH
  try {
    const response = await fetch(APPSCRIPT_URL, {
      method: "POST",
      cache: "no-cache",
      body: JSON.stringify(requestData)
    });

    const res = await response.json(); // Server return {status: "success", message: "..."}

    if (res.status === "error") throw new Error(res.message);

    // 5. SUCCESS HANDLER
    Swal.fire({
      title: "¡Misión Cumplida!",
      text: res.message || "Data user berhasil diperbarui.",
      icon: "success",
      confirmButtonText: "OK, Señor!"
    });

    if (window.Temp_Profile) window.Temp_Profile[1] = null; 
    
    closeModal();    
    if (typeof loadUserList === 'function') loadUserList();  
    
    // Sinkronisasi UI Global
    const isSelf = (username.toLowerCase() === loggedInUser.toLowerCase());
    if (typeof syncProfileUI === 'function') syncProfileUI(displayPhoto.src, isSelf);

  } catch (err) {
    Swal.fire("Gagal", "Error Server: " + err.message, "error");
  } finally {
    // 6. KEMBALIKAN UI
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "<i class='fa fa-floppy-o'></i> SIMPAN PERUBAHAN";
    }
    if (displayPhoto) displayPhoto.style.opacity = "1";
  }
}
*/