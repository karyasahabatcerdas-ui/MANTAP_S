
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

// EKSEKUSI SAAT SEMUA SIAP
window.onload = function() {
    // Jika ingin langsung login otomatis saat refresh (untuk dev):
    login(); 
    
    // Atau pasang listener ke form login asli
    console.log("🖥️ System Ready.");
};
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



// Pastikan ini ada di bagian paling atas tag <script>
window.Temp_Profile = [null,null]; 

// --- 2. HELPER FUNCTION (Letakkan di sini agar bisa diakses semua fungsi) ---
const getBase64 = (file) => new Promise((resolve, reject) => {
  if (!file) return reject("Tidak ada file untuk diproses");
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve({
    // Kita ambil indeks [1] untuk membuang header "data:image/png;base64,"
    base64: reader.result.split(',')[1], 
    mimeType: file.type
  });
  reader.onerror = error => reject(error);
});
/**
 * [FUNGSI: UPLOAD FOTO PROFIL MANDIRI] =============================================================================================================================================
 * Memastikan opacity kembali ke 1 baik saat sukses maupun gagal.
 */
function uploadOwnPhoto(input) {
  const file =input.files[0];
  if (file) {
    // 1. Simpan file asli ke dalam array (untuk kebutuhan upload nanti)
    window.Temp_Profile[0] = file; 

    // 2. Buat URL sementara untuk pratinjau
    const pratinjauUrl = URL.createObjectURL(file);

    // 3. Tampilkan langsung di elemen <img> yang memicu fungsi ini
    // Catatan: Jika inputElemen adalah <input type="file">, 
    // kita perlu mencari elemen <img> yang terkait.
    document.getElementById("set_display_photo").src = pratinjauUrl;

    //console.log("File tersimpan sementara -name :", file.name);
    //console.log("File tersimpan sementara - temp profile :", Temp_Profile[0]);
  }

}

// Fungsi Pembantu untuk Payload (Update/Add)
async function preparePayload(rowValue, usernameValue) {
  let payload = {
    adminAktif: loggedInUser, // PIC yang bertanggung jawab
    roleAktor: userRole,      // Peran PIC saat ini
    row: rowValue,
    username: usernameValue,
    pass: document.getElementById('m_pass').value,
    role: document.getElementById('m_role').value,
    phone: document.getElementById('m_phone').value,
    email: document.getElementById('m_email').value,
    status: document.getElementById('m_status').value,
    photoUrl: document.getElementById('admin_edit_photo').src,
    photoData: null
  };

  // Cek jika ada foto baru
  if (window.Temp_Profile && window.Temp_Profile[1]) {
    const fileInfo = await getBase64(window.Temp_Profile[1]);
    payload.photoData = fileInfo.base64;
    payload.mimeType = fileInfo.mimeType;
  }
  return payload;
}


/**
 * [FUNGSI: SIMPAN PROFIL MANDIRI]
 * Digunakan oleh user untuk mengupdate profilnya sendiri.
 */
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


/**
 * [FUNGSI: EKSPOR DATA KE CSV]
 * Mengunduh daftar pengguna dalam format CSV melalui browser.
 */
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

/**
 * [FUNGSI: UPLOAD FOTO OLEH ADMIN]
 * Menggunakan logika asli Anda dengan proteksi opacity & Sinkronisasi instan.
 */

function uploadPhotoFromAdmin(input) {
  const file = input.files[0];
  
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
        Swal.fire({
          title: "File Gendut!",
          text: "File terlalu besar! Maksimal 2MB.", // Ini isi pesan 
          icon: "warning",
          confirmButtonText: "OK, Señor!",
          width: '80%' // Biar pas di layar HP Sultan
        });
    //alert("File terlalu besar! Maksimal 2MB.");
    input.value = "";
    return;
  }

  if (file) {    
    // Pastikan variabelnya ada sebelum diisi
    if (!window.Temp_Profile) window.Temp_Profile = [null, null];
    
    window.Temp_Profile[1] = file; // Simpan di indeks 1 sesuai kode Save Anda
    
    // Preview
    document.getElementById("admin_edit_photo").src = URL.createObjectURL(file);
  }
}


/**
 * [FUNGSI: SIMPAN ADMIN EDIT]
 * Menangani Tambah User Baru (jika row kosong) atau Update User (jika row ada).
 */
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
