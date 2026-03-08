
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

  // Fungsi untuk memuat komponen HTML
async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        const html = await response.text();
        document.getElementById(elementId).innerHTML = html;
    } catch (error) {
        console.error('Gagal memuat komponen:', filePath, error);
    }
}

// Jalankan fungsi saat halaman dibuka
document.addEventListener("DOMContentLoaded", () => {    
    loadComponent('leftbar-placeholder', 'leftbar.html');
    loadComponent('rightbar-placeholder', 'rightbar.html');
    loadComponent('modalMaintenanceLog-placeholder', 'modalMaintenanceLog.html');    
    loadComponent('modalMaint-placeholder', 'modalMaint.html');
    loadComponent('modalDetailHist-placeholder', 'modalDetailHist.html');
    loadComponent('modalAssetDetail-placeholder', 'modalAssetDetail.html');
    loadComponent('modalPhotoSlider-placeholder','modalPhotoSlider.html'); 
    loadComponent('modalImport-placeholder','modalImport.html');
    loadComponent('modalEditUser-placeholder','modalEditUser.html');
    loadComponent('modalGlobalSearch-placeholder', 'modalGlobalSearch.html');
});

// Simpan URL Iframe GAS untuk referensi di fungsi lain (opsional, tergantung kebutuhan navigasi)
const urlGAS = APPSCRIPT_URL;
  let cachedAssetTypes = null; 
  //let loggedInUser = "";
  //let userRole = "";
  let update_man_status ="";

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

// Variabel Global
currentCategory = '';  // deteksi kamera QR atau QR
html5QrCode = null; // Instance Html5Qrcode untuk scan file QR
currentMaintData = null; // { maint_id, as_id, nama_aset, lokasi, jenis_jadwal }
tempPhotos = { PB: [], PO: [], PA: [], PC: [] }; // Menyimpan foto sementara sebelum submit
update_man_status = false; // Menandakan apakah sedang dalam mode UPDATE (Pending) atau INPUT Baru
let isSuccessSave = false; // Status global untuk menandai apakah log berhasil disimpan atau pending
// 1. Inisialisasi awal (Wajib di luar fungsi)
let allHistoryData = []; //variabel global untuk menyimpan data log history mentah dari server

let activeRowData = []; // Global variable
// Global variable untuk simpan data sementara
let dataToImport = []; // Memory penampung sementara
let lastValidatedData = []; 

/**=========================================================================
 * [FUNGSI CLIENT GITHUB: LOAD TIPE ASET]
 * Sekali ambil dari server (fetch), semua dropdown tipe aset langsung sinkron via Cache.
 * ==========================================================================
 */
async function loadAssetTypes() {
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;

  // 1. Jika cache sudah ada di memori browser GitHub, langsung pakai
  if (cachedAssetTypes) {
    renderAllTypeDropdowns(cachedAssetTypes);
    return;
  }

  // 2. Jika belum ada, ambil dari server (GAS)
  try {
    const response = await fetch(`${urlGAS}?action=getAssetTypes`);
    const types = await response.json(); // Mengambil array tipe aset

    if (types && types.length > 0) {
      cachedAssetTypes = types; // Simpan ke cache global GitHub
      renderAllTypeDropdowns(types); // Sebar ke semua dropdown (filter, modal, dll)
      console.log("📥 Data Tipe Aset Baru Diterima & Disinkronkan.");
    }
  } catch (err) {
    console.error("Gagal memuat tipe aset:", err);
  }
}


/**=========================================================================
 * [FUNGSI PEMBANTU: SEBAR DATA KE SEMUA DROPDOWN]
 * Menghindari penulisan berulang untuk setiap ID dropdown.
 * Menerima array tipe aset dan mengisi semua dropdown yang relevan dengan opsi baru.
 * ==========================================================================
 */
function renderAllTypeDropdowns(types) {
  // Daftar ID dropdown yang harus diisi
  const dropdownIds = ['assetTypeSelect', 'viewAssetTypeSelect', 'filterType', 'm_type'];
  
  dropdownIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return; // Lewati jika elemen tidak ada di halaman saat ini

    // Simpan nilai lama (biar kalau lagi milih gak keriset ke kosong)
    const currentVal = sel.value;
    
    let h = (id === 'filterType') ? '<option value=""> Semua Tipe</option>' : '<option value="">-- Pilih Tipe Aset --</option>';
    
    if (types && types.length > 0) {
      types.forEach(t => {
        h += `<option value="${t}">${t}</option>`;
      });
    }
    sel.innerHTML = h;
    
    // Balikin nilai lama kalau ada
    if (currentVal) sel.value = currentVal;
  });
}

/**==================================================================================================================
 * [FUNGSI CLIENT GITHUB: LOAD DATA ASET SPESIFIK]
 * Menarik data dari sheet tertentu sesuai type_asset yg juga nama sheet nya, lalu memanggil mesin render untuk menampilkan di tabel aset.
 * ====================================================================================================================
 */
async function loadAssetData(sheetName) {
  if (!sheetName) return;
  
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;
  const masterCheck = document.getElementById('checkAllAsset');

  try {
    // 1. PANGGIL SERVER (GET) dengan parameter action dan sheetName
    // EncodeURIComponent penting jika nama sheet ada spasi (misal: 'Pompa Air')
    const response = await fetch(`${urlGAS}?action=getSpecificAsset&sheetName=${encodeURIComponent(sheetName)}`);
    const data = await response.json();

    if (!data || data.length < 2) {
      document.getElementById('assetBody').innerHTML = "<tr><td colspan='5' style='text-align:center;'>📭 Data Kosong</td></tr>";
      return;
    }    

    // Reset checkbox master jika ada
    if (masterCheck) masterCheck.checked = false; 

    // 2. PANGGIL MESIN RENDER INCREMENTAL ANDA
    renderAssetTableIncremental(sheetName, data);

  } catch (err) {
    console.error("Gagal load data aset:", err);
    document.getElementById('assetBody').innerHTML = "<tr><td colspan='5' style='text-align:center; color:red;'>⚠️ Gagal terhubung ke database aset.</td></tr>";
  }
}


/**=========================================================================
 * [FUNGSI: RENDER TABEL INCREMENTAL + INTEGRASI CHECK ALL]
 * Mesin render khusus untuk halaman Lihat Aset dengan checkbox, terintegrasi dengan fungsi toggleAllAssets untuk fitur Check All.
 * Fokus pada efisiensi update baris dan sinkronisasi checkbox dengan data yang diambil dari server.
 * Data diambil langsung dari index yang sesuai (sesuai struktur data aset) dan disesuaikan dengan logika status warna yang sudah kita buat sebelumnya.
 * Logika warna status (Baik, Rusak, Perlu Perbaikan) diambil dari kolom 4 (Index 3) dan ditampilkan sebagai badge di bawah nama aset.
 * Setiap checkbox memiliki class 'asetCheck' untuk memudahkan fungsi toggleAllAssets dalam mengontrol semua checkbox sekaligus.
 * Penting: Pastikan struktur data yang dikirim dari server sesuai dengan yang diharapkan (misal: nama di index 0, kondisi di index 4, dll) agar render berjalan dengan benar.
 *==========================================================================
 */
function renderAssetTableIncremental(sheetName, data) {
  const tbody = document.getElementById('assetBody');
  const masterCheck = document.getElementById('checkAllAsset');
  
  // A. RESET CHECKBOX HEADER (Penting agar tidak nyangkut saat ganti Tipe Aset)
  if (masterCheck) masterCheck.checked = false;

  const newDataLength = data.length - 1; 

  for (let i = 1; i < data.length; i++) {
    const rowData = data[i];
    const rowIdx = i - 1;
    
    // 1. Ambil data dan paksa jadi huruf kecil + buang spasi ghaib
    const status = (rowData[4] || "").toLowerCase().trim();
    // 2. Mapping Warna (Definisikan 4 kondisimu di sini)
    const colors = {
      "baik":      "#27ae60", // Hijau
      "rusak":     "#e74c3c", // Merah (Saran: Rusak biasanya merah, bukan biru)
      "treatment": "#f39c12", // Oranye
      "baru":      "#2980b9"  // Biru
    };
    // 3. Tentukan warna (Default ke abu-abu jika status tidak dikenal)
    let badgeColor = colors[status] || "#7f8c8d";

    // B. PASTIKAN CLASS SAMA (Gunakan 'assetCheck' sesuai fungsi toggle kita)
    const rowHtml = `
      <td style="padding:5px; text-align:center;"><input type="checkbox" class="asetCheck" value="${i+1}"></td>
      <td style="padding:5px; font-weight:bold;"> ${rowData[0]} <br>${rowData[2]}<br><span style="background:${badgeColor}; color:white;">${rowData[4]}</span></td>
      <td style="padding:5px;"> ${rowData[3]} </td>      
      <td style="padding:5px;">
        <button onclick="openAssetDetail('${sheetName}', ${i+1})" style="background:#2980b9; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">
          <i class="fas fa-eye"></i> Detil
        </button>
      </td>`;

    if (tbody.rows[rowIdx]) {
      if (tbody.rows[rowIdx].innerHTML !== rowHtml) {
        tbody.rows[rowIdx].innerHTML = rowHtml;
      }
    } else {
      const newRow = tbody.insertRow();
      newRow.innerHTML = rowHtml;
    }
  }

  while (tbody.rows.length > newDataLength) {
    tbody.deleteRow(newDataLength);
  }
}

/**=========================================================================
 * [FUNGSI: TOGGLE CHECK ALL ASSET]
 * Mengontrol semua checkbox aset dengan satu klik pada checkbox master.
 * Setiap checkbox aset memiliki class 'asetCheck' untuk memudahkan seleksi.
 * Saat master dicentang, semua checkbox aset akan dicentang dan barisnya diberi efek warna (misal: #fff9e6 untuk highlight). Saat master tidak dicentang, semua checkbox aset akan dilepas centangnya dan efek warna dihapus.
 * Pastikan fungsi ini dipanggil setiap kali data aset di-render ulang agar tetap sinkron dengan checkbox yang ada.
 *==========================================================================
 */
function toggleAllAssets() {
  const master = document.getElementById('checkAllAsset');
  const items = document.querySelectorAll('.asetCheck');
  
  items.forEach(cb => {
    cb.checked = master.checked;
    // Beri efek warna pada baris yang dicentang
    const row = cb.closest('tr');
    if (row) {
      row.style.backgroundColor = master.checked ? "#fff9e6" : "";
    }
  });
}

/**=========================================================================
 * [FUNGSI: UPDATE GAMBAR QR]
 * =========================================================================
*/
async function updateQRCode(type, id) {
  // 1. Sanitasi: Ambil bagian pertama saja jika ada tanda "-" (Mencegah Tipe-ID-Tipe-ID)
  let cleanType = type.split('-')[0].trim();
  let cleanId = id.toString().split('-')[0].trim();
  
  // 2. Bentuk string QR yang baku
  const code = cleanType + "-" + cleanId;
  
  // 3. Format URL API stabil Anda
  //const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?data=" + encodeURIComponent(code) + "&size=150x150";
  
  const imgQr = document.getElementById('assetQRCode');  
  const txtQr = document.getElementById('qrText');
  const qrBase64M =  await generateCustomQR(code);
  
 //if (imgQr) imgQr.src = qrUrl;
  if (imgQr) imgQr.src = "data:image/png;base64," + qrBase64M;
  if (txtQr) txtQr.innerText = code;
  
  console.log("✅ QR Clean Generated: " + code);
}
/**=========================================================================
 * [FUNGSI: UPDATE GAMBAR QR]
 * =========================================================================
*/
async function openAddAssetModal() {
  const type = document.getElementById('assetTypeSelect').value;
  if (!type) {
    return Swal.fire({
      title: "Pilih Tipe!",
      text: "Pilih Tipe Aset dulu bos!",
      icon: "warning",
      width: '80%'
    });
  }

  // a. KUNCI GALERI (Tambahan Kunci)
  const gallery = document.getElementById('as_gallery_box');
  if (gallery) {
    gallery.style.opacity = "0.4"; // Bikin redup
    gallery.style.pointerEvents = "none"; // Matikan klik
  }

  // Tampilkan Loading sebentar karena kita akan "nanya" ID ke server
  Swal.fire({
    title: 'Mengambil ID...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    const urlGAS = APPSCRIPT_URL;
    const params = new URLSearchParams({
      action: 'getNextAssetId',
      type: type
    });

    const response = await fetch(`${urlGAS}?${params.toString()}`);
    if (!response.ok) throw new Error("Gagal terhubung ke server.");
    
    const nextId = await response.text(); // Mengambil ID baru (misal: "ELC-001")

    Swal.close(); // Tutup loading

    // 1. Reset Penanda Baris (Kosong = Tambah Baru)
    document.getElementById('assetRowIdx').value = ""; 
    
    // 2. RESET TOTAL CACHE GAMBAR
    assetImages = [];    
    currentImgIdx = 0;   
    
    // 3. Kembalikan Tampilan Slider ke Placeholder
    const imgEl = document.getElementById('currAssetImg');
    if (imgEl) {
      imgEl.src = "https://lh3.googleusercontent.com/d/0"; // Placeholder standar
      imgEl.style.opacity = "1";
    }
    
    // 5. Reset Input Lainnya & Isi ID Otomatis
    document.getElementById('as_type').value = type;
    document.getElementById('as_id').value = nextId; // ID dari server mendarat di sini
    document.getElementById('as_nama').value = "";
    document.getElementById('as_lokasi').value = "";
    document.getElementById('as_status').value = "Baik";    

    // Update QR Code (Fungsi lokal Anda)
    if (typeof updateQRCode === 'function') updateQRCode(type, nextId);

    // Buka Modal
    document.getElementById('assetDetailModal').style.display = 'flex';

  } catch (err) {
    console.error("Gagal ambil ID:", err);
    Swal.fire("Error", "Gagal mengambil ID otomatis dari server: " + err.message, "error");
  }
}


/** =========================================================================
 * Fungsi Tambahan: Centang Semua 
 *  =========================================================================
 */
function toggleSelectAset(master) {
  document.querySelectorAll('.asetCheck').forEach(cb => cb.checked = master.checked);
}

/**=========================================================================
 * [FUNGSI CLIENT GITHUB: LOAD TABEL LIHAT ASET - READ ONLY]
 * Menarik data aset spesifik via Fetch GET untuk mode tampilan saja.
 * Menggunakan action getSpecificAsset dengan parameter sheetName untuk mengambil data dari server, lalu memanggil mesin render khusus untuk mode view aset yang sudah kita buat sebelumnya.
 * Fokus pada penyajian data yang bersih dan efisien untuk mode tampilan saja (Read-Only), tanpa checkbox atau fitur edit.
 * Setiap baris memiliki tombol "Lihat Detail" yang memanggil fungsi openAssetDetailView dengan parameter sheetName dan row index untuk menampilkan detail aset di modal.
 * ==========================================================================
 */
async function loadAssetDataView(sheetName) {
  if (!sheetName) return;
  
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;

  try {
    // 1. PANGGIL SERVER (GET) - Menggunakan action yang sama dengan Kelola Aset
    const response = await fetch(`${urlGAS}?action=getSpecificAsset&sheetName=${encodeURIComponent(sheetName)}`);
    const data = await response.json();

    if (!data || data.length < 2) {
      const tbody = document.getElementById('viewAssetBody');
      if (tbody) tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>📭 Data Kosong</td></tr>";
      return;
    }

    // 2. PANGGIL MESIN RENDER KHUSUS VIEW (READ-ONLY)
    renderAssetTableIncrementalView(sheetName, data);

  } catch (err) {
    console.error("Gagal load data aset view:", err);
    const tbody = document.getElementById('viewAssetBody');
    if (tbody) tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:red;'>⚠️ Gagal memuat data aset.</td></tr>";
  }
}


/**=========================================================================
 * [FUNGSI: RENDER TABEL VIEW INCREMENTAL]
 * Mesin khusus untuk halaman Lihat Aset (Tanpa Checkbox).
 * Fokus pada efisiensi update baris dan penyajian data yang bersih untuk mode tampilan saja (Read-Only).
 * Setiap baris memiliki tombol "Lihat Detail" yang memanggil fungsi openAssetDetailView dengan parameter sheetName dan row index untuk menampilkan detail aset di modal.
 * Data diambil langsung dari index yang sesuai (sesuai struktur data aset) dan disesuaikan dengan logika status warna yang sudah kita buat sebelumnya.
 * Logika warna status (Baik, Rusak, Perlu Perbaikan) diambil dari kolom 4 (Index 3) dan ditampilkan sebagai badge di bawah nama aset.
 * Penting: Pastikan struktur data yang dikirim dari server sesuai dengan yang diharapkan agar render berjalan dengan benar.
 *==========================================================================
 */
function renderAssetTableIncrementalView(sheetName, data) {
  const tbody = document.getElementById('viewAssetBody');
  const existingRows = tbody.rows;
  const newDataLength = data.length - 1;

  for (let i = 1; i < data.length; i++) {
    const rowData = data[i];
    const rowIdx = i - 1;
    // Template baris tanpa checkbox, tombol manggil openAssetDetailView
    const rowHtml = `
      <td>${rowData[0]}</td><td>${rowData[2]}</td><td>${rowData[3]}</td>
      <td>
        <button onclick="openAssetDetailView('${sheetName}', ${i+1})" style="background:#7f8c8d; color:white; border:none; padding:5px; border-radius:3px; cursor:pointer;">
          <i class="fas fa-search"></i> Lihat
        </button>
      </td>`;

    if (existingRows[rowIdx]) {
      if (existingRows[rowIdx].innerHTML !== rowHtml) {
        existingRows[rowIdx].innerHTML = rowHtml;
      }
    } else {
      const newRow = tbody.insertRow();
      newRow.innerHTML = rowHtml;
    }
  }

  while (tbody.rows.length > newDataLength) {
    tbody.deleteRow(newDataLength);
  }
}


/**=========================================================================
 * [FUNGSI CLIENT GITHUB: ISI DROPDOWN LIHAT ASET]
 * Memanfaatkan cache global agar perpindahan tab terasa instan.
 * Jika cache belum ada (misal: refresh halaman), baru ambil dari server. Setelah itu, render dropdown dengan opsi tipe aset yang sudah kita buat sebelumnya.
 * ==========================================================================
 */
async function loadAssetTypesView() {
  const sel = document.getElementById('viewAssetTypeSelect');
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;
  
  // 1. Jika cache sudah ada di memori GitHub, langsung pakai (Instan!)
  if (cachedAssetTypes) {
    console.log("🚀 Menggunakan Cache untuk Dropdown View Asset.");
    renderViewDropdown(cachedAssetTypes);
    return;
  }

  // 2. Jika belum ada (misal: refresh halaman di tab ini), ambil dari server
  try {
    const response = await fetch(`${urlGAS}?action=getAssetTypes`);
    const types = await response.json();

    if (types && types.length > 0) {
      cachedAssetTypes = types; // Simpan ke cache global
      renderViewDropdown(types);
    }
  } catch (err) {
    console.error("Gagal memuat tipe aset untuk view:", err);
    if (sel) sel.innerHTML = '<option value="">⚠️ Gagal memuat data</option>';
  }
}
/**=========================================================================
 * [FUNGSI PEMBANTU: RENDER DROPDOWN LIHAT ASET]
 * Menerima array tipe aset dan mengisi dropdown filter di tab Lihat Aset.
 * Setiap opsi dropdown akan memiliki value yang sesuai dengan tipe aset untuk memudahkan filtering saat user memilih.
 * Pastikan fungsi ini dipanggil dengan data yang benar (array tipe aset) agar dropdown terisi dengan benar.
 * ==========================================================================
 */

function renderViewDropdown(types) {
  const sel = document.getElementById('viewAssetTypeSelect');
  let h = '<option value="">-- Pilih  --</option>';
  types.forEach(t => h += `<option value="${t}">${t}</option>`);
  sel.innerHTML = h;
}


//=========================================  AKHIR FUMGSI BARU =============================================
/**
 * [FUNGSI UTAMA: BUKA MODAL DETIL ASET]
 * Dipakai oleh Admin (Edit) maupun User (Lihat).
 * Kita tambahkan Reset UI di awal agar tidak ada tombol yang "ketinggalan" hidden.
 */
/**
 * [FUNGSI UTAMA: BUKA MODAL DETIL ASET - VERSI GET]
 */
async function openAssetDetail(sheetName, row) {
  // --- 1. RESET & PERSIAPAN UI ---
  const btnSave = document.getElementById('btnSaveAsset');
  const btnBatal = document.getElementById('btnCancelAsset');
  const actionArea = document.getElementById('assetActionArea');
  const btnTake = document.querySelector("button[onclick='takeAssetPhoto()']");
  const modal = document.getElementById('assetDetailModal');

  console.log("nama sheet atau type_asset pada openDAssetDetail :", sheetName);
  console.log("nama sheet atau row pada openDAssetDetail :", row);

  // Munculkan elemen yang mungkin tersembunyi
  if (btnSave) btnSave.style.display = "block";
  if (btnTake && btnTake.parentElement) btnTake.parentElement.style.display = "flex";
  if (actionArea) actionArea.style.gridTemplateColumns = "1fr 1fr";
  
  if (btnBatal) {
    btnBatal.style.width = "";
    btnBatal.style.gridColumn = "auto";
    btnBatal.innerHTML = '<i class="fas fa-times"></i> BATAL/KELUAR';
  }

  // Buka kunci input (Editable mode)
  document.getElementById('as_nama').readOnly = false;
  document.getElementById('as_lokasi').readOnly = false;
  document.getElementById('as_status').disabled = false;

  // Set ID baris ke hidden input agar tahu baris mana yang akan di-update nanti
  document.getElementById('assetRowIdx').value = row;
  document.getElementById('as_type').value = sheetName;

  // --- 2. AMBIL DATA DARI DATABASE (GOOGLE APPS SCRIPT) ---
  // Pastikan variabel global APPSCRIPT_URL sudah ada
  if (typeof APPSCRIPT_URL === 'undefined' || !APPSCRIPT_URL) {
      return alert("Error: URL Script (GAS) tidak ditemukan!");
  }

  // Kita tidak perlu baseUrl dari iframe lagi, langsung pakai variabel global
  const urlGAS = APPSCRIPT_URL;
  
  // Susun Query Parameter untuk doGet
  const params = new URLSearchParams({
    action: 'getSingleAssetData',
    sheetName: sheetName,
    row: row
  });

  const finalUrl = `${urlGAS}?${params.toString()}`;
  console.log("Fetching Data (GET):", finalUrl);

  // Indikator loading pada input nama
  const inputNama = document.getElementById('as_nama');
  const originalPlaceholder = inputNama.placeholder;
  inputNama.value = "Memuat data...";

  try {
    const response = await fetch(finalUrl);
    
    if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

    const data = await response.json();
    console.log("table data di openassetdetai: ");
    console.table(data);

    // Cek jika data kosong atau ada error dari server
    if (!data || data.length === 0 || data.error) {
      throw new Error(data.error || "Data tidak ditemukan di database.");
    }

    // --- 3. MAPPING DATA KE FORM ---
    // Sesuai urutan kolom Spreadsheet: A=0(ID), B=1(Tipe), C=2(Nama), D=3(Lokasi), E=4(Status), F=5(Foto)
    document.getElementById('as_id').value     = data[0] || ""; 
    document.getElementById('as_nama').value   = data[2] || "";   
    document.getElementById('as_lokasi').value = data[3] || ""; 
    document.getElementById('as_status').value = data[4] || "Baik";

    // Mapping Foto (Kolom F / Index 5)
    const photoString = data[5] ? data[5].toString() : ""; 
    // assetImages adalah variabel global untuk slider
    assetImages = photoString.split(",").map(s => s.trim()).filter(s => s !== "");
    currentImgIdx = 0;
    
    // Update Slider & QR Code (Jika fungsi tersedia)
    if (typeof updateImageSlider === 'function') updateImageSlider();
    if (typeof updateQRCode === 'function') {
      // data[0] adalah ID Aset untuk generate QR
      updateQRCode(sheetName, data[0]);
    }

    // Tampilkan Modal setelah semua data siap
    if (modal) modal.style.display = 'flex';

  } catch (err) {
    console.error("Gagal Memuat Detail Aset:", err);
    alert("⚠️ Error: " + err.message);
    inputNama.value = "";
    inputNama.placeholder = originalPlaceholder;
  }
}


/**=========================================================================
 * [FUNGSI: LIHAT ASET DETIL - MODE VIEW ONLY]
 * Kita balik logikanya: Panggil detil dulu, baru timpa dengan mode Read-Only.
 * Tujuannya agar fungsi openAssetDetail tetap berjalan normal (mengisi data, render foto, dll), baru setelah itu kita "Sikat" semua input dan tombol untuk memastikan benar-benar tidak bisa diedit.
 * Dengan cara ini, kita meminimalisir risiko bug atau data yang tidak terisi dengan benar karena mode view hanya merubah state tampilan setelah data sudah dimuat.
 * Pastikan fungsi openAssetDetail sudah benar-benar berjalan dan mengisi semua data sebelum kita kunci inputnya, jadi kita beri sedikit jeda (setTimeout) untuk memastikan urutan eksekusi yang benar.
 *==========================================================================
 */
function openAssetDetailView(sheetName, row) {
  // 1. Jalankan fungsi load data utama dulu
  openAssetDetail(sheetName, row);

  // 2. Gunakan sedikit jeda (100ms) agar fungsi utama selesai merender, 
  // baru kemudian kita "Sikat" tombol-tombolnya untuk mode View
  setTimeout(function() {
    console.log("🔒 Mengaktifkan Mode Read-Only...");

    // Kunci Input
    document.getElementById('as_nama').readOnly = true;
    document.getElementById('as_lokasi').readOnly = true;
    document.getElementById('as_status').disabled = true;
    
    const btnSave = document.getElementById('btnSaveAsset');
    const btnBatal = document.getElementById('btnCancelAsset');
    const actionArea = document.getElementById('assetActionArea');
    const btnTake = document.querySelector("button[onclick='takeAssetPhoto()']");

    // Sembunyikan Simpan & Baris Foto
    if (btnSave) btnSave.style.display = "none"; 
    if (btnTake && btnTake.parentElement) {
      btnTake.parentElement.style.display = "none"; 
    }

    // Buat Batal jadi Full Width
    if (actionArea) actionArea.style.gridTemplateColumns = "1fr";
    if (btnBatal) {
      btnBatal.style.width = "100%";
      btnBatal.innerHTML = '<i class="fas fa-times"></i> KELUAR';
    }

    // Visual Galeri Read-Only
    const gallery = document.getElementById('as_gallery_box');
    if (gallery) {
      gallery.style.opacity = "1"; 
      gallery.style.pointerEvents = "auto";
      const label = gallery.querySelector('label');
      if (label) label.innerText = "DOKUMENTASI FOTO (VIEW ONLY)";
    }
  }, 2000); // 200ms cukup untuk memastikan openAssetDetail sudah jalan
}


/**=========================================================================
 * [variableglobal asset]
 * Menyimpan URL pratinjau foto yang sudah dipilih untuk ditampilkan di slider, serta file asli yang disimpan sementara di laci sebelum disimpan permanen ke Drive.
 * assetImages digunakan untuk slider, sementara temp_Asset_Files digunakan untuk menyimpan file asli yang akan diupload ke Drive saat simpan.
 * Saat user memilih foto baru, kita simpan URL pratinjau di assetImages agar langsung muncul di slider, dan file aslinya kita simpan di temp_Asset_Files untuk nanti diupload ke Drive.
 * Saat user menghapus foto, kita cek apakah itu foto baru (blob URL) atau foto lama (URL Drive). Jika foto baru, kita hapus dari kedua array. Jika foto lama, kita panggil server untuk hapus permanen di Drive dan update assetImages sesuai respon server.
 * Logika ini memastikan bahwa user bisa langsung melihat perubahan di slider saat memilih atau menghapus foto, sekaligus menjaga data file asli yang akan diupload tetap terorganisir di laci sementara.
 * Penting: Pastikan fungsi updateImageSlider sudah benar-benar menggunakan assetImages untuk menampilkan foto di slider agar perubahan langsung terlihat saat user memilih atau menghapus foto.
 *==========================================================================
 */
let assetImages = [];
let currentImgIdx = 0;
let temp_Asset_Files = []; 
const mAX_IMG = 5;

/**=========================================================================
 * [FUNGSI: AMBIL FOTO ASET]
 * Membuka dialog file untuk memilih foto, menyimpan file asli di laci sementara, dan menampilkan pratinjau instan di slider.
 * Logika kuota foto: Cek jumlah foto yang sudah ada di assetImages (yang tampil di slider) sebelum membuka dialog. Jika sudah mencapai mAX_IMG, tampilkan alert dan hentikan proses.
 * Saat user memilih foto, kita simpan file aslinya di temp_Asset_Files untuk nanti diupload ke Drive saat simpan, dan kita buat URL pratinjau untuk langsung ditampilkan di slider dengan menambahkannya ke assetImages. Setelah itu, kita update slider agar user bisa langsung melihat foto yang baru saja dipilih.
 * Pastikan fungsi updateImageSlider sudah benar-benar menggunakan assetImages untuk menampilkan foto di slider agar perubahan langsung terlihat saat user memilih foto baru.
 *==========================================================================
 */
function takeAssetPhoto() {
  // Cek kuota laci
  if (temp_Asset_Files.length >= mAX_IMG) { Swal.fire({title: "Maksimal!",text: "Maksimal " + mAX_IMG + " foto saja!",icon: "warning", confirmButtonText: "OK", width: '80%' });
        return; // Berhenti di sini, tidak lanjut ke proses simpan
     }
  // Buka dialog file dan kedepan menggunakan kamera jika memungkinkan (fitur ini lebih optimal di mobile)
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  
  input.onchange = function() {
    const file = this.files[0];
    if (!file) return;

    // 1. Simpan file asli ke Laci
    temp_Asset_Files.push(file);

    // 2. Buat pratinjau instan untuk Slider
    const pratinjauUrl = URL.createObjectURL(file);
    
    // Kita masukkan ke array assetImages (yang dipakai slider)
    // agar user bisa langsung melihat foto yang baru saja dipilih
    assetImages.push(pratinjauUrl);
    currentImgIdx = assetImages.length - 1; // Geser ke foto terbaru
    
    updateImageSlider();
    console.log("Foto ditambahkan ke laci. Total: " + temp_Asset_Files.length);
  };

  input.click();
}
/**=========================================================================
 * [FUNGSI: HAPUS FOTO ASET]
 * Menghapus foto dari slider dan laci sementara, dengan konfirmasi sebelum menghapus.
 * Logika penghapusan: Cek apakah assetImages kosong sebelum memulai proses. Jika kosong, tampilkan alert dan hentikan proses. Jika tidak, tampilkan konfirmasi. Jika user setuju, cek apakah foto yang akan dihapus adalah foto baru (blob URL) atau foto lama (URL Drive). Jika foto baru, hapus dari kedua array (assetImages dan temp_Asset_Files) dan update slider. Jika foto lama, panggil server untuk hapus permanen di Drive dan update assetImages sesuai respon server.
 * Pastikan fungsi updateImageSlider sudah benar-benar menggunakan assetImages untuk menampilkan foto di slider agar perubahan langsung terlihat saat user menghapus foto.
 *==========================================================================
 */
/**=========================================================================
 * [FUNGSI CLIENT GITHUB: HAPUS FOTO ASET]
 * Menghapus foto sementara di memori browser atau permanen di Google Drive via Fetch POST
 * ==========================================================================
 */
async function deleteAssetPhoto() {
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;

  // 1. VALIDASI AWAL
  if (assetImages.length === 0) {
    Swal.fire({ title: "Kosong!", text: "Tidak ada foto untuk dihapus!", icon: "warning", width: '80%' });
    return;
  }

  // 2. KONFIRMASI GAHAR
  const confirmHapus = await Swal.fire({
    title: "Hapus Foto",
    text: "Foto ini akan dihapus dari daftar?",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Ya, Hapus",
    cancelButtonText: "Batal",
    width: '80%'
  });

  if (!confirmHapus.isConfirmed) return;

  const currentUrl = assetImages[currentImgIdx];

  // --- JALUR A: FOTO BARU (BLOB / LOKAL GITHUB) ---
  if (currentUrl.startsWith("blob:") || currentUrl.startsWith("data:")) {
    // Hapus dari laci temp_Asset_Files
    const offset = assetImages.length - temp_Asset_Files.length;
    temp_Asset_Files.splice(currentImgIdx - offset, 1);
    assetImages.splice(currentImgIdx, 1);
    
    currentImgIdx = 0;
    updateImageSlider();
    
    Swal.fire({ title: "Sukses", text: "Pratinjau foto lokal dihapus", icon: "success", width: '80%' });
  } 
  
  // --- JALUR B: FOTO LAMA (PERMANEN DI DRIVE) ---
  else {
    const row = document.getElementById('assetRowIdx').value;
    const type = document.getElementById('as_type').value;

    Swal.fire({ title: 'Menghapus...', text: 'Sik, lagi dibusek di Drive...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
      const bodyPayload = {
        action: "removeSpecificAssetPhoto",
        payload: {
          type: type,
          row: row,
          photoUrl: currentUrl
        }
      };

      // Gunakan mode 'no-cors' untuk POST besar, atau CORS standar untuk membaca 'res.all'
      const response = await fetch(urlGAS, {
        method: 'POST',
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(bodyPayload)
      });
      
      const res = await response.json(); // Mengharapkan {success: true, all: [...]}

      if (res.success) {
        assetImages = res.all;
        currentImgIdx = 0;
        updateImageSlider();
        Swal.fire({ title: "Sukses", text: "Foto permanen berhasil dihapus dari Drive", icon: "success", width: '80%' });
      }
    } catch (err) {
      console.error("Gagal hapus foto Drive:", err);
      Swal.fire({ title: "Gagal!", text: "Error server saat menghapus foto.", icon: "error", width: '80%' });
    }
  }
}

/**=========================================================================
 * [FUNGSI PEMBANTU: AMBIL QR CODE SEBAGAI BASE64]
 * Mengambil gambar QR dari elemen img, menggambar ulang di canvas untuk mengatasi CORS, lalu mengembalikan data base64 yang siap diupload ke Drive.
 * Logika CORS: Karena gambar QR biasanya berasal dari URL eksternal (misal: API QR), kita tidak bisa langsung mengambil data base64 karena pembatasan CORS. Solusinya adalah dengan membuat elemen Image baru, mengatur crossOrigin ke "Anonymous", lalu menggambar ulang gambar tersebut di canvas. Setelah itu, kita bisa mengambil data base64 dari canvas tanpa terkena CORS.
 * Pastikan fungsi ini dipanggil saat menyimpan aset, dan hasil base64-nya dimasukkan ke payload yang akan dikirim ke server untuk diupload ke Drive.
 *==========================================================================
 */

function getQRCodeBase64() {
  return new Promise((resolve) => {
    const img = document.getElementById('assetQRCode');
    if (!img || !img.src.includes("http")) return resolve(null);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const newImg = new Image();
    
    newImg.crossOrigin = "Anonymous"; // Hindari CORS error
    newImg.onload = function() {
      canvas.width = newImg.width;
      canvas.height = newImg.height;
      ctx.drawImage(newImg, 0, 0);
      resolve({
        base64: canvas.toDataURL("image/png").split(',')[1],
        mimeType: "image/png"
      });
    };
    newImg.src = img.src;
  });
}

/**=========================================================================
 * [FUNGSI: SIMPAN EDITAN ASET]
 * Mengumpulkan data dari form edit aset, menangani foto baru dan QR code, lalu mengirim semuanya ke server untuk disimpan.
 * Logika simpan: Pertama, kita validasi input ID Aset. Jika kosong, tampilkan alert dan hentikan proses. Kemudian, kita ambil QR code sebagai base64 menggunakan fungsi getQRCodeBase64. Selanjutnya, kita susun payload yang akan dikirim ke server, termasuk data dasar aset, QR code dalam format base64, dan file foto baru yang disimpan di laci sementara. Terakhir, kita kirim payload ini ke server menggunakan google.script.run dengan success dan failure handler untuk menangani respon dari server.
 * Pastikan fungsi ini dipanggil saat user menekan tombol "Simpan Perubahan" di modal edit aset, dan semua data yang diperlukan sudah terisi dengan benar sebelum proses simpan dimulai.
 *==========================================================================
 */

/**=========================================================================
 * [FUNGSI CLIENT GITHUB: SAVE ASSET EDIT & QR]
 * Mengirim data aset, QR Code, dan foto massal via Fetch POST
 * =========================================================================
 */
async function saveAssetEdit() {
  const asId = document.getElementById('as_id').value;
  const type = document.getElementById('as_type').value;
  const row = document.getElementById('assetRowIdx').value;
  const btn = document.getElementById('btnSaveAsset');
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;

  // 1. VALIDASI INPUT
  if (!asId) { 
    await Swal.fire({title: "Input Kosong!", text: "ID Aset tidak boleh kosong!", icon: "warning", width: '80%' });
    return; 
  }

  // 2. PERSIAPAN UI & QR
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Menyiapkan QR...";
  }
  
  //const qrBlob = await getQRCodeBase64(); // Pastikan fungsi ini sudah ada di GitHub
  //const qrBlob = await generateCustomQR(type+"-"+asId); 
  // 1. Panggil fungsi generator (hasilnya string)
    const qrTeksMurni = await generateCustomQR(type + "-" + asId); 
    // 2. Bungkus ke dalam objek agar "menyamar" jadi hasil fungsi lama
    const qrBlob = {
      base64: qrTeksMurni,
      mimeType: "image/png"
    };

  // 3. SUSUN DATA UNTUK SPREADSHEET (Kolom A-E)
  const userData = [
    asId, 
    "", // Akan diisi link QR oleh server
    document.getElementById('as_nama').value,
    document.getElementById('as_lokasi').value,
    document.getElementById('as_status').value
  ];

  // 4. SUSUN PAYLOAD LOGIKA SERVER
  let payload = {
    asId: asId,
    type: type,
    row: row,
    qrBase64: qrBlob ? qrBlob.base64 : null,
    adminAktif: window.loggedInUser || "Admin",
    allFiles: [] 
  };

  // 5. PROSES FOTO DARI LACI (temp_Asset_Files)
  if (temp_Asset_Files && temp_Asset_Files.length > 0) {
    if (btn) btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Memproses Foto...";
    try {
      const filePromises = temp_Asset_Files.map(file => getBase64(file));
      payload.allFiles = await Promise.all(filePromises);
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "SIMPAN PERUBAHAN";
      }
      await Swal.fire({ title: "Gagal Memproses Foto", text: e.toString(), icon: "error", width: '80%' });
      return;
    }
  }

  // 6. TRANSMISI KE SERVER (POST)
  if (btn) btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Mengunggah ke Drive...";

  try {
    const bodyPayload = {
      action: "saveAssetEnterpriseWithQR",
      payload: payload,
      userData: userData
    };

    // Gunakan fetch POST (mode 'no-cors' disarankan untuk payload foto yang sangat besar)
    await fetch(urlGAS, {
      method: 'POST',
      mode: 'no-cors',
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(bodyPayload)
    });

    // Karena no-cors, kita asumsikan sukses jika tidak ada error network
    await Swal.fire({
      title: "Sukses",
      text: "Data Aset & QR berhasil dikirim ke server Google.",
      icon: "success",
      width: '80%'
    });

    temp_Asset_Files = []; 
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "SIMPAN PERUBAHAN";
    }
    closeAssetModal();
    loadAssetData(type); // Refresh tabel aset

  } catch (err) {
    await Swal.fire({
      title: "Gagal",
      text: "Gagal Mengirim ke Server: " + err.message,
      icon: "error",
      width: '80%'
    });
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "SIMPAN PERUBAHAN";
    }
  }
}


/**=========================================================================
 * [FUNGSI: DO BULK DELETE USER]
 * Menghapus beberapa aset sekaligus berdasarkan checkbox yang dipilih, dengan konfirmasi sebelum menghapus.
 * Logika penghapusan: Pertama, kita kumpulkan semua checkbox yang dicentang dan ambil nilai row index-nya. Jika tidak ada yang dipilih, tampilkan alert dan hentikan proses. Jika ada yang dipilih, tampilkan konfirmasi dengan jumlah aset yang akan dihapus. Jika user setuju, kita tampilkan modal loading sambil memproses penghapusan di server menggunakan google.script.run. Setelah server merespon, kita tampilkan hasilnya menggunakan Swal dan refresh tabel aset.
 * Pastikan fungsi ini dipanggil saat user menekan tombol "Hapus Terpilih" di halaman Kelola Aset, dan semua checkbox memiliki class 'asetCheck' agar bisa terdeteksi dengan benar.
 *==========================================================================
 */
/**
 * [FUNGSI CLIENT GITHUB: HAPUS ASET MASSAL]
 * Menghapus banyak aset sekaligus dari Spreadsheet & Drive via Fetch POST
 */
async function doBulkDeleteAsset() {
  const type = document.getElementById('assetTypeSelect').value; 
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;
  
  let selected = [];
  document.querySelectorAll('.asetCheck:checked').forEach(cb => selected.push(parseInt(cb.value)));

  // 1. VALIDASI PILIHAN
  if (selected.length === 0) { 
    Swal.fire({ title: "Pilih Dulu!", text: "Pilih aset yang ingin dihapus!", icon: "warning", width: '80%' });
    return; 
  }
 
  // 2. KONFIRMASI GAHAR
  const konfirmasi = await Swal.fire({
    title: "Hapus Asset!",
    text: `⚠️ HAPUS ${selected.length} ASET? \n\nFolder foto dan QR di Drive juga akan dihapus.`,
    icon: "warning", 
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Ya, Hapus!",
    cancelButtonText: "Batal",
    width: '80%'
  });

  if (konfirmasi.isConfirmed) { 
      // 3. TAMPILKAN LOADING
      Swal.fire({
        title: 'Memproses Penghapusan...',
        text: 'Sedang membersihkan database dan Drive, mohon tunggu...',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => { Swal.showLoading(); }
      });

      // 4. TRANSMISI KE SERVER (POST)
      try {
        const bodyPayload = {
          action: "deleteSelectedAssets",
          payload: {
            type: type,
            selected: selected,
            admin: window.loggedInUser || "Admin"
          }
        };

        // Menggunakan fetch POST (tanpa no-cors agar bisa menerima balasan teks sukses)
        const response = await fetch(urlGAS, {
          method: 'POST',
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(bodyPayload)
        });
        
        const res = await response.text();

        // 5. TAMPILKAN HASIL
        await Swal.fire({
          title: "Terhapus!",
          text: res,
          icon: "success",
          width: '80%'
        });
        
        loadAssetData(type); // Refresh tabel di GitHub

      } catch (err) {
        console.error("Gagal hapus massal:", err);
        Swal.fire("Gagal!", "Server Error: " + err.toString(), "error");
      }
  }
}


/**==========================================================================
 * [FUNGSI CLIENT GITHUB: UPDATE QR MASSAL]
 * Konversi QR ke Base64 secara lokal, lalu kirim borongan ke Server via Fetch POST
 * Logika update massal: Pertama, kita kumpulkan semua checkbox yang dicentang dan ambil nilai row index serta ID Aset-nya. Jika tidak ada yang dipilih, tampilkan alert dan hentikan proses. Jika ada yang dipilih, tampilkan konfirmasi dengan jumlah aset yang akan diproses. Jika user setuju, kita tampilkan modal loading sambil memproses konversi QR ke Base64 secara lokal untuk setiap aset yang dipilih. Setelah semua QR berhasil dikonversi, kita kirim data borongan ke server menggunakan Fetch POST. Setelah server merespon, kita tampilkan hasilnya menggunakan Swal dan refresh tabel aset.
 * Pastikan fungsi ini dipanggil saat user menekan tombol "Update QR Massal" di halaman Kelola Aset, dan semua checkbox memiliki class 'asetCheck' agar bisa terdeteksi dengan benar. Juga pastikan fungsi generateVirtualQR sudah benar-benar berjalan untuk mengkonversi QR ke Base64 secara lokal.
 *==========================================================================
 */
async function bulkUpdateQR() {
  const type = document.getElementById('assetTypeSelect').value;
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;
  let selected = [];
  
  // 1. AMBIL ASET YANG DICENTANG
  document.querySelectorAll('.asetCheck:checked').forEach(cb => {
    const row = cb.closest('tr');
    selected.push({
      rowIdx: cb.value,
      asId: row.cells[1].innerText.trim() 
    });
  });

  if (selected.length === 0) {
    return Swal.fire({ title: "Pilih aset dulu!", icon: "info", width: '80%' });
  }

  // 2. KONFIRMASI GAHAR
  const konfirmasi = await Swal.fire({
    title: "Update QR Massal",
    text: `Proses ${selected.length} aset sekaligus?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, Proses",
    width: '80%'
  });

  if (konfirmasi.isConfirmed) {
    Swal.fire({
      title: 'Menyiapkan Data...',
      html: '<b id="progress-text">Konversi QR: 0%</b>',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

  try {
  document.getElementById('progress-text').innerText = "Memulai Konversi Paralel...";

  // 1. PROSES SEMUA QR SEKALIGUS (PARALEL)
  // Kita buat array berisi "Janji" (Promises)
  const promises = selected.map(async (item, index) => {
    const code = type + "-" + item.asId;
    
    // Panggil mesin lokal (Custom QR dengan teks)
    const fullImageBase64 = await generateCustomQR(code);

    // Update progres secara visual (karena cepat, ini akan melompat-lompat)
    // Update progress UI
        const progressVal = Math.round(((index + 1) / selected.length) * 100);
        const progEl = document.getElementById('progress-text');
        if (progEl) progEl.innerText = `Konversi QR: ${progressVal}% (${index + 1}/${selected.length})`;

    // Return data yang dibutuhkan server
    return {
      asId: item.asId,
      row: item.rowIdx,
      qrBase64: fullImageBase64.split(',')[1] // Ambil murni datanya saja (tanpa header data:image)
    };
  });

  // 2. TUNGGU SEMUA SELESAI
  const bulkData = await Promise.all(promises);

  // 3. KIRIM BORONGAN KE SERVER (POST)
  document.getElementById('progress-text').innerText = "Mengirim ke Database (Google Sheets)...";
  
  const bodyPayload = {
    action: "saveBulkQR_Optimized",
    payload: {
      bulkData: bulkData,
      admin: window.loggedInUser || "Admin",
      type: type
    }
  };

  const response = await fetch(urlGAS, {
    method: 'POST',
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(bodyPayload)
  });
  
  const res = await response.text();

  await Swal.fire({ title: "Sukses", text: res, icon: "success", width: '80%' });
  loadAssetData(type); 

} catch (err) {
      console.error("Gagal Bulk Update QR:", err);
      Swal.fire({ title: "Error", text: "Gagal memproses QR: " + err.toString(), icon: "error" });
    }
  }
}

/**=========================================================================
 * HELPER: GENERATE QR BASE64 (Safe for CORS)
 * dengan logo dan tulisan
 * ==========================================================================
 */

async function generateCustomQR(textCode, options = {}) {
    return new Promise((resolve, reject) => {
        const {
            width = 300,
            height = 350,
            colorDark = "#000000",
            colorLight = "#ffffff",
            labelColor = "#1e293b",
            // Path logo sesuai struktur folder Anda
            logoUrl = "./assets/logo/PT-KSC.png" 
        } = options;

        const tempDiv = document.createElement("div");
        
        // PENTING: Gunakan CorrectLevel.H agar QR tetap terbaca meski ada logo di tengah
        new QRCode(tempDiv, {
            text: textCode,
            width: width,
            height: height,
            colorDark: colorDark,
            colorLight: colorLight,
            correctLevel: QRCode.CorrectLevel.H 
        });

        setTimeout(() => {
            const qrCanvas = tempDiv.querySelector('canvas');
            if (!qrCanvas) return reject("Gagal merender QR Lokal");

            const finalCanvas = document.createElement("canvas");
            const ctx = finalCanvas.getContext("2d");
            
            // Layout: QR 150px + Padding 10px kiri/kanan + Area Teks 40px bawah
            finalCanvas.width = width + 20; 
            finalCanvas.height = height + 50; 
            
            // 1. Fill Background Putih
            ctx.fillStyle = colorLight;
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            
            // 2. Gambar QR Utama (Offset 10,10 untuk padding)
            ctx.drawImage(qrCanvas, 10, 10);
            
            // 3. Proses Logo PT-KSC
            const img = new Image();
            img.src = logoUrl;
            
            img.onload = () => {
                // Ukuran logo ideal adalah 20-22% dari lebar QR
                const logoSize = width * 0.22; 
                const centerX = (finalCanvas.width / 2) - (logoSize / 2);
                const centerY = (10 + height / 2) - (logoSize / 2);
                
                // Gambar "Safe Zone" (kotak putih kecil) agar logo tidak menyatu dengan dot QR
                ctx.fillStyle = colorLight;
                ctx.fillRect(centerX - 2, centerY - 2, logoSize + 4, logoSize + 4);
                
                // Tempel Logo
                ctx.drawImage(img, centerX, centerY, logoSize, logoSize);
                finishRender();
            };

            img.onerror = () => {
                console.error("❌ Logo PT-KSC gagal dimuat di: " + logoUrl);
                finishRender(); // Tetap lanjut tanpa logo agar sistem tidak macet
            };

            function finishRender() {
                // 4. Tambahkan Teks ID Aset di bagian bawah
                ctx.fillStyle = labelColor;
                ctx.font = "bold 15px Arial, sans-serif";
                ctx.textAlign = "center";
                // Koordinat teks: Tengah horizontal, 15px dari dasar canvas
                ctx.fillText(textCode, finalCanvas.width / 2, finalCanvas.height - 12);
                
                // 5. Output Base64 Murni untuk Database
                const base64Raw = finalCanvas.toDataURL("image/png");
                resolve(base64Raw.split(',')[1]); 
            }
        }, 150); // Jeda 150ms agar render QRCode.js sempurna
    });
}

/**=========================================================================
 * HELPER: GENERATE QR BASE64 (Safe for CORS)
 * SEMENTARA DEPRECATED BELUM DIGUNAKAN 
 * ==========================================================================
 */
function generateVirtualQR(url) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Penting untuk menghindari security error saat toDataURL
    img.crossOrigin = "Anonymous"; 
    
    img.onload = function() {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      // Ambil data murni base64 (setelah tanda koma)
      resolve(canvas.toDataURL("image/png").split(',')[1]); 
    };
    
    img.onerror = () => reject("Gagal memuat gambar QR dari API");
    img.src = url;
  });
}


/**=========================================================================
 * [FUNGSI: UPDATE SLIDER - ANTI ERROR URL & RAMAH BLOB]
 * Memperbarui gambar di slider dengan logika khusus untuk menangani URL foto yang berasal dari Drive (http/lh3) dan foto baru yang masih berupa blob URL.
 * Logika URL: Jika URL foto berasal dari Drive (http/lh3), kita tambahkan timestamp sebagai query parameter untuk memastikan gambar selalu refresh dan tidak cache. Jika URL foto adalah blob URL (foto baru yang belum disimpan ke Drive), kita tampilkan langsung tanpa menambahkan timestamp agar tidak terjadi error karena blob URL tidak bisa diproses dengan query parameter.
 * Pastikan fungsi ini dipanggil setiap kali assetImages diperbarui, agar perubahan foto langsung terlihat di slider dengan logika yang benar untuk setiap jenis URL.
 *==========================================================================
 */
function updateImageSlider() {
  const imgEl = document.getElementById('currAssetImg');
  if (!imgEl) return;

  // 1. Jika ada foto di array assetImages
  if (assetImages.length > 0 && assetImages[currentImgIdx]) {
    let rawUrl = assetImages[currentImgIdx].trim();

    // LOGIKA PERBAIKAN:
    if (rawUrl.startsWith("blob:")) {
      // JIKA BLOB: Langsung tampilkan tanpa timestamp agar tidak ERROR
      imgEl.src = rawUrl;
    } else {
      // JIKA DARI DRIVE (http/lh3): Tambahkan timestamp agar gambar selalu refresh
      // Pastikan membersihkan tanda tanya lama jika ada
      imgEl.src = rawUrl.split('?')[0] + "?t=" + Date.now();
    }
    
    imgEl.style.opacity = "1";
  } 
  // 2. Jika Kosong, gunakan URL Placeholder
  else {
    imgEl.src = "https://lh3.googleusercontent.com/d/13Q4RtDMmEMVvErifoZOa_yKiAACUpg7a=s1000";
    imgEl.style.opacity = "1";
  }
}

/**=========================================================================
 * [FUNGSI: NAVIGASI FOTO ASET]
 * Memungkinkan user untuk melihat foto aset lainnya jika ada lebih dari satu, dengan logika navigasi yang melingkar (circular).
 * Logika navigasi: Saat user menekan tombol "Next", kita cek apakah assetImages memiliki foto. Jika ya, kita geser indeks ke kanan (currentImgIdx + 1) dan gunakan modulus untuk membuatnya mel
 * ingkar ke awal jika sudah mencapai akhir. Saat user menekan tombol "Previous", kita geser indeks ke kiri (currentImgIdx - 1) dan tambahkan panjang array sebelum modulus untuk memastikan hasilnya tetap positif dan melingkar ke akhir jika sudah melewati awal. Setelah mengubah indeks, kita panggil updateImageSlider untuk memperbarui gambar yang ditampilkan sesuai dengan indeks baru.
 * Pastikan fungsi updateImageSlider sudah benar-benar menggunakan currentImgIdx untuk menampilkan foto yang sesuai di slider agar navigasi berjalan dengan lancar.
 *==========================================================================
 */
function nextAssetImg() {
  if (assetImages.length > 0) {
    currentImgIdx = (currentImgIdx + 1) % assetImages.length;
    updateImageSlider();
  }
}

/**=========================================================================
 * [FUNGSI: NAVIGASI FOTO ASET - PREVIOUS]
 * Memungkinkan user untuk melihat foto aset sebelumnya dengan logika navigasi yang melingkar (circular).
 * Logika navigasi: Saat user menekan tombol "Previous", kita cek apakah assetImages memiliki foto. Jika ya, kita geser indeks ke kiri (currentImgIdx - 1) dan tambahkan panjang array sebelum modulus untuk memastikan hasilnya tetap positif dan melingkar ke akhir jika sudah melewati awal. Setelah mengubah indeks, kita panggil updateImageSlider untuk memperbarui gambar yang ditampilkan sesuai dengan indeks baru.
 * Pastikan fungsi updateImageSlider sudah benar-benar menggunakan currentImgIdx untuk menampilkan foto yang sesuai di slider agar navigasi berjalan dengan lancar.
 *==========================================================================
 */
function prevAssetImg() {
  if (assetImages.length > 0) {
    currentImgIdx = (currentImgIdx - 1 + assetImages.length) % assetImages.length;
    updateImageSlider();
  }
}


/**=========================================================================
 * [FUNGSI: TUTUP MODAL ASET]
 * Menutup modal detail aset dan mereset tampilan serta input ke mode default (Edit Mode) untuk memastikan siap digunakan kembali saat membuka aset lain.
 * Logika reset: Saat menutup modal, kita pastikan untuk mengembalikan semua input ke mode edit (readOnly = false, disabled = false), menampilkan kembali tombol simpan, dan mengatur ulang tata letak grid jika sebelumnya diubah untuk mode view. Dengan cara ini, setiap kali modal dibuka, user akan selalu memulai dengan tampilan yang konsisten dan siap untuk diedit tanpa harus khawatir tentang sisa state dari aset sebelumnya.
 * Pastikan fungsi ini dipanggil saat user menekan tombol "Batal/Keluar" di modal detail aset, agar modal benar-benar tertutup dan siap untuk digunakan kembali dengan tampilan default.
 *==========================================================================
 */
function closeAssetModal() {
  document.getElementById('assetDetailModal').style.display = 'none';

  const btnSave = document.getElementById('btnSaveAsset');
  const btnBatal = document.getElementById('btnCancelAsset');
  const actionArea = document.getElementById('assetActionArea');

  // Balikkan Grid ke 2 kolom (Admin Mode)
  if (actionArea) actionArea.style.gridTemplateColumns = "1fr 1fr";
  if (btnSave) btnSave.style.display = "block";
  if (btnBatal) {
    btnBatal.style.width = "";
    btnBatal.innerHTML = '<i class="fas fa-times"></i> BATAL/KELUAR';
  }

  // Balikkan input ke mode Edit
  document.getElementById('as_nama').readOnly = false;
  document.getElementById('as_lokasi').readOnly = false;
  document.getElementById('as_status').disabled = false;

  // --- BUKA/RESET KUNCI DI SINI ---
  const gallery = document.getElementById('as_gallery_box');
  if (gallery) {
    gallery.style.opacity = "1";
    gallery.style.pointerEvents = "auto";
    const label = gallery.querySelector('label');
    if (label) label.innerText = "KELOLA FOTO ASET";
  }
}


/**=========================================================================
 * [FUNGSI: LOAD USER LIST]
 * Mengambil data user dari server  dan menampilkannya di tabel dengan logika khusus untuk menangani data yang mungkin kosong atau tidak lengkap.
 *==========================================================================
 */
async function loadUserList() {
  const tbody = document.getElementById('userListBody');
  const urlGAS = APPSCRIPT_URL;

  // Tampilkan loading sebentar
  if (tbody) tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'><i class='fas fa-spinner fa-spin'></i> Menghubungi Server...</td></tr>";

  try {
    // 1. Fetch ke doGet dengan action getAllUsers
    const response = await fetch(`${urlGAS}?action=getAllUsers`);
    
    if (!response.ok) throw new Error("Gagal terhubung ke server (Status: " + response.status + ")");

    // 2. Ambil data JSON (Asumsi server mengembalikan array of array)
    const data = await response.json();

    // JIKA data ternyata masih String (akibat double stringify di server), 
    // maka kita paksa jadi Object/Array
    if (typeof data === 'string') {
        data = JSON.parse(data);
    }

    

    if (!data || data.length <= 1) {
      tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Data terdeteksi kosong oleh sistem</td></tr>";
      return;
    }

    let html = "";
    // 3. Loop mulai i=1 untuk melewati header (A=0, B=1, C=2, G=6, H=7, I=8)
    for (let i = 1; i < data.length; i++) {
      let row = data[i];
      
      let username  = row[0] || "Unknown";
      let role      = (row[2] || "user").toLowerCase();
      let status    = (row[6] || "aktif").toLowerCase();
      let lastLogin = row[7] || "-";

      html += `
        <tr data-role="${role}">
          <td style="padding:5px;"><input type="checkbox" class="userCheck" value="${i + 1}"></td>
          <td style="padding:5px;">
            <b>${username}</b><br>
            <small style="color:#666;">${role.toUpperCase()}</small><br>
            <span style="color:${status === 'aktif' ? 'green' : 'red'}; font-weight:bold;">${status.toUpperCase()}</span>
          </td>
          <td style="padding:5px; font-size:10px;">${lastLogin}</td>
          <td style="padding:5px;">
            <button onclick="openEditModal(${i + 1})"
                    style="background:#2980b9; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:3px;">
              <i class="fa fa-address-card"></i> Edit
            </button>
          </td>
        </tr>`;
    }
    
    tbody.innerHTML = html;
    console.log("✅ User List berhasil diperbarui.");

  } catch (err) {
    console.error("Gagal total mengambil user list:", err);
    
    // Tampilan Error menggunakan Swal (Sesuai style kamu)
    Swal.fire({
      title: "Gagal",
      text: "Error: " + err.message,
      icon: "warning",
      confirmButtonText: "OK, Señor!",
      width: '80%'
    });

    if (tbody) tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:red;'>Gagal memuat data.</td></tr>";
  }
}


/**=========================================================================
 * [FUNGSI: BUKA MODAL EDIT USER]
 * Mengambil data user berdasarkan row index, lalu menampilkan di modal edit dengan logika khusus untuk menangani data yang mungkin kosong atau tidak lengkap.
 * = =========================================================================
 */  
async function openEditModal(row) {
  const urlGAS = APPSCRIPT_URL;
  
  try {
    // 1. Ambil data user spesifik berdasarkan baris (row)
    //const response = await fetch(`${urlGAS}?action=getUserData&row=${row}`);
    const response = await fetch(`${urlGAS}?action=getUserData&row=${row}`, {
        method: "GET", // Pakai GET untuk ambil data
        redirect: "follow", // WAJIB ada agar mengikuti redirect dari Google
      });
    
    if (!response.ok) throw new Error("Gagal mengambil data dari server.");
    
    const d = await response.json(); 
    // Data urutan: [User, Pass, Role, Phone, Email, Photo, Status, LastLogin, Attempts]
    if (typeof d === 'string') {
        d = JSON.parse(d);
    }
    // Debugging data di console
    console.table(d);
    // 1. TAMPILKAN MODAL DULU (Agar elemen di dalamnya "bangun")
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        throw new Error("Elemen 'editModal' tidak ditemukan di HTML!");
    }


    // 2. Isi Form Modal
    document.getElementById('m_row_idx').value = row;
    document.getElementById('m_user').value = d[0] || "";
    document.getElementById('m_pass').value = ""; // Kosongkan demi keamanan
    document.getElementById('m_phone').value = d[3] || "";
    document.getElementById('m_role').value = (d[2] || "user").toLowerCase();
    document.getElementById('m_email').value = d[4] || "";
    document.getElementById('m_status').value = (d[6] || "aktif").toLowerCase();
    document.getElementById('m_attempts').value = d[8] || 0;
    
    // --- 3. LOGIKA LOAD GAMBAR (PHOTO) ---
    const photoFromDB = d[5]; 
    const nameFromDB = d[0] || "User"; 
    const imgPreview = document.getElementById('admin_edit_photo');
    
    if (imgPreview) {
      if (photoFromDB && photoFromDB.includes("http")) {
        // Gunakan link Drive asli + anti-cache
        imgPreview.src = photoFromDB + (photoFromDB.includes("?") ? "&" : "?") + "t=" + Date.now();
      } else {
        // Perbaikan format URL UI-Avatars agar lebih rapi
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameFromDB)}&background=2980b9&color=fff&size=128`;
        imgPreview.src = avatarUrl;
      }
    }

    // 4. Tampilkan Modal
    //document.getElementById('editModal').style.display = 'flex';

  } catch (err) {
    console.error("Gagal load detail user:", err);
    Swal.fire({
      title: "Gagal",
      text: "Gagal memproses data: " + err.message,
      icon: "warning",
      confirmButtonText: "OK, Señor!",
      width: '80%'
    });
  }
}

/**=================================================================================================
 * [FUNGSI: BUKA MODAL UNTUK USER BARU]
 * Membersihkan field dan memuat placeholder Avatar.
 * ================================================================================================
 */
function openAddUserModal() {
  // Gunakan helper function sederhana agar kode lebih bersih
  const id = "modalMaint";
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = val;
    } else {
      console.warn(`⚠️ Señor, elemen dengan ID "${id}" tidak ditemukan di HTML!`);
    }
  };

  // 1. Reset Semua Input dengan Aman
  setVal('m_row_idx', ""); 
  setVal('m_user', "");
  setVal('m_pass', "");
  setVal('m_phone', "");
  setVal('m_email', "");
  setVal('m_role', "user");
  setVal('m_status', "aktif");
  setVal('m_attempts', 0);
  
  // 2. Update Foto Preview
  var imgPreview = document.getElementById('admin_edit_photo');
  if (imgPreview) {
    var defaultName = "New User";
    imgPreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultName)}&background=2980b9&color=fff&size=128`;
  }
  
  // 3. Tampilkan Modal
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.style.display = 'flex';
  } else {
    Swal.fire("Error UI", "Modal 'editModal' tidak ditemukan!", "error");
  }
}


/**=================================================================================================
 * [FUNGSI: DELETE USER ]
 * Membersihkan field dan memuat placeholder Avatar.
 * ================================================================================================
 */
async function doBulkAction(status) {
  let selected = getSelectedRows(); // Pastikan fungsi ini mereturn Array ID
  if (selected.length === 0) {
    Swal.fire({ 
      title: "Pilih User", 
      text: "Silahkan centang user terlebih dahulu.", 
      icon: "info", 
      width: '80%' 
    });
    return;
  }

  const result = await Swal.fire({
    title: (status === "aktif" ? "Aktifkan" : "Non-aktifkan") + " User",
    text: "Ubah status " + selected.length + " user menjadi " + status + "?",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: status === "aktif" ? "#28a745" : "#d33",
    confirmButtonText: "Ya, Lanjutkan",
    cancelButtonText: "Batal",
    width: '80%'
  });

  if (result.isConfirmed) {
    // Tampilkan loading overlay
    Swal.fire({ 
      title: 'Memproses...', 
      allowOutsideClick: false, 
      didOpen: () => { Swal.showLoading(); } 
    });

    try {
      const urlGAS = APPSCRIPT_URL;

      const response = await fetch(urlGAS, {
        method: "POST",
        // Menggunakan mode default (cors) agar bisa membaca JSON response jika GAS mendukung
        // Jika gagal, ganti ke 'no-cors' tapi res tidak bisa dibaca detail
        body: JSON.stringify({
          action: "bulkUpdateStatus",
          ids: selected,
          status: status,
          user: loggedInUser
        })
      });

      // Jika Apps Script return ContentService.MimeType.JSON
      const res = await response.json();

      await Swal.fire({ 
        title: "Berhasil", 
        text: res.message || "Status user berhasil diperbarui.", 
        icon: "success", 
        width: '80%' 
      });

      if (typeof loadUserList === 'function') loadUserList(); // Segarkan tabel

    } catch (err) {
      console.error("Bulk Action Error:", err);
      await Swal.fire({ 
        title: "Gagal", 
        text: "Terjadi kesalahan koneksi atau server: " + err.message, 
        icon: "error", 
        width: '80%' 
      });
    }
  }
}


function getSelectedRows() {
  let rows = [];
  document.querySelectorAll('.userCheck:checked').forEach(cb => rows.push(parseInt(cb.value)));
  return rows;
}

function toggleSelectAll() {
    let master = document.getElementById('selectAll');
    document.querySelectorAll('.userCheck').forEach(cb => cb.checked = master.checked);
}

/**=================================================================================================
 * [FUNGSI: HAPUS MASSAL USER]
 * Menghapus baris di Spreadsheet dan file foto di Google Drive.
 * ===================================================================================================
 */
async function doBulkDelete() {
  let selected = [];
  // Mengambil semua ID dari baris yang dicentang
  document.querySelectorAll('.userCheck:checked').forEach(cb => {
    selected.push(parseInt(cb.value));
  });
   
  if (selected.length === 0) { 
    return Swal.fire({
      title: "Pilih Dulu!",
      text: "Pilih user dulu Yuk!",
      icon: "warning", 
      confirmButtonText: "OK", 
      width: '80%' 
    });
  }
    
  const result = await Swal.fire({
    title: "Hapus User(s)",
    text: "⚠️ HAPUS " + selected.length + " USER?\n\nSemua data dan foto profil di Drive akan dihapus secara permanen.",
    icon: "warning", 
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Ya, Hapus",
    cancelButtonText: "Batal",
    width: '80%'
  });

  if (result.isConfirmed) {
    // Tampilkan loading overlay
    Swal.fire({
      title: 'Mohon Tunggu',
      text: 'Sedang menghapus data secara permanen...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const urlGAS = APPSCRIPT_URL;

      const response = await fetch(urlGAS, {
        method: "POST",
        body: JSON.stringify({
          action: "deleteSelectedUsers",
          ids: selected,
          user: loggedInUser // Audit: Siapa yang menghapus
        })
      });

      // Menunggu respon dari server
      const res = await response.json();

      await Swal.fire({
        title: "Berhasil!",
        text: res.message || "Data berhasil dihapus dari database dan Drive.",
        icon: "success",
        width: '80%'
      });

      if (typeof loadUserList === 'function') loadUserList(); 

    } catch (err) {
      console.error("Delete Error:", err);
      await Swal.fire({
        title: "Gagal",
        text: "Gagal menghapus: " + err.message,
        icon: "error",
        width: '80%'
      });
    }
  } 
}

/**=================================================================================================
 * [FUNGSI: LOAD USER PROFILE]
 * Menghapus baris di Spreadsheet dan file foto di Google Drive.
 * ===================================================================================================
 */
async function loadProf() {
  const urlGAS = APPSCRIPT_URL;
  
  // Pastikan variabel 'loggedInUser' tersedia (biasanya dari session/global)
  if (!window.loggedInUser) {
    console.error("Username tidak ditemukan di sesi browser.");
    return;
  }

  try {
    // 1. Fetch ke doGet dengan parameter action & username
    const response = await fetch(`${urlGAS}?action=getUserDataByUsername&username=${encodeURIComponent(loggedInUser)}`);
    
    if (!response.ok) throw new Error("Gagal mengambil profil dari server.");

    const d = await response.json(); 

    console.table(d);
    // Struktur: [User, Pass, Role, Phone, Email, Photo, Status, LastLogin, Attempts]

    // 2. Mapping Data ke Input Profil
    document.getElementById('set_user').value = d[0] || "-";
    document.getElementById('set_role').value = (d[2] || "user").toUpperCase();
    document.getElementById('set_status').value = (d[6] || "aktif").toUpperCase();
    document.getElementById('set_attempts').value = (d[8] || 0) + " / 5";
    document.getElementById('set_email').value = d[4] || "";
    document.getElementById('set_phone').value = d[3] || "";
    
    // --- 3. LOGIKA ANTI-CACHE FOTO ---
    const photoUrl = d[5];
    const userName = d[0] || "User";
    let finalSrc = "";

    if (photoUrl && photoUrl.includes("http")) {
      // Tambahkan anti-cache agar foto terbaru langsung muncul
      const separator = photoUrl.includes("?") ? "&" : "?";
      finalSrc = photoUrl + separator + "t=" + new Date().getTime();
    } else {
      // Perbaikan URL UI-Avatars agar valid
      finalSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=2980b9&color=fff&size=128`;;
    }

    // Update semua elemen foto profil (Desktop, Shared, Mobile)
    const photoElements = ['set_display_photo', 'user_profile_shared', 'user_profile_mobile'];
    photoElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.src = finalSrc;
    });

  } catch (err) {
    console.error("Gagal load profil:", err);
    Swal.fire({
      title: "Gagal",
      text: "Gagal load profil: " + err.message,
      icon: "warning",
      confirmButtonText: "OK, Señor!",
      width: '80%'
    });
  }
}


/**===============================================================================
 * [FUNGSI: SIMPAN PROFIL MANDIRI]
 * Digunakan oleh user untuk mengupdate profilnya sendiri.
 * ==================================================================================
 */
async function saveProf() {
  const displayPhoto = document.getElementById('set_display_photo');
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;
  
  if (!urlGAS) return alert("URL Server tidak ditemukan!");

  // 1. Susun Payload Utama
  let payload = {
    adminAktif: typeof loggedInUser !== 'undefined' ? loggedInUser : document.getElementById('set_user').value,
    row: "", 
    username: document.getElementById('set_user').value,
    phone:    document.getElementById('set_phone').value,
    email:    document.getElementById('set_email').value,
    pass:     document.getElementById('set_pass').value,
    photoData: null,
    photoUrl:  displayPhoto.src.includes("blob:") ? "" : displayPhoto.src.split('?')[0]
  };

  // 2. Proses Foto jika ada di laci Temp_Profile
  if (Temp_Profile && Temp_Profile[0]) {
    try {
      const file = Temp_Profile[0];
      const fileInfo = await getBase64(file); 
      payload.photoData = fileInfo.base64; 
      payload.mimeType  = fileInfo.mimeType;
      payload.fileName  = "Profile_" + payload.username; 
    } catch (e) {
      return Swal.fire({ title: "Gagal", text: "Proses foto: " + e.message, icon: "warning" });
    }
  }

  // 3. UI FEEDBACK (Loading State)
  const preview = document.getElementById('set_display_photo'); 
  const imgSidebar = document.getElementById('user_profile_shared');
  const btn = document.getElementById('btnsaveprofile');
  
  if (preview) preview.style.opacity = "0.3";
  if (imgSidebar) imgSidebar.style.opacity = "0.3";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Menyimpan...";
  }

  // 4. KIRIM KE SERVER VIA POST
  try {
    const response = await fetch(urlGAS, {
      method: "POST",
      body: JSON.stringify({
        action: "universalUpdateUser",
        payload: payload
      })
    });

    const res = await response.json(); // Pastikan server kirim { status: 'success', message: '...' }

    // SUCCESS HANDLER
    Swal.fire({
      title: "¡Misión Cumplida!",
      text: res.message || "Profil berhasil diperbarui",
      icon: "success",
      confirmButtonText: "OK, Señor!",
      width: '80%'
    });

    Temp_Profile = [null, null]; 
    if (typeof syncProfileUI === 'function') syncProfileUI(displayPhoto.src, true); 
    
    loadProf(); // Refresh data profil

  } catch (err) {
    // FAILURE HANDLER
    console.error("Error Save Profile:", err);
    Swal.fire({
      title: "Gagal",
      text: "Koneksi server bermasalah atau: " + err.message,
      icon: "error",
      confirmButtonText: "Coba Lagi",
      width: '80%'
    });
    if (btn) btn.innerHTML = "<i class='fa fa-floppy-o'></i> COBA LAGI";
  } finally {
    // Reset UI State
    if (preview) preview.style.opacity = "1";
    if (imgSidebar) imgSidebar.style.opacity = "1";
    if (btn && btn.innerHTML !== "COBA LAGI") {
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
    // 1. Indikator Loading (Opsional pakai Swal)
    Swal.fire({ title: 'Menyiapkan CSV...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    // 2. Tembak URL Deployment dengan parameter action
    const response = await fetch(`${APPSCRIPT_URL}?action=exportUsersToCSV`);
    
    if (!response.ok) throw new Error("Gagal terhubung ke server Google.");
    
    const csvData = await response.text(); // Ambil teks CSV langsung

    if (csvData.startsWith("Error")) throw new Error(csvData);

    // 3. Proses Pembuatan File (Blob)
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // 4. Trigger Download Otomatis
    const link = document.createElement("a");
    const tgl = new Date().toLocaleDateString().replace(/\//g, '-');
    
    link.href = url;
    link.download = `Data_User_MANTAP_${tgl}.csv`;
    document.body.appendChild(link);
    link.click();
    
    // 5. Bersihkan Sampah
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    Swal.fire({ title: "Berhasil!", text: "Data berhasil diunduh.", icon: "success", timer: 2000 });

  } catch (err) {
    console.error("Download Error:", err);
    Swal.fire("Gagal Download", err.message, "error");
  }
}



/**=============================================================================================
 * [FUNGSI: UPLOAD FOTO OLEH ADMIN]
 * Menggunakan logika asli Anda dengan proteksi opacity & Sinkronisasi instan.
 * =============================================================================================
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
    if (!Temp_Profile) Temp_Profile = [null, null];
    
    Temp_Profile[1] = file; // Simpan di indeks 1 sesuai kode Save Anda
    
    // Preview
    document.getElementById("admin_edit_photo").src = URL.createObjectURL(file);
  }
}



/**=============================================================================================
 * [FUNGSI: SAVE ADMIN EDIT]
 * SIMPAN USER SIAPAPUN KETIKA BERADA DI LOGIN ADMIN.
 * =============================================================================================
 */

async function saveAdminEdit() {
  const rowIdx = document.getElementById('m_row_idx').value;
  const username = document.getElementById('m_user').value;
  const displayPhoto = document.getElementById('admin_edit_photo');
  //const iframe = document.getElementById('iframeGAS');
  const urlGAS = APPSCRIPT_URL;

  if (!username) return alert("Username harus diisi!");
  if (!urlGAS) return alert("URL Server tidak ditemukan!");

  // 1. Susun Payload Universal
  let payload = {
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
  };

  // 2. Cek jika ada foto baru di Temp_Profile[1] (Gunakan async/await)
  if (Temp_Profile && Temp_Profile[1]) {
    try {
      const fileInfo = await getBase64(Temp_Profile[1]);
      payload.photoData = fileInfo.base64;
      payload.mimeType = fileInfo.mimeType;
      payload.fileName = "Profile_" + username;
    } catch (e) {
      console.error("Gagal memproses foto:", e);
    }
  }

  // 3. UI Feedback & Animasi
  const btn = document.getElementById('saveprofilmodal');
  const preview = document.getElementById('admin_edit_photo');
  const imgSidebar = document.getElementById('user_profile_shared');
  
  // Tentukan apakah user sedang mengedit dirinya sendiri
  const targetUser = username || (document.getElementById('set_user') ? document.getElementById('set_user').value : "");
  const isSelf = (targetUser.toLowerCase() === (typeof loggedInUser !== 'undefined' ? loggedInUser.toLowerCase() : ""));

  if (preview) preview.style.opacity = "0.3";
  if (isSelf && imgSidebar) imgSidebar.style.opacity = "0.3";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Menyimpan...";
  }

  // 4. KIRIM KE SERVER VIA POST
  try {
    const response = await fetch(urlGAS, {
      method: "POST",
      body: JSON.stringify({
        action: "universalUpdateUser",
        payload: payload
      })
    });

    const res = await response.json(); // Server harus mengembalikan JSON

    // --- SUCCESS HANDLER ---
    Swal.fire({
      title: "Sukses",
      text: "¡Misión Cumplida! " + (res.message || res),
      icon: "success",
      confirmButtonText: "OK, Señor!",
      width: '80%'
    });

    if (Temp_Profile) Temp_Profile[1] = null; 
    
    closeModal();    // Tutup modal edit
    loadUserList();  // Refresh tabel user
    
    // Sinkronisasi UI jika mengedit diri sendiri
    if (isSelf) {
      const updatedUrl = displayPhoto.src;
      syncProfileUI(updatedUrl, true);
    }

  } catch (err) {
    // --- FAILURE HANDLER ---
    console.error("Gagal simpan admin edit:", err);
    Swal.fire({
      title: "Gagal",
      text: "Error: " + err.message,
      icon: "error",
      confirmButtonText: "Coba Lagi",
      width: '80%'
    });
  } finally {
    // Reset UI State
    if (preview) preview.style.opacity = "1";
    if (imgSidebar) imgSidebar.style.opacity = "1";
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "<i class='fa fa-floppy-o'></i> SIMPAN PERUBAHAN";
    }
  }
}

/**=============================================================================================
 * [FUNGSI: SAVE ADMIN EDIT]
 * SIMPAN USER SIAPAPUN KETIKA BERADA DI LOGIN ADMIN.
 * =============================================================================================
 */
function closeModal() {
  document.getElementById('editModal').style.display = 'none';
}