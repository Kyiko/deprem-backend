import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ExternalLink } from '@/components/external-link';
import { STORAGE_KEYS } from '@/utils/settings';

interface SubscriptionPlan {
  id: string;
  title: string;
  price: string;
  period: string;
  badge?: string;
}

const plans: SubscriptionPlan[] = [
  {
    id: 'weekly',
    title: 'Haftalık',
    price: '₺19.99',
    period: '/hafta',
  },
  {
    id: 'monthly',
    title: 'Aylık',
    price: '₺49.99',
    period: '/ay',
    badge: 'En Popüler',
  },
  {
    id: 'yearly',
    title: 'Yıllık',
    price: '₺299.99',
    period: '/yıl',
    badge: 'En Avantajlı',
  },
];

export default function AbonelikScreen() {
  const handlePurchase = async (planId: string, planTitle: string) => {
    try {
      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Simüle edilmiş satın alma - AsyncStorage'a kaydet
      await AsyncStorage.setItem(STORAGE_KEYS.IS_PRO, 'true');

      Alert.alert(
        'Satın Alma Başarılı',
        `${planTitle} planı başarıyla satın alındı. Artık reklamsız deneyimin keyfini çıkarabilirsiniz!`,
        [{ text: 'Tamam' }]
      );
    } catch (error) {
      console.error('Satın alma hatası:', error);
      Alert.alert('Hata', 'Satın alma işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.', [
        { text: 'Tamam' },
      ]);
    }
  };

  const handleRestorePurchase = async () => {
    try {
      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Mock restore - AsyncStorage'dan kontrol et
      const isPro = await AsyncStorage.getItem(STORAGE_KEYS.IS_PRO);
      
      if (isPro === 'true') {
        Alert.alert('Başarılı', 'Satın alımlarınız geri yüklendi.', [{ text: 'Tamam' }]);
      } else {
        Alert.alert(
          'Satın Alım Bulunamadı',
          'Geri yüklenecek bir satın alım bulunamadı.',
          [{ text: 'Tamam' }]
        );
      }
    } catch (error) {
      console.error('Geri yükleme hatası:', error);
      Alert.alert('Hata', 'Satın alımlar geri yüklenirken bir hata oluştu.', [{ text: 'Tamam' }]);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.iconContainer}>
            <IconSymbol size={80} name="shield.fill" color="#FFD700" />
          </View>
          <Text style={styles.title}>Reklamsız Deneyim</Text>
          <Text style={styles.description}>
            Deprem uyarılarına erişim her zaman ücretsizdir. Bu abonelik sadece reklamları kaldırır
            ve geliştiriciye destek olmanızı sağlar.
          </Text>
        </View>

        {/* Subscription Plans */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={styles.planCard}
              onPress={() => handlePurchase(plan.id, plan.title)}
              activeOpacity={0.8}
            >
              {plan.badge && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{plan.badge}</Text>
                </View>
              )}
              <View style={styles.planContent}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.price}>{plan.price}</Text>
                  <Text style={styles.period}>{plan.period}</Text>
                </View>
              </View>
              <IconSymbol size={24} name="chevron.right" color="#8E8E93" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer Links */}
        <View style={styles.footerSection}>
          <TouchableOpacity
            style={styles.footerButton}
            onPress={handleRestorePurchase}
            activeOpacity={0.7}
          >
            <Text style={styles.footerButtonText}>Satın Alı Yükle</Text>
          </TouchableOpacity>

          <ExternalLink href="https://example.com/privacy">
            <Text style={styles.privacyLink}>Gizlilik Sözleşmesi</Text>
          </ExternalLink>
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
  headerSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  plansContainer: {
    gap: 16,
    marginBottom: 32,
  },
  planCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  badgeContainer: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
  },
  planContent: {
    flex: 1,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  period: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 4,
  },
  footerSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  footerButtonText: {
    fontSize: 16,
    color: '#0A84FF',
    fontWeight: '500',
  },
  privacyLink: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 16,
    textDecorationLine: 'underline',
  },
});
