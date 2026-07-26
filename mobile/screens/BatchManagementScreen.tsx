import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';

interface BatchManagementScreenProps {
  navigation: any;
}

interface Batch {
  id: string;
  name: string;
  species: string;
  location: string;
  startDate: string;
  status: 'Active' | 'Harvested' | 'Pending';
  quantity: number;
  growthStage: string;
  nextInspection: string;
}

const BatchManagementScreen: React.FC<BatchManagementScreenProps> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBatch, setNewBatch] = useState({
    name: '',
    species: '',
    location: '',
    quantity: '',
  });

  const [batches, setBatches] = useState<Batch[]>([]);

  const filters = ['All', 'Active', 'Pending', 'Harvested'];

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = batch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         batch.species.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         batch.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'All' || batch.status === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return Colors.success;
      case 'Pending':
        return Colors.warning;
      case 'Harvested':
        return Colors.textSecondary;
      default:
        return Colors.textSecondary;
    }
  };

  const handleAddBatch = () => {
    if (!newBatch.name || !newBatch.species || !newBatch.location || !newBatch.quantity) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const batch: Batch = {
      id: `${newBatch.species.substring(0, 2).toUpperCase()}-2024-${String(batches.length + 1).padStart(3, '0')}`,
      name: newBatch.name,
      species: newBatch.species,
      location: newBatch.location,
      startDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      quantity: parseInt(newBatch.quantity),
      growthStage: 'Seed',
      nextInspection: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    setBatches([...batches, batch]);
    setNewBatch({ name: '', species: '', location: '', quantity: '' });
    setShowAddModal(false);
    Alert.alert('Success', 'Batch added successfully');
  };

  const handleBatchAction = (batchId: string, action: string) => {
    Alert.alert(
      'Confirm Action',
      `Are you sure you want to ${action.toLowerCase()} this batch?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            if (action === 'Harvest') {
              setBatches(batches.map(batch =>
                batch.id === batchId ? { ...batch, status: 'Harvested' as const } : batch
              ));
            }
            Alert.alert('Success', `Batch ${action.toLowerCase()}ed successfully`);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Batch Management</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search batches..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                selectedFilter === filter && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedFilter === filter && styles.filterButtonTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Batch List */}
      <ScrollView style={styles.batchList}>
        {filteredBatches.map((batch) => (
          <View key={batch.id} style={styles.batchCard}>
            <View style={styles.batchHeader}>
              <View>
                <Text style={styles.batchName}>{batch.name}</Text>
                <Text style={styles.batchId}>ID: {batch.id}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(batch.status) }]}>
                <Text style={styles.statusText}>{batch.status}</Text>
              </View>
            </View>

            <View style={styles.batchDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="fish-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.detailText}>{batch.species}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.detailText}>{batch.location}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.detailText}>Started: {batch.startDate}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="layers-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.detailText}>Quantity: {batch.quantity.toLocaleString()}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="trending-up-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.detailText}>Stage: {batch.growthStage}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.detailText}>Next Inspection: {batch.nextInspection}</Text>
              </View>
            </View>

            <View style={styles.batchActions}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="eye-outline" size={16} color={Colors.primary} />
                <Text style={styles.actionButtonText}>Inspect</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="create-outline" size={16} color={Colors.primary} />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
              {batch.status === 'Active' && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleBatchAction(batch.id, 'Harvest')}
                >
                  <Ionicons name="basket-outline" size={16} color={Colors.success} />
                  <Text style={[styles.actionButtonText, { color: Colors.success }]}>Harvest</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add Batch Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Batch</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Batch Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter batch name"
                  value={newBatch.name}
                  onChangeText={(text) => setNewBatch({ ...newBatch, name: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Species</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter species"
                  value={newBatch.species}
                  onChangeText={(text) => setNewBatch({ ...newBatch, species: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Location</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter location"
                  value={newBatch.location}
                  onChangeText={(text) => setNewBatch({ ...newBatch, location: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter quantity"
                  value={newBatch.quantity}
                  onChangeText={(text) => setNewBatch({ ...newBatch, quantity: text })}
                  keyboardType="numeric"
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={handleAddBatch}
              >
                <Text style={styles.addButtonText}>Add Batch</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  searchContainer: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginLeft: Spacing.sm,
    ...Typography.body1,
  },
  filterContainer: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    marginRight: Spacing.sm,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  filterButtonTextActive: {
    color: Colors.surface,
  },
  batchList: {
    flex: 1,
    padding: Spacing.lg,
  },
  batchCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  batchName: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  batchId: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.caption,
    color: Colors.surface,
    fontWeight: '600',
  },
  batchDetails: {
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  detailText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  batchActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  actionButtonText: {
    ...Typography.body2,
    color: Colors.primary,
    marginLeft: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  modalForm: {
    padding: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.body1,
    color: Colors.text,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body1,
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  cancelButton: {
    backgroundColor: Colors.background,
  },
  addButton: {
    backgroundColor: Colors.primary,
  },
  cancelButtonText: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  addButtonText: {
    ...Typography.body1,
    color: Colors.surface,
    fontWeight: '600',
  },
});

export default BatchManagementScreen;
