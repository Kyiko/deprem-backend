import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  Modal,
  Share,
  Alert,
} from 'react-native';
import axios from 'axios';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useNavigation, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSettings, filterEarthquakeBySettings, Settings, STORAGE_KEYS } from '@/utils/settings';

const API_URL = 'https://deprem-backend.onrender.com/api/depremler';

interface Earthquake {
  location: string;
  date: string;
  mag: number | string;
  source: string;
  lat: number;
  lng: number;
  depth: number;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

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

// Tarih/saat formatlama (HH:MM)
const formatDateTime = (dateTime: string): string => {
  try {
    const date = new Date(dateTime);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (error) {
    return dateTime;
  }
};

// Büyüklüğe göre renk döndürme
const getMagnitudeColor = (magnitude: number | string): string => {
  const mag = typeof magnitude === 'string' ? parseFloat(magnitude) : magnitude;
  if (isNaN(mag)) return '#CCCCCC';
  
  if (mag < 3.0) {
    return '#4CAF50'; // Yeşil
  } else if (mag >= 3.0 && mag <= 4.5) {
    return '#FF9800'; // Turuncu
  } else {
    return '#F44336'; // Kırmızı
  }
};

// Kaynağa göre renk döndürme
const getSourceColor = (source: string): string => {
  const sourceUpper = source.toUpperCase();
  if (sourceUpper.includes('KANDILLI')) {
    return '#2196F3'; // Mavi
  } else if (sourceUpper.includes('USGS')) {
    return '#4CAF50'; // Yeşil
  } else if (sourceUpper.includes('EMSC')) {
    return '#FF9800'; // Turuncu/Sarı
  }
  return '#9E9E9E'; // Gri (varsayılan)
};

// Bildirim handler ayarı (ön planda bildirim gösterimi)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// AdMob Banner Component - Expo Go'da placeholder, Production'da gerçek reklam
const AdBanner = () => {
  const [adModuleAvailable, setAdModuleAvailable] = useState(false);
  const [BannerAdComponent, setBannerAdComponent] = useState<any>(null);
  const [BannerAdSize, setBannerAdSize] = useState<any>(null);
  const [TestIds, setTestIds] = useState<any>(null);
  const [showPlaceholder, setShowPlaceholder] = useState(true);

  useEffect(() => {
    // Development modu kontrolü (Expo Go veya __DEV__)
    const isDevelopmentMode = __DEV__ || Constants.executionEnvironment !== 'storeClient';
    
    // Development modundaysa direkt placeholder göster
    if (isDevelopmentMode) {
      setShowPlaceholder(true);
      return;
    }

    // Production modunda gerçek reklamı yükle
    const loadAdModule = async () => {
      try {
        const adModule = await import('react-native-google-mobile-ads');
        setBannerAdComponent(adModule.BannerAd);
        setBannerAdSize(adModule.BannerAdSize);
        setTestIds(adModule.TestIds);
        setAdModuleAvailable(true);
        setShowPlaceholder(false);
      } catch (error) {
        // Native modül yüklenemezse placeholder göster
        console.log('AdMob modülü yüklenemedi:', error);
        setShowPlaceholder(true);
      }
    };

    loadAdModule();
  }, []);

  // Development modunda veya modül yüklenemezse: Placeholder göster
  if (showPlaceholder || !adModuleAvailable || !BannerAdComponent || !BannerAdSize || !TestIds) {
    return (
      <View style={styles.adContainer}>
        <View style={styles.adPlaceholder}>
          <Text style={styles.adPlaceholderText}>Reklam Alanı (Test)</Text>
        </View>
      </View>
    );
  }

  // Production modunda: Gerçek reklam göster
  return (
    <View style={styles.adContainer}>
      <BannerAdComponent
        unitId={TestIds.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={(error: any) => {
          // Hata durumunda sessizce geç
          console.log('Reklam yüklenemedi:', error);
        }}
      />
    </View>
  );
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [filteredEarthquakes, setFilteredEarthquakes] = useState<Earthquake[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [selectedEarthquake, setSelectedEarthquake] = useState<Earthquake | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isPro, setIsPro] = useState<boolean>(false);

  // GPS konumu alma
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Konum izni verilmedi');
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        console.error('Konum alma hatası:', error);
        setLocationError('Konum alınamadı');
      }
    };

    getLocation();
  }, []);

  // Bildirim izni ve token alma
  useEffect(() => {
    const requestNotificationPermissions = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          try {
            // ProjectId'yi expo-constants'tan al
            const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                            Constants.expoConfig?.projectId ||
                            Constants.easConfig?.projectId;
            
            // ProjectId varsa token al, yoksa sadece izin verildiğini logla
            if (projectId) {
              const token = await Notifications.getExpoPushTokenAsync({
                projectId: projectId
              });
              console.log('Expo Push Token:', token.data);
            } else {
              console.log('Bildirim izni verildi, ancak projectId bulunamadı. Token alınamadı.');
              console.log('Not: Expo Go kullanıyorsanız veya projectId yapılandırması yoksa bu normaldir.');
            }
          } catch (tokenError: any) {
            // Token alma hatası - uygulama çalışmaya devam etsin
            console.warn('Push token alınamadı:', tokenError.message);
            console.log('Bildirim izni verildi, ancak token alınamadı. Uygulama çalışmaya devam ediyor.');
          }
        } else {
          console.log('Bildirim izni verilmedi');
        }
      } catch (error) {
        console.error('Bildirim izni hatası:', error);
      }
    };

    requestNotificationPermissions();
  }, []);

  const fetchEarthquakes = async () => {
    try {
      setError(null); // Hata durumunu temizle
      const response = await axios.get(API_URL, { timeout: 10000 });
      
      if (response.data && Array.isArray(response.data)) {
        if (response.data.length === 0) {
          setError('Henüz deprem verisi bulunmuyor. Lütfen daha sonra tekrar deneyin.');
          setEarthquakes([]);
        } else {
          setEarthquakes(response.data);
        }
      } else if (response.data && Array.isArray(response.data.depremler)) {
        if (response.data.depremler.length === 0) {
          setError('Henüz deprem verisi bulunmuyor. Lütfen daha sonra tekrar deneyin.');
          setEarthquakes([]);
        } else {
          setEarthquakes(response.data.depremler);
        }
      } else {
        setError('Beklenmeyen veri formatı alındı.');
        setEarthquakes([]);
      }
    } catch (error: any) {
      console.error('Deprem verileri çekilirken hata:', error);
      
      let errorMessage = 'Deprem verileri çekilirken bir hata oluştu.';
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.';
      } else if (error.code === 'ECONNREFUSED' || error.response === undefined) {
        errorMessage = 'Sunucuya bağlanılamadı. Sunucunun çalıştığından emin olun.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.';
      } else if (error.response?.status === 404) {
        errorMessage = 'API endpoint bulunamadı.';
      } else if (error.response?.status >= 400 && error.response?.status < 500) {
        errorMessage = 'İstek hatası oluştu. Lütfen daha sonra tekrar deneyin.';
      }
      
      setError(errorMessage);
      setEarthquakes([]);
      
      // Kullanıcıya Alert göster (sadece ilk yüklemede değil, manuel yenilemede de)
      if (!loading) {
        Alert.alert('Hata', errorMessage, [{ text: 'Tamam' }]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // PRO durumunu kontrol et
  const checkProStatus = async () => {
    try {
      const proStatus = await AsyncStorage.getItem(STORAGE_KEYS.IS_PRO);
      setIsPro(proStatus === 'true');
    } catch (error) {
      console.error('PRO durumu kontrol edilirken hata:', error);
      setIsPro(false);
    }
  };

  // Ayarları yükle
  useEffect(() => {
    const loadAppSettings = async () => {
      const loadedSettings = await loadSettings();
      setSettings(loadedSettings);
    };
    loadAppSettings();
    checkProStatus();
  }, []);

  // Sayfa odaklandığında ayarları ve PRO durumunu yeniden yükle (ayarlar veya abonelik değiştiğinde)
  useFocusEffect(
    React.useCallback(() => {
      const loadAppSettings = async () => {
        const loadedSettings = await loadSettings();
        setSettings(loadedSettings);
      };
      loadAppSettings();
      checkProStatus();
    }, [])
  );

  // Depremleri ayarlara göre filtrele
  useEffect(() => {
    if (settings && earthquakes.length > 0) {
      const filtered = earthquakes.filter((eq) =>
        filterEarthquakeBySettings(
          { mag: eq.mag, lat: eq.lat, lng: eq.lng },
          userLocation,
          settings
        )
      );
      setFilteredEarthquakes(filtered);
    } else {
      setFilteredEarthquakes(earthquakes);
    }
  }, [earthquakes, settings, userLocation]);

  // İlk yükleme ve otomatik yenileme
  useEffect(() => {
    fetchEarthquakes();
    
    // Her 30 saniyede bir otomatik yenileme
    const interval = setInterval(() => {
      fetchEarthquakes();
    }, 30000); // 30 saniye

    return () => clearInterval(interval);
  }, []);

  // Header'a yenileme butonu ekle
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            setRefreshing(true);
            fetchEarthquakes();
          }}
          style={styles.refreshButton}
        >
          <Ionicons name="refresh" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      ),
      headerShown: true,
      headerStyle: {
        backgroundColor: '#000000',
      },
      headerTintColor: '#FFFFFF',
      headerTitle: 'Depremler',
    });
  }, [navigation]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchEarthquakes();
  }, []);

  // Mesafe hesaplama
  const getDistance = (earthquake: Earthquake): string => {
    if (!userLocation || earthquake.lat === undefined || earthquake.lng === undefined) {
      return 'Hesaplanıyor...';
    }
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      earthquake.lat,
      earthquake.lng
    );
    return `${distance.toFixed(1)} km`;
  };

  // Büyüklük değerini formatla
  const formatMagnitude = (mag: number | string): string => {
    const magnitude = typeof mag === 'string' ? parseFloat(mag) : mag;
    if (isNaN(magnitude)) return 'N/A';
    return magnitude.toFixed(1);
  };

  // Büyüklük kritik mi kontrolü (> 4.5)
  const isCriticalMagnitude = (magnitude: number | string): boolean => {
    const mag = typeof magnitude === 'string' ? parseFloat(magnitude) : magnitude;
    return !isNaN(mag) && mag > 4.5;
  };

  // Harita modal'ını aç
  const openMapModal = (earthquake: Earthquake) => {
    setSelectedEarthquake(earthquake);
    setMapModalVisible(true);
  };

  // Harita modal'ını kapat
  const closeMapModal = () => {
    setMapModalVisible(false);
    setSelectedEarthquake(null);
  };

  // Paylaş fonksiyonu
  const handleShare = async (earthquake: Earthquake) => {
    try {
      const shareMessage = `Deprem Bilgisi:\n\nYer: ${earthquake.location}\nBüyüklük: ${formatMagnitude(earthquake.mag)}\nDerinlik: ${earthquake.depth} km\nTarih: ${earthquake.date}\nKaynak: ${earthquake.source}\nKoordinatlar: ${earthquake.lat.toFixed(4)}, ${earthquake.lng.toFixed(4)}`;
      
      await Share.share({
        message: shareMessage,
        title: 'Deprem Bilgisi',
      });
    } catch (error) {
      console.error('Paylaşım hatası:', error);
    }
  };

  // Tarih detayları göster
  const handleDateDetails = (earthquake: Earthquake) => {
    Alert.alert(
      'Deprem Detayları',
      `Tarih/Saat: ${earthquake.date}\nYer: ${earthquake.location}\nBüyüklük: ${formatMagnitude(earthquake.mag)}\nDerinlik: ${earthquake.depth} km\nKaynak: ${earthquake.source}`,
      [{ text: 'Tamam' }]
    );
  };

  // Animasyonlu Büyüklük Container Component
  const AnimatedMagnitudeContainer = ({ magnitude, isCritical }: { magnitude: string; isCritical: boolean }) => {
    const blinkAnim = React.useRef(new Animated.Value(1)).current;
    const magnitudeColor = getMagnitudeColor(parseFloat(magnitude));

    useEffect(() => {
      if (isCritical) {
        const blink = Animated.loop(
          Animated.sequence([
            Animated.timing(blinkAnim, {
              toValue: 0.3,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(blinkAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        );
        blink.start();
        return () => blink.stop();
      }
    }, [isCritical]);

    const magnitudeStyle = isCritical
      ? [styles.magnitudeContainer, { backgroundColor: magnitudeColor, opacity: blinkAnim }]
      : [styles.magnitudeContainer, { backgroundColor: magnitudeColor }];

    return (
      <Animated.View style={magnitudeStyle}>
        <Text style={styles.magnitudeText}>{magnitude}</Text>
      </Animated.View>
    );
  };

  const renderEarthquakeItem = ({ item }: { item: Earthquake }) => {
    const magnitude = typeof item.mag === 'string' ? parseFloat(item.mag) : item.mag;
    const isCritical = isCriticalMagnitude(item.mag);
    const sourceColor = getSourceColor(item.source || '');

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => openMapModal(item)}
        activeOpacity={0.9}
      >
        {/* Üst Satır: Yer İsmi, Source Badge ve Büyüklük */}
        <View style={styles.topRow}>
          <View style={styles.locationContainer}>
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
          <View style={styles.rightColumn}>
            <View style={[styles.sourceBadge, { backgroundColor: sourceColor }]}>
              <Text style={styles.sourceBadgeText}>{item.source || 'N/A'}</Text>
            </View>
            <AnimatedMagnitudeContainer 
              magnitude={formatMagnitude(item.mag)} 
              isCritical={isCritical} 
            />
          </View>
        </View>

        {/* Orta Satır: Uzaklık */}
        <View style={styles.middleRow}>
          <Text style={styles.distanceText}>
            📍 Uzaklık: {getDistance(item)}
          </Text>
        </View>

        {/* Alt Satır: Detaylar */}
        <View style={styles.bottomRow}>
          <Text style={styles.detailText}>
            📅 {formatDateTime(item.date)} | 📉 Derinlik: {item.depth} km | 🌐 {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
          </Text>
        </View>

        {/* Butonlar */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              openMapModal(item);
            }}
          >
            <Ionicons name="map" size={20} color="#4CAF50" />
            <Text style={styles.actionButtonText}>Harita</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleDateDetails(item);
            }}
          >
            <Ionicons name="calendar" size={20} color="#FF9800" />
            <Text style={styles.actionButtonText}>Tarih</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleShare(item);
            }}
          >
            <Ionicons name="share-social" size={20} color="#2196F3" />
            <Text style={styles.actionButtonText}>Paylaş</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Deprem verileri yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={24} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setLoading(true);
              fetchEarthquakes();
            }}
          >
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {!error && filteredEarthquakes.length === 0 && earthquakes.length > 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="filter" size={48} color="#9E9E9E" />
          <Text style={styles.emptyText}>Filtre kriterlerinize uygun deprem bulunamadı</Text>
          <Text style={styles.emptySubText}>Ayarlardan filtre kriterlerinizi değiştirebilirsiniz</Text>
        </View>
      )}
      {!error && earthquakes.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="information-circle" size={48} color="#9E9E9E" />
          <Text style={styles.emptyText}>Henüz deprem verisi bulunmuyor</Text>
          <Text style={styles.emptySubText}>Lütfen daha sonra tekrar deneyin</Text>
        </View>
      )}

      <FlatList
        data={filteredEarthquakes}
        renderItem={renderEarthquakeItem}
        keyExtractor={(item, index) => `${item.date}-${item.lat}-${item.lng}-${index}`}
        contentContainerStyle={[
          filteredEarthquakes.length === 0 ? styles.listContentEmpty : styles.listContent,
          { paddingBottom: isPro ? 20 : 100 } // PRO ise normal padding, değilse reklam için boşluk
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
          />
        }
        ListEmptyComponent={
          !error ? (
            <View style={styles.emptyContainer}>
              {filteredEarthquakes.length === 0 && earthquakes.length > 0 ? (
                <>
                  <Ionicons name="filter" size={48} color="#9E9E9E" />
                  <Text style={styles.emptyText}>Filtre kriterlerinize uygun deprem bulunamadı</Text>
                  <Text style={styles.emptySubText}>Ayarlardan filtre kriterlerinizi değiştirebilirsiniz</Text>
                </>
              ) : (
                <>
                  <Ionicons name="information-circle" size={48} color="#9E9E9E" />
                  <Text style={styles.emptyText}>Henüz deprem verisi bulunmuyor</Text>
                  <Text style={styles.emptySubText}>Lütfen daha sonra tekrar deneyin</Text>
                </>
              )}
            </View>
          ) : null
        }
      />

      {/* AdMob Banner Reklam - Sadece PRO değilse göster */}
      {!isPro && <AdBanner />}

      {/* Harita Modal */}
      <Modal
        visible={mapModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeMapModal}
      >
        <View style={styles.mapModalContainer}>
          {selectedEarthquake && (
            <>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: selectedEarthquake.lat,
                  longitude: selectedEarthquake.lng,
                  latitudeDelta: 0.5,
                  longitudeDelta: 0.5,
                }}
                region={{
                  latitude: selectedEarthquake.lat,
                  longitude: selectedEarthquake.lng,
                  latitudeDelta: 0.5,
                  longitudeDelta: 0.5,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: selectedEarthquake.lat,
                    longitude: selectedEarthquake.lng,
                  }}
                  title={selectedEarthquake.location}
                  description={`Büyüklük: ${formatMagnitude(selectedEarthquake.mag)} | Kaynak: ${selectedEarthquake.source}`}
                />
              </MapView>
              <View style={styles.mapHeader}>
                <Text style={styles.mapTitle}>{selectedEarthquake.location}</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeMapModal}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                  <Text style={styles.closeButtonText}>Kapat</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#1F1F1F',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    color: '#9E9E9E',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#E8F5E9', // Açık yeşil
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  locationContainer: {
    flex: 1,
    marginRight: 12,
  },
  rightColumn: {
    alignItems: 'flex-end',
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  sourceBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  locationText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    flexWrap: 'wrap',
    flex: 1,
  },
  refreshButton: {
    marginRight: 16,
    padding: 8,
  },
  magnitudeContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  magnitudeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  middleRow: {
    marginBottom: 8,
  },
  distanceText: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  bottomRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    minWidth: 80,
    justifyContent: 'center',
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  map: {
    flex: 1,
  },
  mapHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#FFFFFF',
    marginLeft: 6,
    fontWeight: 'bold',
  },
  adContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adPlaceholder: {
    width: '100%',
    height: 60,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  adPlaceholderText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
});
