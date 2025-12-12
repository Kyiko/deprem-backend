import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage anahtarları
export const STORAGE_KEYS = {
  EARTHQUAKE_ALARM: 'earthquakeAlarm',
  SILENT_ON_LIGHT_SHAKE: 'silentOnLightShake',
  CRITICAL_ALERTS: 'criticalAlerts',
  SEISMIC_NOTIFICATIONS: 'seismicNotifications',
  MIN_MAGNITUDE: 'minMagnitude',
  MAX_DISTANCE: 'maxDistance',
  USER_REPORT_NOTIFICATIONS: 'userReportNotifications',
  REPORT_RADIUS: 'reportRadius',
  IS_PRO: 'isPro',
};

// Varsayılan değerler
export const DEFAULT_SETTINGS = {
  earthquakeAlarm: true,
  silentOnLightShake: true,
  criticalAlerts: true,
  seismicNotifications: true,
  minMagnitude: 3.0,
  maxDistance: 500,
  userReportNotifications: true,
  reportRadius: 200,
};

export interface Settings {
  earthquakeAlarm: boolean;
  silentOnLightShake: boolean;
  criticalAlerts: boolean;
  seismicNotifications: boolean;
  minMagnitude: number;
  maxDistance: number;
  userReportNotifications: boolean;
  reportRadius: number;
}

// Ayarları yükle
export const loadSettings = async (): Promise<Settings> => {
  try {
    const loadedSettings: Partial<Settings> = {};

    const earthquakeAlarm = await AsyncStorage.getItem(STORAGE_KEYS.EARTHQUAKE_ALARM);
    if (earthquakeAlarm !== null) {
      loadedSettings.earthquakeAlarm = earthquakeAlarm === 'true';
    }

    const silentOnLightShake = await AsyncStorage.getItem(STORAGE_KEYS.SILENT_ON_LIGHT_SHAKE);
    if (silentOnLightShake !== null) {
      loadedSettings.silentOnLightShake = silentOnLightShake === 'true';
    }

    const criticalAlerts = await AsyncStorage.getItem(STORAGE_KEYS.CRITICAL_ALERTS);
    if (criticalAlerts !== null) {
      loadedSettings.criticalAlerts = criticalAlerts === 'true';
    }

    const seismicNotifications = await AsyncStorage.getItem(STORAGE_KEYS.SEISMIC_NOTIFICATIONS);
    if (seismicNotifications !== null) {
      loadedSettings.seismicNotifications = seismicNotifications === 'true';
    }

    const minMagnitude = await AsyncStorage.getItem(STORAGE_KEYS.MIN_MAGNITUDE);
    if (minMagnitude !== null) {
      loadedSettings.minMagnitude = parseFloat(minMagnitude);
    }

    const maxDistance = await AsyncStorage.getItem(STORAGE_KEYS.MAX_DISTANCE);
    if (maxDistance !== null) {
      loadedSettings.maxDistance = parseFloat(maxDistance);
    }

    const userReportNotifications = await AsyncStorage.getItem(STORAGE_KEYS.USER_REPORT_NOTIFICATIONS);
    if (userReportNotifications !== null) {
      loadedSettings.userReportNotifications = userReportNotifications === 'true';
    }

    const reportRadius = await AsyncStorage.getItem(STORAGE_KEYS.REPORT_RADIUS);
    if (reportRadius !== null) {
      loadedSettings.reportRadius = parseFloat(reportRadius);
    }

    return { ...DEFAULT_SETTINGS, ...loadedSettings };
  } catch (error) {
    console.error('Ayarlar yüklenirken hata:', error);
    return DEFAULT_SETTINGS;
  }
};

// Deprem filtresi - ayarlara göre depremleri filtrele
export const filterEarthquakeBySettings = (
  earthquake: { mag: number | string; lat: number; lng: number },
  userLocation: { latitude: number; longitude: number } | null,
  settings: Settings
): boolean => {
  // Büyüklük kontrolü
  const mag = typeof earthquake.mag === 'string' ? parseFloat(earthquake.mag) : earthquake.mag;
  if (isNaN(mag) || mag < settings.minMagnitude) {
    return false;
  }

  // Mesafe kontrolü (eğer konum varsa)
  if (userLocation) {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      earthquake.lat,
      earthquake.lng
    );
    if (distance > settings.maxDistance) {
      return false;
    }
  }

  return true;
};

// Haversine formülü ile mesafe hesaplama (km cinsinden)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Dünya'nın yarıçapı (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};


