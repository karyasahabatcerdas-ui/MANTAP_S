// --- 1. KONFIGURASI & GUDANG DATA ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbwwJVU-AHjjg3Lhj_zDIVtDCfTWV114zbQMve87e6b6Rh_FQRzuwyVoiGZzd__slPbb/exec";

window.APP_STORE = {
  app: {},
  assets: {},
  reference: {},
  maintenance: {},
  key: null,
  lastSync: null
};

// --- 2. FUNGSI SEDOT DATA (READ) ---
async function syncDataGhoib() {
  try {
    // Indikator Loading
    Swal.fire({ 
      title: 'Sinkronisasi Data...', 
      text: 'Menyedot 22 Sheet dari Server...',
      allowOutsideClick: false, 
      didOpen: () => Swal.showLoading() 
    });

    // Fetch ke doGet GAS
    const response = await fetch(`${GAS_URL}?action=getInitialData`);
    const res = await response.json();

    if (res.status !== "success") throw new Error(res.message);

    // BONGKAR GHOIB
    const decodedString = atob(res.blob); 
    const cleanData = JSON.parse(decodedString);

    // Masukkan ke RAM
    window.APP_STORE.app = cleanData.app;
    window.APP_STORE.assets = cleanData.assets;
    window.APP_STORE.reference = cleanData.reference;
    window.APP_STORE.maintenance = cleanData.maintenance;
    window.APP_STORE.lastSync = cleanData.timestamp;
    window.APP_STORE.key = res.key;

    sessionStorage.setItem('DATA_KSC_GHOIB', res.blob);
    
    // Isi Dropdown secara otomatis
    populateAllDropdowns();

    Swal.fire({ title: "Sukses!", text: "Data Sinkron.", icon: "success", timer: 1500 });
    console.log("✅ RAM Updated:", window.APP_STORE);

  } catch (err) {
    console.error("Gagal Sinkron:", err);
    Swal.fire("Error", err.message, "error");
  }
}

// --- 3. FUNGSI KIRIM DATA (WRITE) ---
async function kirimKeGAS(action, sheetName, id, dataRow = []) {
  const payload = { action, sheetName, id, data: dataRow };

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload) 
    });
    
    const hasil = await response.json();
    console.log("🚀 Respon GAS:", hasil);
    return hasil;
  } catch (err) {
    Swal.fire("Gagal Simpan", err.toString(), "error");
  }
}

// --- 4. HELPER (PENGAMBIL DATA RAM) ---
const getAsset = (name) => window.APP_STORE.assets[name] || [];
const getRef   = (name) => window.APP_STORE.reference[name] || [];
const getMaint = (name) => window.APP_STORE.maintenance[name] || [];
const getApp = (name) => window.APP_STORE.app[name] || [];

// --- 5. OTOMATISASI UI ---
function populateAllDropdowns() {
  const mapRef = {
    'maint_id_jadwal': 'ID_Jadwal',
    'assetTypeSelect': 'Type_Asset',
    'statusMaintSelect': 'Status_Maint',
    'statusAssetSelect': 'Status_Asset'
  };

  for (let id in mapRef) {
    const el = document.getElementById(id);
    if (!el) continue;
    
    const data = getRef(mapRef[id]);
    let options = `<option value="">-- Pilih ${mapRef[id]} --</option>`;
    
    data.slice(1).forEach(row => {
      options += `<option value="${row[0]}">${row[0]}</option>`;
    });
    el.innerHTML = options;
  }
}
