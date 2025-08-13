import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useAdmin } from '../contexts/AdminContext';
import { getFarmStorageKey, STORAGE_KEYS } from '../utils/storage';
import { supabase } from '../utils/supabase';

interface FarmSettings {
  farmName: string;
  ownerName: string;
  location: string;
  currency: string;
  units: 'metric' | 'imperial';
  language: string;
  timezone: string;
  notifications: {
    harvestReminders: boolean;
    growthAlerts: boolean;
    maintenanceAlerts: boolean;
    weatherAlerts: boolean;
  };
  pricing: {
    oysterPrice: number;
    musselPrice: number;
    salmonPrice: number;
  };
  thresholds: {
    harvestSize: {
      oyster: number;
      mussel: number;
      salmon: number;
    };
    maintenanceInterval: number;
    growthAlertThreshold: number;
  };
}

const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { currentUser, getCurrentFarmName } = useAdmin();
  const [settings, setSettings] = useState<FarmSettings>({
    farmName: 'My Aquafarm',
    ownerName: '',
    location: '',
    currency: 'USD',
    units: 'imperial',
    language: 'English',
    timezone: 'UTC',
    notifications: {
      harvestReminders: true,
      growthAlerts: true,
      maintenanceAlerts: true,
      weatherAlerts: false,
    },
    pricing: {
      oysterPrice: 0.75,
      musselPrice: 0.50,
      salmonPrice: 8.00,
    },
    thresholds: {
      harvestSize: {
        oyster: 2.5,
        mussel: 2.0,
        salmon: 500,
      },
      maintenanceInterval: 30,
      growthAlertThreshold: 10,
    },
  });

  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showThresholdsModal, setShowThresholdsModal] = useState(false);
  const [tempPricing, setTempPricing] = useState(settings.pricing);
  const [tempThresholds, setTempThresholds] = useState(settings.thresholds);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      if (!currentUser?.id) return;
      const { data, error } = await supabase
        .from('farm_settings')
        .select('*')
        .eq('farm_id', currentUser.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // ignore no rows error
      if (data) {
        setSettings({ ...settings, ...data });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: FarmSettings) => {
    try {
      if (!currentUser?.id) return;
      await supabase.from('farm_settings').upsert([{ ...newSettings, farm_id: currentUser.id }], { onConflict: ['farm_id'] });
      setSettings(newSettings);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const updateSetting = (key: keyof FarmSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const updateNotificationSetting = (key: keyof FarmSettings['notifications'], value: boolean) => {
    const newSettings = {
      ...settings,
      notifications: { ...settings.notifications, [key]: value }
    };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const savePricing = () => {
    const newSettings = { ...settings, pricing: tempPricing };
    saveSettings(newSettings);
    setShowPricingModal(false);
  };

  const saveThresholds = () => {
    const newSettings = { ...settings, thresholds: tempThresholds };
    saveSettings(newSettings);
    setShowThresholdsModal(false);
  };

  const exportSettings = async () => {
    try {
      const settingsData = JSON.stringify(settings, null, 2);
      // In a real app, you'd use a file sharing library
      Alert.alert('Export Settings', 'Settings exported successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to export settings');
    }
  };

  const resetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              if (currentUser?.id) {
                await supabase.from('farm_settings').delete().eq('farm_id', currentUser.id);
              }
              setSettings({
                farmName: 'My Aquafarm',
                ownerName: '',
                location: '',
                currency: 'USD',
                units: 'imperial',
                language: 'English',
                timezone: 'UTC',
                notifications: {
                  harvestReminders: true,
                  growthAlerts: true,
                  maintenanceAlerts: true,
                  weatherAlerts: false,
                },
                pricing: {
                  oysterPrice: 0.75,
                  musselPrice: 0.50,
                  salmonPrice: 8.00,
                },
                thresholds: {
                  harvestSize: {
                    oyster: 2.5,
                    mussel: 2.0,
                    salmon: 500,
                  },
                  maintenanceInterval: 30,
                  growthAlertThreshold: 10,
                },
              });
              Alert.alert('Success', 'Settings reset to default');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset settings');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity onPress={exportSettings}>
          <Ionicons name="download-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Farm Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farm Information</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Farm Name</Text>
            <TextInput
              style={styles.textInput}
              value={settings.farmName}
              onChangeText={(value) => updateSetting('farmName', value)}
              placeholder="Enter farm name"
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Owner Name</Text>
            <TextInput
              style={styles.textInput}
              value={settings.ownerName}
              onChangeText={(value) => updateSetting('ownerName', value)}
              placeholder="Enter owner name"
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Location</Text>
            <TextInput
              style={styles.textInput}
              value={settings.location}
              onChangeText={(value) => updateSetting('location', value)}
              placeholder="Enter farm location"
            />
          </View>
        </View>

        {/* Regional Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Regional Settings</Text>
          
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Currency</Text>
            <View style={styles.settingValue}>
              <Text style={styles.valueText}>{settings.currency}</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => updateSetting('units', settings.units === 'metric' ? 'imperial' : 'metric')}
          >
            <Text style={styles.settingLabel}>Units</Text>
            <View style={styles.settingValue}>
              <Text style={styles.valueText}>
                {settings.units === 'metric' ? 'Metric (cm, kg)' : 'Imperial (in, lb)'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Language</Text>
            <View style={styles.settingValue}>
              <Text style={styles.valueText}>{settings.language}</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Harvest Reminders</Text>
            <Switch
              value={settings.notifications.harvestReminders}
              onValueChange={(value) => updateNotificationSetting('harvestReminders', value)}
              trackColor={{ false: '#E0E0E0', true: Colors.primary }}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Growth Alerts</Text>
            <Switch
              value={settings.notifications.growthAlerts}
              onValueChange={(value) => updateNotificationSetting('growthAlerts', value)}
              trackColor={{ false: '#E0E0E0', true: Colors.primary }}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Maintenance Alerts</Text>
            <Switch
              value={settings.notifications.maintenanceAlerts}
              onValueChange={(value) => updateNotificationSetting('maintenanceAlerts', value)}
              trackColor={{ false: '#E0E0E0', true: Colors.primary }}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Weather Alerts</Text>
            <Switch
              value={settings.notifications.weatherAlerts}
              onValueChange={(value) => updateNotificationSetting('weatherAlerts', value)}
              trackColor={{ false: '#E0E0E0', true: Colors.primary }}
            />
          </View>
        </View>

        {/* Business Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Settings</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              setTempPricing(settings.pricing);
              setShowPricingModal(true);
            }}
          >
            <Text style={styles.settingLabel}>Market Pricing</Text>
            <View style={styles.settingValue}>
              <Text style={styles.valueText}>Configure prices</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              setTempThresholds(settings.thresholds);
              setShowThresholdsModal(true);
            }}
          >
            <Text style={styles.settingLabel}>Harvest Thresholds</Text>
            <View style={styles.settingValue}>
              <Text style={styles.valueText}>Configure thresholds</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          <TouchableOpacity style={styles.settingItem} onPress={exportSettings}>
            <Text style={styles.settingLabel}>Export Data</Text>
            <Ionicons name="download-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Import Data</Text>
            <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Backup to Cloud</Text>
            <Ionicons name="cloud-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={resetSettings}>
            <Text style={[styles.settingLabel, { color: Colors.error }]}>Reset All Settings</Text>
            <Ionicons name="refresh-outline" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>

        {/* App Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Version</Text>
            <Text style={styles.valueText}>1.0.0</Text>
          </View>

          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Support</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Pricing Modal */}
      <Modal visible={showPricingModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPricingModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Market Pricing</Text>
            <TouchableOpacity onPress={savePricing}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Set your local market prices for accurate value calculations
            </Text>
            
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Oyster Price (per piece)</Text>
              <TextInput
                style={styles.priceInput}
                value={tempPricing.oysterPrice.toString()}
                onChangeText={(text) => setTempPricing({
                  ...tempPricing,
                  oysterPrice: parseFloat(text) || 0
                })}
                keyboardType="decimal-pad"
                placeholder="0.75"
              />
            </View>

            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Mussel Price (per piece)</Text>
              <TextInput
                style={styles.priceInput}
                value={tempPricing.musselPrice.toString()}
                onChangeText={(text) => setTempPricing({
                  ...tempPricing,
                  musselPrice: parseFloat(text) || 0
                })}
                keyboardType="decimal-pad"
                placeholder="0.50"
              />
            </View>

            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Salmon Price (per pound)</Text>
              <TextInput
                style={styles.priceInput}
                value={tempPricing.salmonPrice.toString()}
                onChangeText={(text) => setTempPricing({
                  ...tempPricing,
                  salmonPrice: parseFloat(text) || 0
                })}
                keyboardType="decimal-pad"
                placeholder="8.00"
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Thresholds Modal */}
      <Modal visible={showThresholdsModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowThresholdsModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Harvest Thresholds</Text>
            <TouchableOpacity onPress={saveThresholds}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Set minimum sizes for harvest-ready classification
            </Text>
            
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Oyster Harvest Size (inches)</Text>
              <TextInput
                style={styles.priceInput}
                value={tempThresholds.harvestSize.oyster.toString()}
                onChangeText={(text) => setTempThresholds({
                  ...tempThresholds,
                  harvestSize: {
                    ...tempThresholds.harvestSize,
                    oyster: parseFloat(text) || 0
                  }
                })}
                keyboardType="decimal-pad"
                placeholder="2.5"
              />
            </View>

            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Mussel Harvest Size (inches)</Text>
              <TextInput
                style={styles.priceInput}
                value={tempThresholds.harvestSize.mussel.toString()}
                onChangeText={(text) => setTempThresholds({
                  ...tempThresholds,
                  harvestSize: {
                    ...tempThresholds.harvestSize,
                    mussel: parseFloat(text) || 0
                  }
                })}
                keyboardType="decimal-pad"
                placeholder="2.0"
              />
            </View>

            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Salmon Harvest Weight (grams)</Text>
              <TextInput
                style={styles.priceInput}
                value={tempThresholds.harvestSize.salmon.toString()}
                onChangeText={(text) => setTempThresholds({
                  ...tempThresholds,
                  harvestSize: {
                    ...tempThresholds.harvestSize,
                    salmon: parseFloat(text) || 0
                  }
                })}
                keyboardType="decimal-pad"
                placeholder="500"
              />
            </View>

            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Maintenance Interval (days)</Text>
              <TextInput
                style={styles.priceInput}
                value={tempThresholds.maintenanceInterval.toString()}
                onChangeText={(text) => setTempThresholds({
                  ...tempThresholds,
                  maintenanceInterval: parseInt(text) || 0
                })}
                keyboardType="numeric"
                placeholder="30"
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.surface,
    marginVertical: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: Spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  settingLabel: {
    ...Typography.body1,
    color: Colors.text,
    flex: 1,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginRight: Spacing.sm,
  },
  textInput: {
    ...Typography.body1,
    color: Colors.text,
    textAlign: 'right',
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  modalCancel: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  modalSave: {
    ...Typography.body1,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  modalDescription: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  priceItem: {
    marginBottom: Spacing.lg,
  },
  priceLabel: {
    ...Typography.body1,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  priceInput: {
    ...Typography.body1,
    color: Colors.text,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
});

export default SettingsScreen;
