import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useAdmin } from '../contexts/AdminContext';
import { getFarmStorageKey, STORAGE_KEYS } from '../utils/storage';
import { supabase } from '../utils/supabase';

interface InventoryItem {
  id: string;
  name: string;
  category: 'equipment' | 'feed' | 'chemicals' | 'supplies';
  quantity: number;
  unit: string;
  minStock: number;
  cost: number;
  supplier: string;
  lastUpdated: string;
  farm_id: string; // Added for Supabase
}

const InventoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { currentUser } = useAdmin();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: '',
    category: 'equipment',
    quantity: 0,
    unit: '',
    minStock: 0,
    cost: 0,
    supplier: '',
  });

  const categories = [
    { key: 'all', label: 'All Items', icon: 'grid-outline' },
    { key: 'equipment', label: 'Equipment', icon: 'construct-outline' },
    { key: 'feed', label: 'Feed', icon: 'nutrition-outline' },
    { key: 'chemicals', label: 'Chemicals', icon: 'flask-outline' },
    { key: 'supplies', label: 'Supplies', icon: 'cube-outline' },
  ];

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    filterInventory();
  }, [inventory, selectedCategory, searchQuery]);

  const loadInventory = async () => {
    try {
      if (!currentUser?.id) return;
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('farm_id', currentUser.id);
      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error loading inventory:', error);
    }
  };

  const saveInventory = async (inventoryData: InventoryItem[]) => {
    try {
      if (!currentUser?.id) return;
      // For simplicity, delete all and re-insert (for batch updates)
      await supabase.from('inventory').delete().eq('farm_id', currentUser.id);
      if (inventoryData.length > 0) {
        await supabase.from('inventory').insert(
          inventoryData.map(item => ({ ...item, farm_id: currentUser.id }))
        );
      }
    } catch (error) {
      console.error('Error saving inventory:', error);
    }
  };

  const filterInventory = () => {
    let filtered = inventory;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supplier.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredInventory(filtered);
  };

  const addItem = async () => {
    if (!newItem.name || !newItem.unit) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (!currentUser) {
      Alert.alert('Error', 'No current user');
      return;
    }
    const item: InventoryItem = {
      id: Date.now().toString(),
      name: newItem.name!,
      category: newItem.category!,
      quantity: newItem.quantity || 0,
      unit: newItem.unit!,
      minStock: newItem.minStock || 0,
      cost: newItem.cost || 0,
      supplier: newItem.supplier || '',
      lastUpdated: new Date().toISOString(),
      farm_id: currentUser.id,
    };

    try {
      await supabase.from('inventory').insert([item]);
      setInventory([...inventory, item]);
      setShowAddModal(false);
      resetNewItem();
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const updateItem = async (updatedItem: InventoryItem) => {
    if (!currentUser) {
      Alert.alert('Error', 'No current user');
      return;
    }
    try {
      await supabase
        .from('inventory')
        .update({ ...updatedItem, lastUpdated: new Date().toISOString() })
        .eq('id', updatedItem.id)
        .eq('farm_id', currentUser.id);
      setInventory(
        inventory.map(item =>
          item.id === updatedItem.id ? { ...updatedItem, lastUpdated: new Date().toISOString() } : item
        )
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!currentUser) {
      Alert.alert('Error', 'No current user');
      return;
    }
    try {
      await supabase.from('inventory').delete().eq('id', itemId).eq('farm_id', currentUser.id);
      setInventory(inventory.filter(item => item.id !== itemId));
    } catch (error) {
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const resetNewItem = () => {
    setNewItem({
      name: '',
      category: 'equipment',
      quantity: 0,
      unit: '',
      minStock: 0,
      cost: 0,
      supplier: '',
    });
  };

  const getLowStockItems = () => {
    return inventory.filter(item => item.quantity <= item.minStock);
  };

  const getTotalValue = () => {
    return inventory.reduce((total, item) => total + (item.quantity * item.cost), 0);
  };

  const renderInventoryItem = (item: InventoryItem) => (
    <View key={item.id} style={styles.inventoryCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setEditingItem(item);
              setNewItem(item);
              setShowAddModal(true);
            }}
          >
            <Ionicons name="create-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => deleteItem(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.itemDetails}>
        <View style={styles.itemDetail}>
          <Text style={styles.detailLabel}>Quantity</Text>
          <Text style={[
            styles.detailValue,
            item.quantity <= item.minStock && styles.lowStock
          ]}>
            {item.quantity} {item.unit}
          </Text>
        </View>
        <View style={styles.itemDetail}>
          <Text style={styles.detailLabel}>Min Stock</Text>
          <Text style={styles.detailValue}>{item.minStock} {item.unit}</Text>
        </View>
        <View style={styles.itemDetail}>
          <Text style={styles.detailLabel}>Unit Cost</Text>
          <Text style={styles.detailValue}>${item.cost.toFixed(2)}</Text>
        </View>
        <View style={styles.itemDetail}>
          <Text style={styles.detailLabel}>Total Value</Text>
          <Text style={styles.detailValue}>${(item.quantity * item.cost).toFixed(2)}</Text>
        </View>
      </View>
      
      {item.supplier && (
        <Text style={styles.supplier}>Supplier: {item.supplier}</Text>
      )}
      
      {item.quantity <= item.minStock && (
        <View style={styles.lowStockAlert}>
          <Ionicons name="warning" size={16} color={Colors.warning} />
          <Text style={styles.lowStockText}>Low Stock Alert</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryCards}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{inventory.length}</Text>
          <Text style={styles.summaryLabel}>Total Items</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{getLowStockItems().length}</Text>
          <Text style={styles.summaryLabel}>Low Stock</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>${getTotalValue().toFixed(0)}</Text>
          <Text style={styles.summaryLabel}>Total Value</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.key}
            style={[
              styles.categoryButton,
              selectedCategory === category.key && styles.categoryButtonActive,
            ]}
            onPress={() => setSelectedCategory(category.key)}
          >
            <Ionicons
              name={category.icon as any}
              size={20}
              color={selectedCategory === category.key ? Colors.surface : Colors.textSecondary}
            />
            <Text
              style={[
                styles.categoryButtonText,
                selectedCategory === category.key && styles.categoryButtonTextActive,
              ]}
            >
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Inventory List */}
      <ScrollView style={styles.inventoryList} showsVerticalScrollIndicator={false}>
        {filteredInventory.map(renderInventoryItem)}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowAddModal(false);
              setEditingItem(null);
              resetNewItem();
            }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingItem ? 'Edit Item' : 'Add Item'}
            </Text>
            <TouchableOpacity onPress={editingItem ? () => {
              updateItem(newItem as InventoryItem);
              setShowAddModal(false);
              setEditingItem(null);
              resetNewItem();
            } : addItem}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Item Name *</Text>
              <TextInput
                style={styles.input}
                value={newItem.name}
                onChangeText={(text) => setNewItem({ ...newItem, name: text })}
                placeholder="Enter item name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category *</Text>
              <View style={styles.categorySelector}>
                {categories.slice(1).map((category) => (
                  <TouchableOpacity
                    key={category.key}
                    style={[
                      styles.categoryOption,
                      newItem.category === category.key && styles.categoryOptionActive,
                    ]}
                    onPress={() => setNewItem({ ...newItem, category: category.key as any })}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        newItem.category === category.key && styles.categoryOptionTextActive,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Quantity *</Text>
                <TextInput
                  style={styles.input}
                  value={newItem.quantity?.toString()}
                  onChangeText={(text) => setNewItem({ ...newItem, quantity: parseInt(text) || 0 })}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Unit *</Text>
                <TextInput
                  style={styles.input}
                  value={newItem.unit}
                  onChangeText={(text) => setNewItem({ ...newItem, unit: text })}
                  placeholder="kg, pieces, liters"
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Min Stock</Text>
                <TextInput
                  style={styles.input}
                  value={newItem.minStock?.toString()}
                  onChangeText={(text) => setNewItem({ ...newItem, minStock: parseInt(text) || 0 })}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Unit Cost</Text>
                <TextInput
                  style={styles.input}
                  value={newItem.cost?.toString()}
                  onChangeText={(text) => setNewItem({ ...newItem, cost: parseFloat(text) || 0 })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Supplier</Text>
              <TextInput
                style={styles.input}
                value={newItem.supplier}
                onChangeText={(text) => setNewItem({ ...newItem, supplier: text })}
                placeholder="Supplier name"
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
  summaryCards: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryValue: {
    ...Typography.h2,
    color: Colors.primary,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchInput: {
    ...Typography.body1,
    flex: 1,
    marginLeft: Spacing.md,
    color: Colors.text,
  },
  categoryFilter: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginRight: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary,
  },
  categoryButtonText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  categoryButtonTextActive: {
    color: Colors.surface,
  },
  inventoryList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  inventoryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
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
    marginBottom: Spacing.md,
  },
  itemName: {
    ...Typography.h3,
    color: Colors.text,
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    padding: Spacing.sm,
  },
  itemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  itemDetail: {
    width: '48%',
    marginBottom: Spacing.sm,
  },
  detailLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  detailValue: {
    ...Typography.body1,
    color: Colors.text,
    fontWeight: 'bold',
    marginTop: Spacing.xs,
  },
  lowStock: {
    color: Colors.error,
  },
  supplier: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  lowStockAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  lowStockText: {
    ...Typography.caption,
    color: Colors.warning,
    marginLeft: Spacing.sm,
    fontWeight: 'bold',
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
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.body1,
    color: Colors.text,
    marginBottom: Spacing.sm,
    fontWeight: '500',
  },
  input: {
    ...Typography.body1,
    color: Colors.text,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  categoryOptionActive: {
    backgroundColor: Colors.primary,
  },
  categoryOptionText: {
    ...Typography.body2,
    color: Colors.primary,
  },
  categoryOptionTextActive: {
    color: Colors.surface,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  inputHalf: {
    flex: 1,
  },
});

export default InventoryScreen;
