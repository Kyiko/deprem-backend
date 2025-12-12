import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';

interface MercalliLevel {
  level: string;
  description: string;
  backgroundColor: string;
  textColor: string;
}

const mercalliLevels: MercalliLevel[] = [
  {
    level: 'II',
    description: 'Zar zor algılanan',
    backgroundColor: '#D3D3D3', // Açık Gri
    textColor: '#000000',
  },
  {
    level: 'III',
    description: 'Kamyon geçişi gibi',
    backgroundColor: '#ADD8E6', // Açık Mavi
    textColor: '#000000',
  },
  {
    level: 'IV',
    description: 'Pencerelerin titreşimi',
    backgroundColor: '#40E0D0', // Turkuaz
    textColor: '#FFFFFF',
  },
  {
    level: 'V',
    description: 'Raflardan düşen nesneler',
    backgroundColor: '#4CAF50', // Yeşil
    textColor: '#FFFFFF',
  },
  {
    level: 'VI',
    description: 'Küçük çatlaklar',
    backgroundColor: '#FFEB3B', // Sarı
    textColor: '#000000',
  },
  {
    level: 'VII',
    description: 'Ayakta durmak zor',
    backgroundColor: '#FF9800', // Turuncu
    textColor: '#FFFFFF',
  },
  {
    level: 'VIII+',
    description: 'Yıkım',
    backgroundColor: '#C62828', // Koyu Kırmızı
    textColor: '#FFFFFF',
  },
];

export default function RaporScreen() {
  const [showSuccess, setShowSuccess] = useState(false);
  const reportCount = 3089; // Son 24 saatteki raporlar

  const handleReport = (level: MercalliLevel) => {
    Alert.alert(
      'DİKKAT!',
      'Gerçekten bu depremi bildirmek istiyor musunuz?',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'EVET, BİLDİR',
          onPress: () => {
            // Rapor gönderme işlemi (şimdilik sadece görsel)
            setShowSuccess(true);
            // 3 saniye sonra otomatik kapan
            setTimeout(() => {
              setShowSuccess(false);
            }, 3000);
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Sayaç Bölümü */}
        <View style={styles.counterContainer}>
          <Text style={styles.counterNumber}>{reportCount}</Text>
          <Text style={styles.counterText}>Son 24 saatteki raporlar</Text>
        </View>

        {/* Mercalli Şiddet Ölçeği Listesi */}
        <View style={styles.listContainer}>
          {mercalliLevels.map((level, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.levelCard,
                { backgroundColor: level.backgroundColor },
              ]}
              onPress={() => handleReport(level)}
              activeOpacity={0.8}
            >
              <View style={styles.levelContent}>
                <Text style={[styles.levelNumber, { color: level.textColor }]}>
                  {level.level}
                </Text>
                <Text style={[styles.levelDescription, { color: level.textColor }]}>
                  {level.description}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Başarı Mesajı Modal */}
      <Modal
        visible={showSuccess}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccess(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successContainer}>
            <Text style={styles.successText}>
              Raporunuz başarıyla gönderildi, teşekkürler!
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowSuccess(false)}
            >
              <Text style={styles.closeButtonText}>Kapat</Text>
            </TouchableOpacity>
          </View>
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
  scrollContent: {
    padding: 16,
  },
  counterContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
    paddingVertical: 24,
  },
  counterNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  counterText: {
    fontSize: 18,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  listContainer: {
    gap: 16,
  },
  levelCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  levelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    marginRight: 16,
  },
  levelDescription: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContainer: {
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  successText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  closeButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
});


