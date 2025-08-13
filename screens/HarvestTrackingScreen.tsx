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

interface HarvestTrackingScreenProps {
  navigation: any;
}

interface HarvestRecord {
  id: string;
  batchId: string;
  batchName: string;
  species: string;
  harvestDate: string;
  quantity: number;
  weight: number;
  quality: 'Premium' | 'Standard' | 'Grade B';
  destination: string;
  price: number;
  status: 'Completed' | 'Processing' | 'Shipped';
}

const HarvestTrackingScreen: React.FC<HarvestTrackingScreenProps> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHarvest, setNewHarvest] = useState({
    batchId: '',
    quantity: '',
    weight: '',
    quality: 'Standard',
    destination: '',
    price: '',
  });

  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);

  const filters = ['All', 'Completed', 'Processing', 'Shipped'];
  const qualityOptions = ['Premium', 'Standard', 'Grade B'];

  const filteredHarvests = harvests.filter(harvest => {
    const matchesSearch = harvest.batchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         harvest.species.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         harvest.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         harvest.destination.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'All' || harvest.status === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return Colors.success;
      case 'Processing':
        return Colors.warning;
      case 'Shipped':
        return Colors.info;
      default:
        return Colors.textSecondary;
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'Premium':
        return Colors.success;
      case 'Standard':
        return Colors.info;
      case 'Grade B':
        return Colors.warning;
      default:
        return Colors.textSecondary;
    }
  };

  const handleAddHarvest = () => {
    if (!newHarvest.batchId || !newHarvest.quantity || !newHarvest.weight || !newHarvest.destination || !newHarvest.price) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const harvest: HarvestRecord = {
      id: `H-2024-${String(harvests.length + 1).padStart(3, '0')}`,
      batchId: newHarvest.batchId,
      batchName: `Batch ${newHarvest.batchId}`,
      species: 'Pacific Oyster', // Default for demo
      harvestDate: new Date().toISOString().split('T')[0],
      quantity: parseInt(newHarvest.quantity),
      weight: parseFloat(newHarvest.weight),
      quality: newHarvest.quality as 'Premium' | 'Standard' | 'Grade B',
      destination: newHarvest.destination,
      price: parseFloat(newHarvest.price),
      status: 'Processing',
    };

    setHarvests([...harvests, harvest]);
    setNewHarvest({
      batchId: '',
      quantity: '',
      weight: '',
      quality: 'Standard',
      destination: '',
      price: '',
    });
    setShowAddModal(false);
    Alert.alert('Success', 'Harvest record added successfully');
  };

  const getTotalRevenue = () => {
    return filteredHarvests.reduce((total, harvest) => total + (harvest.quantity * harvest.price), 0);
  };

  const getTotalQuantity = () => {
    return filteredHarvests.reduce((total, harvest) => total + harvest.quantity, 0);
  };

  const getTotalWeight = () => {
    return filteredHarvests.reduce((total, harvest) => total + harvest.weight, 0);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Harvest Tracking</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{getTotalQuantity().toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Total Units</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{getTotalWeight().toFixed(1)} kg</Text>
          <Text style={styles.summaryLabel}>Total Weight</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>${getTotalRevenue().toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Total Revenue</Text>
        </View>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search harvests..."
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

      {/* Harvest List */}
      <ScrollView style={styles.harvestList}>
        {filteredHarvests.map((harvest) => (
          <View key={harvest.id} style={styles.harvestCard}>
            <View style={styles.harvestHeader}>
              <View>
                <Text style={styles.harvestId}>#{harvest.id}</Text>
                <Text style={styles.batchName}>{harvest.batchName}</Text>
                <Text style={styles.species}>{harvest.species}</Text>
              </View>
              <View style={styles.statusContainer}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(harvest.status) }]}>
                  <Text style={styles.statusText}>{harvest.status}</Text>
                </View>
                <View style={[styles.qualityBadge, { backgroundColor: getQualityColor(harvest.quality) }]}>
                  <Text style={styles.qualityText}>{harvest.quality}</Text>
                </View>
              </View>
            </View>

            <View style={styles.harvestDetails}>
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.detailText}>Date: {harvest.harvestDate}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="layers-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.detailText}>Qty: {harvest.quantity.toLocaleString()}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="scale-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.detailText}>Weight: {harvest.weight} kg</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="cash-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.detailText}>Price: ${harvest.price}/unit</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.detailText}>Destination: {harvest.destination}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="calculator-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.detailText}>Revenue: ${(harvest.quantity * harvest.price).toLocaleString()}</Text>
                </View>
              </View>
            </View>

            <View style={styles.harvestActions}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="eye-outline" size={16} color={Colors.primary} />
                <Text style={styles.actionButtonText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="create-outline" size={16} color={Colors.primary} />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
                <Text style={styles.actionButtonText}>Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add Harvest Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record New Harvest</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Batch ID</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter batch ID"
                  value={newHarvest.batchId}
                  onChangeText={(text) => setNewHarvest({ ...newHarvest, batchId: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter quantity"
                  value={newHarvest.quantity}
                  onChangeText={(text) => setNewHarvest({ ...newHarvest, quantity: text })}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Weight (kg)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter weight"
                  value={newHarvest.weight}
                  onChangeText={(text) => setNewHarvest({ ...newHarvest, weight: text })}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quality Grade</Text>
                <View style={styles.qualitySelector}>
                  {qualityOptions.map((quality) => (
                    <TouchableOpacity
                      key={quality}
                      style={[
                        styles.qualityOption,
                        newHarvest.quality === quality && styles.qualityOptionActive,
                      ]}
                      onPress={() => setNewHarvest({ ...newHarvest, quality })}
                    >
                      <Text
                        style={[
                          styles.qualityOptionText,
                          newHarvest.quality === quality && styles.qualityOptionTextActive,
                        ]}
                      >
                        {quality}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Destination</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter destination"
                  value={newHarvest.destination}
                  onChangeText={(text) => setNewHarvest({ ...newHarvest, destination: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price per Unit ($)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter price"
                  value={newHarvest.price}
                  onChangeText={(text) => setNewHarvest({ ...newHarvest, price: text })}
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
                onPress={handleAddHarvest}
              >
                <Text style={styles.addButtonText}>Record Harvest</Text>
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
  summaryContainer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginHorizontal: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  summaryValue: {
    ...Typography.h3,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  summaryLabel: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
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
  harvestList: {
    flex: 1,
    padding: Spacing.lg,
  },
  harvestCard: {
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
  harvestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  harvestId: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  batchName: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  species: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  statusText: {
    ...Typography.caption,
    color: Colors.surface,
    fontWeight: '600',
  },
  qualityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  qualityText: {
    ...Typography.caption,
    color: Colors.surface,
    fontWeight: '600',
  },
  harvestDetails: {
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
    flex: 1,
  },
  harvestActions: {
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
  qualitySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qualityOption: {
    flex: 1,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginHorizontal: Spacing.xs,
  },
  qualityOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  qualityOptionText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  qualityOptionTextActive: {
    color: Colors.surface,
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

export default HarvestTrackingScreen;
