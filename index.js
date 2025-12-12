const path = require('path');
const fs = require('fs');
const axios = require('axios');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

// ============================================
// YAPILANDIRMA VE SABİTLER
// ============================================
const API_URLS = {
  KANDILLI: 'https://api.orhanaydogdu.com.tr/deprem/kandilli/live',
  USGS: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
  EMSC: 'https://www.seismicportal.eu/fdsnws/event/1/query?limit=50&format=json'
};

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const POLLING_INTERVAL = 10000; // 10 saniye
const DEDUP_TIME_WINDOW = 5 * 60 * 1000; // 5 dakika (milisaniye)
const DEDUP_DISTANCE_RADIUS = 50; // 50 km (100 km çap için)
const DEDUP_TIME_TOLERANCE = 2 * 60 * 1000; // ±2 dakika (milisaniye)

// Renkli konsol çıktıları için ANSI escape codes
const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  KANDILLI: '\x1b[34m', // Mavi
  USGS: '\x1b[32m', // Yeşil
  EMSC: '\x1b[33m', // Sarı
  ERROR: '\x1b[31m', // Kırmızı
  SUCCESS: '\x1b[32m', // Yeşil
  WARNING: '\x1b[33m', // Sarı
  NEW_EARTHQUAKE: '\x1b[1m\x1b[31m' // Kalın Kırmızı
};

// ============================================
// FIREBASE BAŞLATMA
// ============================================
let firebaseApp;
let db;
try {
  // Önce dosyanın var olup olmadığını kontrol et
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account dosyası bulunamadı: ${serviceAccountPath}`);
  }
  
  // Dosya varsa başlat
  const serviceAccount = require(serviceAccountPath);
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log("✅ Firebase başarıyla bağlandı!");
  console.log(`${COLORS.SUCCESS}✓ Firebase Admin SDK başarıyla başlatıldı.${COLORS.RESET}`);
  console.log(`${COLORS.SUCCESS}✓ Firestore başarıyla başlatıldı.${COLORS.RESET}`);
} catch (error) {
  console.error("❌ Firebase BAŞLATILAMADI:", error.message);
  console.error(`${COLORS.ERROR}✗ Firebase başlatma hatası:${COLORS.RESET} ${error.message}`);
  console.error(`${COLORS.WARNING}⚠ FCM bildirimleri ve Firestore işlemleri gönderilemeyecek, ancak uygulama çalışmaya devam edecek.${COLORS.RESET}`);
  
  // Hata durumunda klasördeki dosyaları listele (Debug için)
  try {
    console.log("📂 Klasördeki dosyalar:", fs.readdirSync(__dirname));
  } catch (dirError) {
    console.error(`📂 Klasör okuma hatası: ${dirError.message}`);
  }
}

// ============================================
// HAFIZA DEPOLAMA (Son 5 dakika içindeki depremler)
// ============================================
let recentEarthquakes = [];

// Son 5 dakikadan eski kayıtları temizle
const cleanOldEarthquakes = () => {
  const now = Date.now();
  recentEarthquakes = recentEarthquakes.filter(eq => (now - eq.timestamp) <= DEDUP_TIME_WINDOW);
};

// ============================================
// FIRESTORE YARDIMCI FONKSİYONLARI
// ============================================
// Benzersiz deprem ID'si oluştur
const generateEarthquakeId = (earthquake) => {
  const timestamp = earthquake.date instanceof Date 
    ? earthquake.date.getTime() 
    : new Date(earthquake.date).getTime();
  const location = (earthquake.location || 'unknown').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const lat = earthquake.lat ? earthquake.lat.toFixed(4) : '0';
  const lng = earthquake.lng ? earthquake.lng.toFixed(4) : '0';
  return `${timestamp}_${location}_${lat}_${lng}`;
};

// Depremin Firestore'da var olup olmadığını kontrol et
const earthquakeExists = async (dbInstance, id) => {
  if (!dbInstance) {
    return false;
  }
  try {
    const docRef = dbInstance.collection('depremler').doc(id);
    const doc = await docRef.get();
    return doc.exists;
  } catch (error) {
    console.error(`${COLORS.ERROR}✗ Firestore var mı kontrol hatası:${COLORS.RESET} ${error.message}`);
    return false;
  }
};

// Depremi Firestore'a kaydet
const saveEarthquakeToFirestore = async (dbInstance, id, earthquake) => {
  if (!dbInstance) {
    console.error(`${COLORS.ERROR}✗ Firestore başlatılmadığı için kayıt yapılamadı.${COLORS.RESET}`);
    return false;
  }

  try {
    // Standardize edilmiş veri formatı
    const earthquakeData = {
      location: earthquake.location,
      date: earthquake.date instanceof Date ? earthquake.date : new Date(earthquake.date),
      mag: earthquake.mag,
      source: earthquake.source,
      lat: earthquake.lat,
      lng: earthquake.lng,
      depth: earthquake.depth,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = dbInstance.collection('depremler').doc(id);
    await docRef.set(earthquakeData);
    return true;
  } catch (error) {
    console.error(`${COLORS.ERROR}✗ Firestore kayıt hatası:${COLORS.RESET} ${error.message}`);
    return false;
  }
};

// ============================================
// HAVERSINE MESAFE HESAPLAMA
// ============================================
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // km cinsinden mesafe
};

// ============================================
// TEKİLLEŞTİRME (DEDUPLICATION) MANTIĞI
// ============================================
const isDuplicate = (newEarthquake) => {
  cleanOldEarthquakes();
  
  const newTime = newEarthquake.date.getTime();
  
  for (const existing of recentEarthquakes) {
    const existingTime = existing.data.date.getTime();
    const timeDiff = Math.abs(newTime - existingTime);
    
    // ±2 dakika zaman kontrolü
    if (timeDiff <= DEDUP_TIME_TOLERANCE) {
      // 100 km çap kontrolü (50 km yarıçap)
      const distance = haversineDistance(
        newEarthquake.lat,
        newEarthquake.lng,
        existing.data.lat,
        existing.data.lng
      );
      
      if (distance <= DEDUP_DISTANCE_RADIUS) {
        return true; // Duplicate bulundu
      }
    }
  }
  
  return false; // Duplicate yok
};

// ============================================
// VERİ STANDARDİZASYONU - PARSER FONKSİYONLARI
// ============================================
const parseKandilli = (data) => {
  if (!data || !data.result || !Array.isArray(data.result)) {
    return [];
  }
  
  return data.result.map(item => {
    const coords = item.geojson?.coordinates || [0, 0];
    const dateStr = item.date_time || item.date || new Date().toISOString();
    
    return {
      source: 'Kandilli',
      location: item.title || 'Bilinmeyen Konum',
      mag: parseFloat(item.mag) || 0,
      date: new Date(dateStr),
      lat: coords[1] || 0, // GeoJSON format: [lng, lat]
      lng: coords[0] || 0,
      depth: parseFloat(item.depth) || 0,
      raw: item // Orijinal veri (dosyaya kaydetmek için)
    };
  });
};

const parseUSGS = (data) => {
  if (!data || !data.features || !Array.isArray(data.features)) {
    return [];
  }
  
  return data.features.map(feature => {
    const props = feature.properties || {};
    const coords = feature.geometry?.coordinates || [0, 0, 0];
    
    return {
      source: 'USGS',
      location: props.place || 'Unknown Location',
      mag: parseFloat(props.mag) || 0,
      date: new Date(props.time),
      lat: coords[1] || 0, // GeoJSON format: [lng, lat, depth]
      lng: coords[0] || 0,
      depth: Math.abs(coords[2]) || 0, // Derinlik genelde negatif
      raw: feature // Orijinal veri
    };
  });
};

const parseEMSC = (data) => {
  if (!data || !data.features || !Array.isArray(data.features)) {
    return [];
  }
  
  return data.features.map(feature => {
    const props = feature.properties || {};
    const coords = feature.geometry?.coordinates || [0, 0, 0];
    
    return {
      source: 'EMSC',
      location: props.flynn_region || props.region || 'Unknown Location',
      mag: parseFloat(props.mag) || 0,
      date: new Date(props.time),
      lat: coords[1] || 0, // GeoJSON format: [lng, lat, depth]
      lng: coords[0] || 0,
      depth: Math.abs(coords[2]) / 1000 || 0, // EMSC derinliği metre cinsinden, km'ye çevir
      raw: feature // Orijinal veri
    };
  });
};

// ============================================
// KAYNAKLARDAN VERİ ÇEKME
// ============================================
const fetchKandilli = async () => {
  try {
    const response = await axios.get(API_URLS.KANDILLI, { timeout: 10000 });
    const standardized = parseKandilli(response.data);
    console.log(`${COLORS.KANDILLI}[KANDILLI]${COLORS.RESET} ✓ ${standardized.length} deprem alındı`);
    return standardized;
  } catch (error) {
    console.error(`${COLORS.KANDILLI}[KANDILLI]${COLORS.ERROR} ✗ Hata:${COLORS.RESET} ${error.message}`);
    return [];
  }
};

const fetchUSGS = async () => {
  try {
    const response = await axios.get(API_URLS.USGS, { timeout: 10000 });
    const standardized = parseUSGS(response.data);
    console.log(`${COLORS.USGS}[USGS]${COLORS.RESET} ✓ ${standardized.length} deprem alındı`);
    return standardized;
  } catch (error) {
    console.error(`${COLORS.USGS}[USGS]${COLORS.ERROR} ✗ Hata:${COLORS.RESET} ${error.message}`);
    return [];
  }
};

const fetchEMSC = async () => {
  try {
    const response = await axios.get(API_URLS.EMSC, { timeout: 10000 });
    const standardized = parseEMSC(response.data);
    console.log(`${COLORS.EMSC}[EMSC]${COLORS.RESET} ✓ ${standardized.length} deprem alındı`);
    return standardized;
  } catch (error) {
    console.error(`${COLORS.EMSC}[EMSC]${COLORS.ERROR} ✗ Hata:${COLORS.RESET} ${error.message}`);
    return [];
  }
};

// ============================================
// FCM BİLDİRİM GÖNDERME
// ============================================
const sendFCMNotification = async (earthquake) => {
  if (!firebaseApp) {
    console.error(`${COLORS.ERROR}✗ Firebase başlatılmadığı için bildirim gönderilemedi.${COLORS.RESET}`);
    return;
  }

  try {
    // Depremin büyüklüğünü parse et
    const mag = typeof earthquake.mag === 'number' ? earthquake.mag : parseFloat(earthquake.mag);
    
    // Dinamik mesaj mantığı: Büyüklüğe göre title ve body belirle
    let title, body;
    let priority = 'normal';
    let androidPriority = 'normal';
    let apnsPriority = '5';
    
    if (mag >= 5.0) {
      // Kritik deprem - ACİL DURUM
      title = "🚨 ACİL DURUM: BÜYÜK DEPREM!";
      body = `${earthquake.location} bölgesinde ${mag} büyüklüğünde ciddi deprem! Güvenli yere geçin.`;
      priority = 'high';
      androidPriority = 'high';
      apnsPriority = '10'; // iOS için yüksek öncelik
    } else if (mag >= 3.5) {
      // Orta büyüklükte deprem - Uyarı
      title = "⚠️ Deprem Uyarısı";
      body = `${earthquake.location} - Büyüklük: ${mag}. Hissedilebilir.`;
    } else {
      // Küçük deprem - Bilgi
      title = "Bilgi: Ufak Sarsıntı";
      body = `${earthquake.location} - ${mag}. Endişe edilecek bir durum yok.`;
    }
    
    // Mesaj payload'ını oluştur
    const message = {
      notification: {
        title: title,
        body: body
      },
      topic: 'all_users',
      android: {
        priority: androidPriority
      },
      apns: {
        headers: {
          'apns-priority': apnsPriority
        }
      }
    };

    await admin.messaging().send(message);
    console.log(`${COLORS.SUCCESS}✓ Bildirim başarıyla gönderildi!${COLORS.RESET}`);
  } catch (error) {
    console.error(`${COLORS.ERROR}✗ FCM bildirim gönderme hatası:${COLORS.RESET} ${error.message}`);
  }
};

// ============================================
// DEPREM İŞLEME VE KAYDETME
// ============================================
const processEarthquake = async (earthquake) => {
  // Tekilleştirme kontrolü
  if (isDuplicate(earthquake)) {
    console.log(`${COLORS.WARNING}⚠ Duplicate deprem atlandı:${COLORS.RESET} ${earthquake.location} (${earthquake.source})`);
    return;
  }
  
  // Hafızaya ekle
  recentEarthquakes.push({
    data: earthquake,
    timestamp: Date.now()
  });
  
  // Firestore için benzersiz ID oluştur
  const earthquakeId = generateEarthquakeId(earthquake);
  
  // Firestore'da var mı kontrol et
  const exists = await earthquakeExists(db, earthquakeId);
  
  if (!exists) {
    // Firestore'a kaydet (sadece yeni depremler)
    const saved = await saveEarthquakeToFirestore(db, earthquakeId, earthquake);
    if (saved) {
      console.log(`${COLORS.SUCCESS}✓ Deprem Firestore'a kaydedildi:${COLORS.RESET} ${earthquakeId}`);
    }
    
    // Konsol çıktısı
    console.log(`\n${COLORS.NEW_EARTHQUAKE}========================================${COLORS.RESET}`);
    console.log(`${COLORS.NEW_EARTHQUAKE}YENİ DEPREM ALGILANDI!${COLORS.RESET}`);
    console.log(`${COLORS.NEW_EARTHQUAKE}========================================${COLORS.RESET}`);
    console.log(`${COLORS.BRIGHT}Kaynak:${COLORS.RESET} ${earthquake.source}`);
    console.log(`${COLORS.BRIGHT}Yer:${COLORS.RESET} ${earthquake.location}`);
    console.log(`${COLORS.BRIGHT}Büyüklük:${COLORS.RESET} ${earthquake.mag}`);
    console.log(`${COLORS.BRIGHT}Saat:${COLORS.RESET} ${earthquake.date.toLocaleString('tr-TR')}`);
    console.log(`${COLORS.BRIGHT}Konum:${COLORS.RESET} ${earthquake.lat.toFixed(4)}, ${earthquake.lng.toFixed(4)}`);
    console.log(`${COLORS.BRIGHT}Derinlik:${COLORS.RESET} ${earthquake.depth} km`);
    
    if (earthquake.mag > 4.0) {
      console.log(`${COLORS.ERROR}*** KRİTİK DEPREM ***${COLORS.RESET}`);
    }
    
    console.log(`${COLORS.NEW_EARTHQUAKE}========================================${COLORS.RESET}\n`);
    
    // FCM bildirimi gönder
    await sendFCMNotification(earthquake);
  } else {
    console.log(`${COLORS.WARNING}⚠ Deprem zaten Firestore'da mevcut, atlandı:${COLORS.RESET} ${earthquake.location} (${earthquake.source})`);
  }
};

// ============================================
// ANA İŞLEM DÖNGÜSÜ
// ============================================
const fetchAndProcessEarthquakes = async () => {
  try {
    // Tüm kaynaklardan paralel veri çek
    const [kandilliData, usgsData, emscData] = await Promise.all([
      fetchKandilli(),
      fetchUSGS(),
      fetchEMSC()
    ]);
    
    // Tüm depremleri birleştir
    const allEarthquakes = [
      ...kandilliData,
      ...usgsData,
      ...emscData
    ];
    
    if (allEarthquakes.length === 0) {
      console.log(`${COLORS.WARNING}⚠ Hiçbir kaynaktan deprem verisi alınamadı.${COLORS.RESET}`);
      return;
    }
    
    // Her depremi işle
    for (const earthquake of allEarthquakes) {
      await processEarthquake(earthquake);
    }
    
    // Eski kayıtları temizle
    cleanOldEarthquakes();
    
  } catch (error) {
    console.error(`${COLORS.ERROR}✗ Genel işlem hatası:${COLORS.RESET} ${error.message}`);
  }
};

// ============================================
// EXPRESS SUNUCU KURULUMU
// ============================================
const app = express();
const PORT = 3000;

// CORS middleware
app.use(cors());

// JSON parser middleware
app.use(express.json());

// ============================================
// API ENDPOINT'LERİ
// ============================================
// Root path'i /api/depremler'e yönlendir
app.get('/', (req, res) => {
  res.redirect('/api/depremler');
});

app.get('/api/depremler', async (req, res) => {
  try {
    if (!db) {
      console.error(`${COLORS.ERROR}✗ Firestore başlatılmadığı için veri getirilemedi.${COLORS.RESET}`);
      res.status(500).json({ 
        error: 'Firestore başlatılmadı',
        details: 'Firestore veritabanı bağlantısı kurulamadı. Lütfen sunucu loglarını kontrol edin.'
      });
      return;
    }

    // Firestore'dan en yeni 100 depremi getir
    const snapshot = await db.collection('depremler')
      .orderBy('date', 'desc')
      .limit(100)
      .get();

    // Firestore verilerini formatla
    const results = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        location: data.location,
        date: data.date instanceof admin.firestore.Timestamp 
          ? data.date.toDate().toISOString() 
          : (data.date instanceof Date ? data.date.toISOString() : data.date),
        mag: data.mag,
        source: data.source,
        lat: data.lat,
        lng: data.lng,
        depth: data.depth
      };
    });

    // Sıralanmış listeyi JSON olarak döndür
    res.json(results);
  } catch (error) {
    console.error(`${COLORS.ERROR}✗ API endpoint hatası:${COLORS.RESET} ${error.message}`);
    console.error(`${COLORS.ERROR}✗ Hata detayı:${COLORS.RESET}`, error.stack);
    res.status(500).json({ 
      error: 'Sunucu hatası',
      details: error.message,
      message: 'Deprem verileri alınırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
    });
  }
});

// ============================================
// UYGULAMA BAŞLATMA
// ============================================
console.log(`${COLORS.BRIGHT}========================================${COLORS.RESET}`);
console.log(`${COLORS.BRIGHT}Multi-Source Earthquake Aggregator${COLORS.RESET}`);
console.log(`${COLORS.BRIGHT}Çok Kaynaklı Deprem Toplayıcı${COLORS.RESET}`);
console.log(`${COLORS.BRIGHT}========================================${COLORS.RESET}`);
console.log(`${COLORS.BRIGHT}Kaynaklar:${COLORS.RESET}`);
console.log(`  ${COLORS.KANDILLI}• Kandilli${COLORS.RESET}: ${API_URLS.KANDILLI}`);
console.log(`  ${COLORS.USGS}• USGS${COLORS.RESET}: ${API_URLS.USGS}`);
console.log(`  ${COLORS.EMSC}• EMSC${COLORS.RESET}: ${API_URLS.EMSC}`);
console.log(`${COLORS.BRIGHT}Polling aralığı:${COLORS.RESET} ${POLLING_INTERVAL / 1000} saniye`);
console.log(`${COLORS.BRIGHT}========================================${COLORS.RESET}\n`);

// İlk çalıştırmada veri çek
fetchAndProcessEarthquakes();

// Her 10 saniyede bir veri çek (arka planda çalışmaya devam edecek)
setInterval(fetchAndProcessEarthquakes, POLLING_INTERVAL);

// Express sunucuyu başlat
app.listen(PORT, () => {
  console.log(`${COLORS.SUCCESS}✓ Sunucu http://localhost:${PORT} adresinde çalışıyor${COLORS.RESET}`);
});
