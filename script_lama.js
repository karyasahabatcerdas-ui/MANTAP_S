
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
let assetImages = [];
let currentImgIdx = 0;
let temp_Asset_Files = []; 
const mAX_IMG = 5;




