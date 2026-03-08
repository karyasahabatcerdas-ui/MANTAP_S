// --- 1. KONFIGURASI & GUDANG DATA ---
//const GAS_URL = "https://script.google.com/macros/s/AKfycbwwJVU-AHjjg3Lhj_zDIVtDCfTWV114zbQMve87e6b6Rh_FQRzuwyVoiGZzd__slPbb/exec";
const GAS_URL = APPSCRIPT_URL; // Gunakan URL yang dibentuk dari APPSCRIPT_ID di index.html

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
/* ----- script inisialisasi berakhir disini------------------*/

/**
 * FUNGSI CARI: Cari ID atau Nama di seluruh kategori Asset
 * @param {string} keyword - Kata kunci yang dicari (misal: "SPL-001")
 */
function cariAssetGlobal(keyword) {
  const hasil = [];
  const semuatyperAsset = Object.keys(window.APP_STORE.assets); // Ambil list 12 tipe AC
  
  semuatyperAsset.forEach(tipe => {
    const rows = getAsset(tipe);
    // Cari baris yang mengandung keyword (Case Insensitive)
    const match = rows.filter(row => 
      row.join("|").toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (match.length > 0) {
      hasil.push({ tipe: tipe, data: match });
    }
  });
  
  console.log("🔍 Hasil Pencarian:", hasil);
  return hasil;
}

/* ----- konversi script ------------------*/

async function openGlobalSearch() {
  const tbody = document.getElementById('globalResultBody');
  const input = document.getElementById('masterSearchInput');
  
  // 1. Reset tampilan & Fokus
  tbody.innerHTML = ""; 
  input.value = "";
  document.getElementById('globalSearchModal').style.display = 'flex';
  input.focus();

  // 2. Tampilkan pesan awal (instan)
  tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>Silakan ketik ID atau Nama Asset di kolom pencarian...</td></tr>";

  // LOGIKA BARU: Kita tidak pakai FETCH lagi di sini. 
  // Kita akan biarkan fungsi 'input' (onkeyup) yang menyisir RAM nanti.
}




function liveSearchRAM(keyword) {
  const tbody = document.getElementById('globalResultBody');
  if (!keyword || keyword.length < 2) {
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Ketik min. 2 huruf...</td></tr>";
    return;
  }

  let hasilUntukTabel = [];
  const daftarTipe = Object.keys(window.APP_STORE.assets);

  daftarTipe.forEach(tipe => {
    const rows = window.APP_STORE.assets[tipe] || [];
    
    // Mulai dari index 1 (Lompati Header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const teksSatuBaris = row.join("|").toLowerCase();
      
      if (teksSatuBaris.includes(keyword.toLowerCase())) {
        // --- ADAPTER: DISESUAIKAN DENGAN fillGlobalTable ---
        hasilUntukTabel.push({
          type: tipe,           // Untuk item.type
          id: row[0] || "-",    // Untuk item.id (Kolom A)
          nama: row[2] || "-",  // Untuk item.nama (Kolom B)
          lokasi: row[2] || "-",// Untuk item.lokasi (Kolom C)
          row: i + 1            // Untuk item.row (Nomor baris asli)
        });
      }
    }
  });

  // Lempar ke fungsi UI kamu yang sudah mantap itu
  fillGlobalTable(hasilUntukTabel);
}

function fillGlobalTable(results) {
  const tbody = document.getElementById('globalResultBody');
  if (!results || results.length === 0) {
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>Data tidak ditemukan...</td></tr>";
    return;
  }

  let html = "";
  results.forEach((item, index) => {
    html += `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:5px; text-align:center;">
          <!-- TAMBAHKAN data-asid="${item.id}" DI SINI -->
          <input type="radio" name="selAset" value="${item.type}|${item.row}" data-asid="${item.id}" style="cursor:pointer;">
        </td>
        <td style="padding:5px;"><b>${item.type}</b></td>
        <td style="padding:5px;">${item.id}</td>
        <td style="padding:5px;">${item.nama}<br>${item.lokasi}</td>
      </tr>`;
  });
  tbody.innerHTML = html;
}


/**============================================================================
 * [FUNGSI: NAVIGASI SAKTI - MODE MULTI-PAGE]
 * Mengarahkan hasil Search ke modal yang tepat sesuai halaman aktif.
 * ============================================================================
 */
async function navigateAsset() {
  const selected = document.querySelector('input[name="selAset"]:checked');
  if (!selected) return alert("Pilih aset dulu bos!");
  
  const [type, row] = selected.value.split('|');
  const unitID = selected.getAttribute('data-asid');   
  const urlGAS = APPSCRIPT_URL; //document.getElementById('iframeGAS').src; // URL Web App Anda

  // --- LOGIKA 1: MODAL MAINTENANCE LOG (SEARCH UNIT ID) ---
  const modalMaintLog = document.getElementById('modalMaintenanceLog');
  if (modalMaintLog && modalMaintLog.style.display === 'block') {
    fetchAssetDetailForLog(unitID);    
    closeGlobalSearch();
    return; 
  }

  // --- LOGIKA 2: INPUT JADWAL (GET SINGLE ASSET) ---
  if (document.getElementById('modalMaint').style.display === 'flex') {
    try {
      // Menggunakan GET dengan query parameter
      //const resp = await fetch(`${urlGAS}?action=getSingleAssetData&sheetName=${type}&row=${row}`);
      //const data = await resp.json();

      //fungsi penganti fetch
      // 1. Ambil gudang sesuai tipe (misal: "AC_Split")
      const gudangAsset = getAsset(type); 
      // 2. Ambil data baris tersebut (Ingat: Index = Baris - 1)
      const data = gudangAsset[row - 1];



      if (!data || data.length === 0) return alert("Data aset gagal diambil!");
      
      document.getElementById('m_as_id').value = data[0];   
      document.getElementById('m_type').value = type;      
      document.getElementById('m_as_nama').value = data[2];
      document.getElementById('m_lokasi').value = data [3];
      
      closeGlobalSearch();
    } catch (err) {
      console.error("Error fetch asset:", err);
    }
    return; 
  }

  // --- LOGIKA 3: NAVIGASI HALAMAN (GET SPECIFIC ASSET DATA) ---
  closeGlobalSearch();
  const currentPage = document.querySelector('.page:not(.hidden)').id;

  try {
    //const resp = await fetch(`${urlGAS}?action=getSpecificAsset&sheetName=${type}`);
    //const data = await resp.json();
    //fungsi pengganti fetch
    data = getAsset(type);

    if (currentPage === 'page_lihat_aset') {
      document.getElementById('viewAssetTypeSelect').value = type;
      renderAssetTableIncrementalView(type, data); 
      executeHighlight(row, 'viewAssetBody', true);
    } else {
      document.getElementById('assetTypeSelect').value = type;
      renderAssetTableIncremental(type, data);
      executeHighlight(row, 'assetBody', false);
    }
  } catch (err) {
    console.error("Error navigasi asset:", err);
  }
}

function executeHighlight(row, bodyId, isView) {
  setTimeout(() => {
    const tbody = document.getElementById(bodyId);
    const targetRow = tbody.rows[parseInt(row) - 2]; 
    
    if (targetRow) {
      // 1. Geser layar sampai baris target ada di tengah (Smooth)
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // 2. Kasih efek kedip kuning (Highlight)
      targetRow.classList.add('highlight-flash');
      
      // 3. OKE GAS! Langsung buka modal detilnya
      const type = isView ? document.getElementById('viewAssetTypeSelect').value : document.getElementById('assetTypeSelect').value;
      
      if (isView) {
        openAssetDetailView(type, row); // Mode Read-Only
      } else {
        openAssetDetail(type, row); // Mode Admin Edit
      }
    }
  }, 600); // Delay 600ms biar tabel sempet ngerender dulu
}


function closeGlobalSearch() {
  document.getElementById('globalSearchModal').style.display = 'none';
}





























//**-----------------------[TARUH SELALU FUNGSI INI DI BAWAH]----------------------- */
window.addEventListener('DOMContentLoaded', (event) => {
    console.log("🚀 Semua mesin siap, Sedot Data Ghoib dimulai...");
    syncDataGhoib();
});
