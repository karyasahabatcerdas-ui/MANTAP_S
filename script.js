// --- GUDANG DATA UTAMA (Hanya hidup di RAM) ---
window.APP_STORE = {
  app: {},
  assets: {},
  reference: {},
  maintenance: {},
  key: null,
  lastSync: null
};



async function syncDataGhoib() {
  try {
    // 1. Indikator Loading Modern
    Swal.fire({ 
      title: 'Sinkronisasi Data Ghoib...', 
      text: 'Menyedot 22 Sheet dari Server Google...',
      allowOutsideClick: false, 
      didOpen: () => Swal.showLoading() 
    });

    // 2. Ambil Data via Fetch (GET)
    const response = await fetch(`${APPSCRIPT_URL}?action=getInitialData`);
    const res = await response.json();

    if (res.status !== "success") throw new Error(res.message);

    // 3. BONGKAR GHOIB (Decode Base64 ke JSON)
    const decodedString = atob(res.blob); // Kembalikan Base64 ke String JSON
    const cleanData = JSON.parse(decodedString); // Ubah String ke Object JS

    // 4. Masukkan ke Gudang Utama
    window.APP_STORE.app = cleanData.app;
    window.APP_STORE.assets = cleanData.assets;
    window.APP_STORE.reference = cleanData.reference;
    window.APP_STORE.maintenance = cleanData.maintenance;
    window.APP_STORE.lastSync = cleanData.timestamp;
    window.APP_STORE.key = res.key; // Simpan kunci sesi

    // 5. Simpan BLOB di SessionStorage (Otomatis hancur saat tab ditutup)
    sessionStorage.setItem('DATA_KSC_GHOIB', res.blob);

    console.log("✅ 22 Sheet Terbongkar Sempurna, Señor!", window.APP_STORE);
    
    // 6. OTOMATIS ISI SEMUA DROPDOWN (Update: N)
    populateAllDropdowns();

    Swal.fire({ title: "Misión Cumplida!", text: "Data sudah sinkron.", icon: "success", timer: 1500 });

  } catch (err) {
    console.error("Gagal Bongkar Ghoib:", err);
    Swal.fire("Sistem Error", "Gagal sinkron data: " + err.message, "error");
  }
}


// Contoh: getAsset("AC_Split") -> langsung dapat array datanya
const getAsset = (typeName) => window.APP_STORE.assets[typeName] || [];

// Contoh: getRef("ID_Jadwal") -> dapat daftar dropdown
const getRef = (refName) => window.APP_STORE.reference[refName] || [];

// Contoh: getMaintenance("Maintenance") -> dapat jadwal kerja
const getMaint = (sheetName) => window.APP_STORE.maintenance[sheetName] || [];



function populateAllDropdowns() {
  // Mapping ID Select HTML : Nama Sheet di Reference
  const mapRef = {
    'maint_id_jadwal': 'ID_Jadwal',
    'assetTypeSelect': 'Type_Asset',
    'statusMaintSelect': 'Status_Maint',
    'statusAssetSelect': 'Status_Asset'
  };

  for (let id in mapRef) {
    const el = document.getElementById(id);
    const data = getRef(mapRef[id]);
    
    if (el && data.length > 0) {
      // Sisakan baris pertama jika itu Header
      let options = `<option value="">-- Pilih ${mapRef[id]} --</option>`;
      data.slice(1).forEach(row => {
        options += `<option value="${row[0]}">${row[0]}</option>`;
      });
      el.innerHTML = options;
    }
  }
  console.log("💎 Semua Dropdown Referensi Telah Diisi.");
}


