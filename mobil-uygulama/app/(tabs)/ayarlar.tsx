import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { STORAGE_KEYS } from '@/utils/settings';

export default function AyarlarScreen() {
  // HER AYAR İÇİN AYRI STATE - ASLA ORTAK KULLANMA!
  const [isAlarmEnabled, setIsAlarmEnabled] = useState<boolean>(true);
  const [isSilentOnWeak, setIsSilentOnWeak] = useState<boolean>(true);
  const [isCriticalAllowed, setIsCriticalAllowed] = useState<boolean>(true);
  const [isNetworkNotifEnabled, setIsNetworkNotifEnabled] = useState<boolean>(true);
  const [minMagnitude, setMinMagnitude] = useState<number>(3.0);
  const [maxDistance, setMaxDistance] = useState<number>(500);
  const [isUserReportEnabled, setIsUserReportEnabled] = useState<boolean>(true);
  const [reportRadius, setReportRadius] = useState<number>(200);

  // Ayarları yükle
  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    try {
      // Her ayarı ayrı ayrı yükle
      const alarmValue = await AsyncStorage.getItem(STORAGE_KEYS.EARTHQUAKE_ALARM);
      if (alarmValue !== null) {
        setIsAlarmEnabled(alarmValue === 'true');
      }

      const silentValue = await AsyncStorage.getItem(STORAGE_KEYS.SILENT_ON_LIGHT_SHAKE);
      if (silentValue !== null) {
        setIsSilentOnWeak(silentValue === 'true');
      }

      const criticalValue = await AsyncStorage.getItem(STORAGE_KEYS.CRITICAL_ALERTS);
      if (criticalValue !== null) {
        setIsCriticalAllowed(criticalValue === 'true');
      }

      const networkValue = await AsyncStorage.getItem(STORAGE_KEYS.SEISMIC_NOTIFICATIONS);
      if (networkValue !== null) {
        setIsNetworkNotifEnabled(networkValue === 'true');
      }

      const minMagValue = await AsyncStorage.getItem(STORAGE_KEYS.MIN_MAGNITUDE);
      if (minMagValue !== null) {
        setMinMagnitude(parseFloat(minMagValue));
      }

      const maxDistValue = await AsyncStorage.getItem(STORAGE_KEYS.MAX_DISTANCE);
      if (maxDistValue !== null) {
        setMaxDistance(parseFloat(maxDistValue));
      }

      const reportValue = await AsyncStorage.getItem(STORAGE_KEYS.USER_REPORT_NOTIFICATIONS);
      if (reportValue !== null) {
        setIsUserReportEnabled(reportValue === 'true');
      }

      const radiusValue = await AsyncStorage.getItem(STORAGE_KEYS.REPORT_RADIUS);
      if (radiusValue !== null) {
        setReportRadius(parseFloat(radiusValue));
      }
    } catch (error) {
      console.error('Ayarlar yüklenirken hata:', error);
    }
  };

  // Ayar kaydetme fonksiyonu
  const saveSetting = async (key: string, value: boolean | number) => {
    try {
      await AsyncStorage.setItem(key, value.toString());
    } catch (error) {
      console.error('Ayar kaydedilirken hata:', error);
    }
  };

  // Switch handler'ları - HER BİRİ AYRI VE BAĞIMSIZ
  const handleAlarmChange = async (value: boolean) => {
    setIsAlarmEnabled(value);
    await saveSetting(STORAGE_KEYS.EARTHQUAKE_ALARM, value);
  };

  const handleSilentChange = async (value: boolean) => {
    setIsSilentOnWeak(value);
    await saveSetting(STORAGE_KEYS.SILENT_ON_LIGHT_SHAKE, value);
  };

  const handleCriticalChange = async (value: boolean) => {
    setIsCriticalAllowed(value);
    await saveSetting(STORAGE_KEYS.CRITICAL_ALERTS, value);
  };

  const handleNetworkChange = async (value: boolean) => {
    setIsNetworkNotifEnabled(value);
    await saveSetting(STORAGE_KEYS.SEISMIC_NOTIFICATIONS, value);
  };

  const handleUserReportChange = async (value: boolean) => {
    setIsUserReportEnabled(value);
    await saveSetting(STORAGE_KEYS.USER_REPORT_NOTIFICATIONS, value);
  };

  // Slider handler'ları - HER BİRİ AYRI VE BAĞIMSIZ
  const handleMinMagnitudeChange = async (value: number) => {
    setMinMagnitude(value);
    await saveSetting(STORAGE_KEYS.MIN_MAGNITUDE, value);
  };

  const handleMaxDistanceChange = async (value: number) => {
    setMaxDistance(value);
    await saveSetting(STORAGE_KEYS.MAX_DISTANCE, value);
  };

  const handleReportRadiusChange = async (value: number) => {
    setReportRadius(value);
    await saveSetting(STORAGE_KEYS.REPORT_RADIUS, value);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* GERÇEK ZAMANLI UYARI Bölümü */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GERÇEK ZAMANLI UYARI</Text>
          <View style={styles.sectionBox}>
            {/* Deprem Alarmı */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={styles.switchLabel}>Deprem Alarmı</Text>
                <Text style={styles.switchDescription}>
                  Bir deprem tespit edildiğinde alarm çal.
                </Text>
              </View>
              <Switch
                value={isAlarmEnabled}
                onValueChange={handleAlarmChange}
                trackColor={{ false: '#3E3E42', true: '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#3E3E42"
              />
            </View>

            <View style={styles.divider} />

            {/* Hafif Sarsıntıda Sessiz */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={styles.switchLabel}>Hafif Sarsıntıda Sessiz</Text>
                <Text style={styles.switchDescription}>
                  Bulunduğunuz yerdeki sarsinti hafifse alarmı devre dışı bırak.
                </Text>
              </View>
              <Switch
                value={isSilentOnWeak}
                onValueChange={handleSilentChange}
                trackColor={{ false: '#3E3E42', true: '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#3E3E42"
              />
            </View>

            <View style={styles.divider} />

            {/* Kritik Uyarılar */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={styles.switchLabel}>Kritik Uyarılar</Text>
                <Text style={styles.switchDescription}>
                  Rahatsız etmeyin modunda bile ses çıkar.
                </Text>
              </View>
              <Switch
                value={isCriticalAllowed}
                onValueChange={handleCriticalChange}
                trackColor={{ false: '#3E3E42', true: '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#3E3E42"
              />
            </View>
          </View>
        </View>

        {/* SİSMİK AĞ BİLDİRİMLERİ Bölümü */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SİSMİK AĞ BİLDİRİMLERİ</Text>
          <View style={styles.sectionBox}>
            {/* Bildirimleri Aç */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={styles.switchLabel}>Bildirimleri Aç</Text>
                <Text style={styles.switchDescription}>
                  Ulusal ve uluslararası ağlardan bildirim al.
                </Text>
              </View>
              <Switch
                value={isNetworkNotifEnabled}
                onValueChange={handleNetworkChange}
                trackColor={{ false: '#3E3E42', true: '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#3E3E42"
              />
            </View>

            <View style={styles.divider} />

            {/* Minimum Büyüklük Slider */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Minimum Büyüklük</Text>
                <Text style={styles.sliderValue}>{minMagnitude.toFixed(1)}</Text>
              </View>
              <Slider
                style={styles.slider}
                value={minMagnitude}
                onValueChange={handleMinMagnitudeChange}
                minimumValue={0.0}
                maximumValue={5.5}
                step={0.1}
                minimumTrackTintColor="#34C759"
                maximumTrackTintColor="#3E3E42"
                thumbTintColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Maksimum Mesafe Slider */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Maksimum Mesafe</Text>
                <Text style={styles.sliderValue}>{maxDistance} km</Text>
              </View>
              <Slider
                style={styles.slider}
                value={maxDistance}
                onValueChange={handleMaxDistanceChange}
                minimumValue={100}
                maximumValue={1000}
                step={10}
                minimumTrackTintColor="#34C759"
                maximumTrackTintColor="#3E3E42"
                thumbTintColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* KULLANICI RAPORU BİLDİRİMLERİ Bölümü */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>KULLANICI RAPORU BİLDİRİMLERİ</Text>
          <View style={styles.sectionBox}>
            {/* Rapor Bildirimleri */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={styles.switchLabel}>Rapor Bildirimleri</Text>
                <Text style={styles.switchDescription}>
                  Kullanıcılar tarafından bildirilen depremleri haber ver.
                </Text>
              </View>
              <Switch
                value={isUserReportEnabled}
                onValueChange={handleUserReportChange}
                trackColor={{ false: '#3E3E42', true: '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#3E3E42"
              />
            </View>

            <View style={styles.divider} />

            {/* Konum Yarıçapı Slider */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Konum Yarıçapı</Text>
                <Text style={styles.sliderValue}>{reportRadius} km</Text>
              </View>
              <Slider
                style={styles.slider}
                value={reportRadius}
                onValueChange={handleReportRadiusChange}
                minimumValue={100}
                maximumValue={1000}
                step={10}
                minimumTrackTintColor="#34C759"
                maximumTrackTintColor="#3E3E42"
                thumbTintColor="#FFFFFF"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32, // Bölümler arası boşluk
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionBox: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 60,
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  sliderContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  sliderValue: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#38383A',
    marginLeft: 16,
  },
});
