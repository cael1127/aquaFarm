import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useAdmin } from '../contexts/AdminContext';
import { getFarmStorageKey, STORAGE_KEYS } from '../utils/storage';
import { supabase } from '../utils/supabase';

interface AdminPanelScreenProps {
  navigation: any;
}

interface BatchData {
  id: string;
  name: string;
  type: string;
  quantity: number;
  status: string;
  location: string;
  dateCreated: string;
}

interface HarvestData {
  id: string;
  batchId: string;
  quantity: number;
  quality: string;
  date: string;
  notes: string;
}

interface FarmSettings {
  farmName: string;
  location: string;
  waterTemperature: number;
  salinity: number;
  oxygenLevel: number;
  phLevel: number;
  notifications: boolean;
  autoBackup: boolean;
}

const AdminPanelScreen: React.FC<AdminPanelScreenProps> = ({ navigation }) => {
  const { currentUser, isAdmin, farms, addFarm, updateFarm, deleteFarm, getCurrentFarmName } = useAdmin();
  const [activeTab, setActiveTab] = useState<'farms' | 'batches' | 'harvests' | 'settings'>('farms');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  // Data states
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [harvests, setHarvests] = useState<HarvestData[]>([]);
  const [farmSettings, setFarmSettings] = useState<FarmSettings>({
    farmName: getCurrentFarmName(),
    location: currentUser?.location || 'Unknown Location',
    waterTemperature: 18.5,
    salinity: 34.2,
    oxygenLevel: 8.1,
    phLevel: 7.8,
    notifications: true,
    autoBackup: true,
  });

  // Form states
  const [newFarm, setNewFarm] = useState({
    username: '',
    email: '',
    farmName: '',
    farmType: 'oyster' as 'oyster' | 'mussel' | 'salmon' | 'mixed',
    location: '',
    role: 'admin' as 'admin' | 'manager' | 'worker',
    permissions: ['*'] as string[],
  });

  const [newBatch, setNewBatch] = useState({
    name: '',
    type: 'oyster',
    quantity: '',
    location: '',
  });

  const [newHarvest, setNewHarvest] = useState({
    batchId: '',
    quantity: '',
    quality: 'Grade A',
    notes: '',
  });

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You need admin privileges to access this panel.');
      navigation.goBack();
      return;
    }
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    try {
      if (!currentUser?.id) return;
      // Load batches
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .select('*')
        .eq('farm_id', currentUser.id);
      if (batchError) throw batchError;
      setBatches(batchData || []);

      // Load harvests
      const { data: harvestData, error: harvestError } = await supabase
        .from('harvests')
        .select('*')
        .eq('farm_id', currentUser.id);
      if (harvestError) throw harvestError;
      setHarvests(harvestData || []);

      // Load farm settings (assume one row per farm)
      const { data: settingsData, error: settingsError } = await supabase
        .from('farm_settings')
        .select('*')
        .eq('farm_id', currentUser.id)
        .single();
      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError; // ignore no rows error
      if (settingsData) setFarmSettings(settingsData);
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  const saveBatch = async (batch: BatchData) => {
    if (!currentUser?.id) return;
    try {
      if (batch.id) {
        // Update
        await supabase.from('batches').update(batch).eq('id', batch.id).eq('farm_id', currentUser.id);
      } else {
        // Insert
        await supabase.from('batches').insert([{ ...batch, farm_id: currentUser.id }]);
      }
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to save batch');
    }
  };

  const deleteBatch = async (batchId: string) => {
    if (!currentUser?.id) return;
    try {
      await supabase.from('batches').delete().eq('id', batchId).eq('farm_id', currentUser.id);
      setBatches(batches.filter(b => b.id !== batchId));
    } catch (error) {
      Alert.alert('Error', 'Failed to delete batch');
    }
  };

  const saveHarvest = async (harvest: HarvestData) => {
    if (!currentUser?.id) return;
    try {
      if (harvest.id) {
        await supabase.from('harvests').update(harvest).eq('id', harvest.id).eq('farm_id', currentUser.id);
      } else {
        await supabase.from('harvests').insert([{ ...harvest, farm_id: currentUser.id }]);
      }
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to save harvest');
    }
  };

  const deleteHarvest = async (harvestId: string) => {
    if (!currentUser?.id) return;
    try {
      await supabase.from('harvests').delete().eq('id', harvestId).eq('farm_id', currentUser.id);
      setHarvests(harvests.filter(h => h.id !== harvestId));
    } catch (error) {
      Alert.alert('Error', 'Failed to delete harvest');
    }
  };

  const saveFarmSettings = async (settings: FarmSettings) => {
    if (!currentUser?.id) return;
    try {
      // Upsert (insert or update)
      await supabase.from('farm_settings').upsert([{ ...settings, farm_id: currentUser.id }], { onConflict: ['farm_id'] });
      setFarmSettings(settings);
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleAddFarm = async () => {
    if (!newFarm.username || !newFarm.email || !newFarm.farmName) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const permissions = getDefaultPermissions(newFarm.role);
    await addFarm({ ...newFarm, permissions });
    setShowAddModal(false);
    setNewFarm({ username: '', email: '', farmName: '', farmType: 'oyster', location: '', role: 'admin', permissions: ['*'] });
    Alert.alert('Success', 'Farm added successfully');
  };

  const handleAddBatch = async () => {
    if (!newBatch.name || !newBatch.quantity) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const batch: BatchData = {
      id: `batch-${Date.now()}`,
      name: newBatch.name,
      type: newBatch.type,
      quantity: parseInt(newBatch.quantity),
      status: 'active',
      location: newBatch.location,
      dateCreated: new Date().toISOString(),
    };

    const updatedBatches = [...batches, batch];
    setBatches(updatedBatches);
    await saveBatch(batch);
    setShowAddModal(false);
    setNewBatch({ name: '', type: 'oyster', quantity: '', location: '' });
    Alert.alert('Success', 'Batch added successfully');
  };

  const handleAddHarvest = async () => {
    if (!newHarvest.batchId || !newHarvest.quantity) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const harvest: HarvestData = {
      id: `harvest-${Date.now()}`,
      batchId: newHarvest.batchId,
      quantity: parseInt(newHarvest.quantity),
      quality: newHarvest.quality,
      date: new Date().toISOString(),
      notes: newHarvest.notes,
    };

    const updatedHarvests = [...harvests, harvest];
    setHarvests(updatedHarvests);
    await saveHarvest(harvest);
    setShowAddModal(false);
    setNewHarvest({ batchId: '', quantity: '', quality: 'Grade A', notes: '' });
    Alert.alert('Success', 'Harvest recorded successfully');
  };

  const handleDeleteItem = async (type: string, id: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (type === 'farm') {
              await deleteFarm(id);
            } else if (type === 'batch') {
              await deleteBatch(id);
            } else if (type === 'harvest') {
              await deleteHarvest(id);
            }
            Alert.alert('Success', 'Item deleted successfully');
          },
        },
      ]
    );
  };

  const getDefaultPermissions = (role: string): string[] => {
    switch (role) {
      case 'admin':
        return ['*'];
      case 'manager':
        return ['view_dashboard', 'edit_batches', 'edit_harvests', 'view_farm_map', 'manage_workers'];
      case 'worker':
        return ['view_dashboard', 'view_batches', 'add_harvest'];
      default:
        return [];
    }
  };

  const updateFarmSettings = async (newSettings: Partial<FarmSettings>) => {
    const updatedSettings = { ...farmSettings, ...newSettings };
    setFarmSettings(updatedSettings);
    await saveFarmSettings(updatedSettings);
  };

  const renderTabButton = (tab: string, icon: string, label: string) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
      onPress={() => setActiveTab(tab as any)}
    >
      <Ionicons 
        name={icon as any} 
        size={20} 
        color={activeTab === tab ? Colors.surface : Colors.primary} 
      />
      <Text style={[
        styles.tabButtonText,
        activeTab === tab && styles.activeTabButtonText
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderFarmManagement = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Farm Management</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={20} color={Colors.surface} />
          <Text style={styles.addButtonText}>Add Farm</Text>
        </TouchableOpacity>
      </View>

      {farms.map((farm: any) => (
        <View key={farm.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{farm.farmName}</Text>
            <View style={styles.itemActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setSelectedItem(farm);
                  setShowEditModal(true);
                }}
              >
                <Ionicons name="create" size={16} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteItem('farm', farm.id)}
              >
                <Ionicons name="trash" size={16} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.itemSubtitle}>{farm.email}</Text>
          <View style={styles.itemDetails}>
            <Text style={styles.itemDetail}>Type: {farm.farmType}</Text>
            <Text style={styles.itemDetail}>Location: {farm.location}</Text>
            <Text style={styles.itemDetail}>
              Last Login: {new Date(farm.lastLogin).toLocaleDateString()}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderBatchManagement = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Batch Management</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={20} color={Colors.surface} />
          <Text style={styles.addButtonText}>Add Batch</Text>
        </TouchableOpacity>
      </View>

      {batches.map((batch) => (
        <View key={batch.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{batch.name}</Text>
            <View style={styles.itemActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setSelectedItem(batch);
                  setShowEditModal(true);
                }}
              >
                <Ionicons name="create" size={16} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteItem('batch', batch.id)}
              >
                <Ionicons name="trash" size={16} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.itemSubtitle}>{batch.type} • {batch.quantity} units</Text>
          <View style={styles.itemDetails}>
            <Text style={styles.itemDetail}>Status: {batch.status}</Text>
            <Text style={styles.itemDetail}>Location: {batch.location}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderHarvestManagement = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Harvest Management</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={20} color={Colors.surface} />
          <Text style={styles.addButtonText}>Add Harvest</Text>
        </TouchableOpacity>
      </View>

      {harvests.map((harvest) => (
        <View key={harvest.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>Harvest #{harvest.id.slice(-6)}</Text>
            <View style={styles.itemActions}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteItem('harvest', harvest.id)}
              >
                <Ionicons name="trash" size={16} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.itemSubtitle}>{harvest.quantity} units • {harvest.quality}</Text>
          <View style={styles.itemDetails}>
            <Text style={styles.itemDetail}>Batch: {harvest.batchId}</Text>
            <Text style={styles.itemDetail}>
              Date: {new Date(harvest.date).toLocaleDateString()}
            </Text>
          </View>
          {harvest.notes && (
            <Text style={styles.itemNotes}>Notes: {harvest.notes}</Text>
          )}
        </View>
      ))}
    </View>
  );

  const renderFarmSettings = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Farm Settings</Text>
      
      <View style={styles.settingsSection}>
        <Text style={styles.settingsLabel}>Farm Name</Text>
        <TextInput
          style={styles.settingsInput}
          value={farmSettings.farmName}
          onChangeText={(text) => updateFarmSettings({ farmName: text })}
        />
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsLabel}>Location</Text>
        <TextInput
          style={styles.settingsInput}
          value={farmSettings.location}
          onChangeText={(text) => updateFarmSettings({ location: text })}
        />
      </View>

      <View style={styles.settingsRow}>
        <View style={styles.settingsHalf}>
          <Text style={styles.settingsLabel}>Water Temp (°C)</Text>
          <TextInput
            style={styles.settingsInput}
            value={farmSettings.waterTemperature.toString()}
            onChangeText={(text) => updateFarmSettings({ waterTemperature: parseFloat(text) || 0 })}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.settingsHalf}>
          <Text style={styles.settingsLabel}>Salinity (ppt)</Text>
          <TextInput
            style={styles.settingsInput}
            value={farmSettings.salinity.toString()}
            onChangeText={(text) => updateFarmSettings({ salinity: parseFloat(text) || 0 })}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.settingsRow}>
        <View style={styles.settingsHalf}>
          <Text style={styles.settingsLabel}>Oxygen (mg/L)</Text>
          <TextInput
            style={styles.settingsInput}
            value={farmSettings.oxygenLevel.toString()}
            onChangeText={(text) => updateFarmSettings({ oxygenLevel: parseFloat(text) || 0 })}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.settingsHalf}>
          <Text style={styles.settingsLabel}>pH Level</Text>
          <TextInput
            style={styles.settingsInput}
            value={farmSettings.phLevel.toString()}
            onChangeText={(text) => updateFarmSettings({ phLevel: parseFloat(text) || 0 })}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.settingsLabel}>Enable Notifications</Text>
        <Switch
          value={farmSettings.notifications}
          onValueChange={(value) => updateFarmSettings({ notifications: value })}
          trackColor={{ false: '#767577', true: Colors.primary }}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.settingsLabel}>Auto Backup</Text>
        <Switch
          value={farmSettings.autoBackup}
          onValueChange={(value) => updateFarmSettings({ autoBackup: value })}
          trackColor={{ false: '#767577', true: Colors.primary }}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <View style={styles.userInfo}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
            <Text style={styles.userName}>{currentUser?.username}</Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          {renderTabButton('farms', 'business', 'Farms')}
          {renderTabButton('batches', 'fish', 'Batches')}
          {renderTabButton('harvests', 'basket', 'Harvests')}
          {renderTabButton('settings', 'settings', 'Settings')}
        </View>

        {/* Content */}
        <ScrollView style={styles.content}>
          {activeTab === 'farms' && renderFarmManagement()}
          {activeTab === 'batches' && renderBatchManagement()}
          {activeTab === 'harvests' && renderHarvestManagement()}
          {activeTab === 'settings' && renderFarmSettings()}
        </ScrollView>

        {/* Add Modal */}
        <Modal visible={showAddModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Add New {activeTab === 'farms' ? 'Farm' : activeTab === 'batches' ? 'Batch' : 'Harvest'}
              </Text>
              
              {activeTab === 'farms' && (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Username"
                    value={newFarm.username}
                    onChangeText={(text) => setNewFarm({ ...newFarm, username: text })}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={newFarm.email}
                    onChangeText={(text) => setNewFarm({ ...newFarm, email: text })}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Farm Name"
                    value={newFarm.farmName}
                    onChangeText={(text) => setNewFarm({ ...newFarm, farmName: text })}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Location"
                    value={newFarm.location}
                    onChangeText={(text) => setNewFarm({ ...newFarm, location: text })}
                  />
                  <View style={styles.roleSelector}>
                    <Text style={styles.inputLabel}>Farm Type:</Text>
                    <View style={styles.roleButtons}>
                      {['oyster', 'mussel', 'salmon', 'mixed'].map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.roleButton,
                            newFarm.farmType === type && styles.roleButtonActive,
                          ]}
                          onPress={() => setNewFarm({ ...newFarm, farmType: type as any })}
                        >
                          <Text
                            style={[
                              styles.roleButtonText,
                              newFarm.farmType === type && styles.roleButtonTextActive,
                            ]}
                          >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {activeTab === 'batches' && (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Batch Name"
                    value={newBatch.name}
                    onChangeText={(text) => setNewBatch({ ...newBatch, name: text })}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Quantity"
                    value={newBatch.quantity}
                    onChangeText={(text) => setNewBatch({ ...newBatch, quantity: text })}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Location"
                    value={newBatch.location}
                    onChangeText={(text) => setNewBatch({ ...newBatch, location: text })}
                  />
                </>
              )}

              {activeTab === 'harvests' && (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Batch ID"
                    value={newHarvest.batchId}
                    onChangeText={(text) => setNewHarvest({ ...newHarvest, batchId: text })}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Notes (optional)"
                    value={newHarvest.notes}
                    onChangeText={(text) => setNewHarvest({ ...newHarvest, notes: text })}
                    multiline
                  />
                </>
              )}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={() => {
                    if (activeTab === 'farms') handleAddFarm();
                    else if (activeTab === 'batches') handleAddBatch();
                    else if (activeTab === 'harvests') handleAddHarvest();
                  }}
                >
                  <Text style={styles.confirmButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    ...Typography.body2,
    color: Colors.primary,
    marginLeft: Spacing.xs,
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.xs,
  },
  activeTabButton: {
    backgroundColor: Colors.primary,
  },
  tabButtonText: {
    ...Typography.body2,
    color: Colors.primary,
    marginLeft: Spacing.xs,
  },
  activeTabButtonText: {
    color: Colors.surface,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  addButtonText: {
    ...Typography.body2,
    color: Colors.surface,
    marginLeft: Spacing.xs,
  },
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  itemSubtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemDetail: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  itemNotes: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  itemActions: {
    flexDirection: 'row',
  },
  editButton: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  deleteButton: {
    padding: Spacing.sm,
  },
  settingsSection: {
    marginBottom: Spacing.lg,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  settingsHalf: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  settingsLabel: {
    ...Typography.body1,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  settingsInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body1,
    backgroundColor: Colors.surface,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Typography.body1,
  },
  inputLabel: {
    ...Typography.body1,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  roleSelector: {
    marginBottom: Spacing.md,
  },
  roleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleButton: {
    flex: 1,
    padding: Spacing.sm,
    marginHorizontal: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: Colors.primary,
  },
  roleButtonText: {
    ...Typography.body2,
    color: Colors.primary,
  },
  roleButtonTextActive: {
    color: Colors.surface,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginHorizontal: Spacing.xs,
  },
  cancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
  },
  cancelButtonText: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  confirmButtonText: {
    ...Typography.body1,
    color: Colors.surface,
    fontWeight: 'bold',
  },
});

export default AdminPanelScreen;
