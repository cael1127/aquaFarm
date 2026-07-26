import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  Alert,
  Modal,
  TextInput,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useAdmin } from '../contexts/AdminContext';
import { getFarmStorageKey, STORAGE_KEYS } from '../utils/storage';
import ChatbotFAB from '../components/ChatbotFAB';
import { supabase } from '../utils/supabase';

interface Bag {
  id: string;
  amount: number;
  size: string; // size of individual animals (e.g., "2.5 inches", "150g", "Large", "M")
  cohort: string; // batch/cohort identifier
  status: 'active' | 'harvested' | 'empty';
}

interface CageSpot {
  id: string;
  name: string;
  type: 'oyster';
  status: 'active' | 'maintenance' | 'empty';
  batches: number;
  capacity: number;
  waterDepth: number;
  coordinates: { x: number; y: number };
  size: number;
  bags: Bag[];
}

interface FarmMapData {
  backgroundImage: string | null;
  cageSpots: CageSpot[];
  mapDimensions: { width: number; height: number };
}

interface InteractiveFarmMapScreenProps {
  navigation: any;
}

const InteractiveFarmMapScreen: React.FC<InteractiveFarmMapScreenProps> = ({ navigation }) => {
  const { currentUser } = useAdmin();
  const [selectedCage, setSelectedCage] = useState<string | null>(null);
  const [selectedCages, setSelectedCages] = useState<string[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBagModal, setShowBagModal] = useState(false);
  const [showMassEditModal, setShowMassEditModal] = useState(false);
  
  // Zoom and Pan state
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const scaleValue = useRef(new Animated.Value(1)).current;
  const translateXValue = useRef(new Animated.Value(0)).current;
  const translateYValue = useRef(new Animated.Value(0)).current;
  const [farmMapData, setFarmMapData] = useState<FarmMapData>({
    backgroundImage: null,
    cageSpots: [],
    mapDimensions: { width: 350, height: 400 },
  });
  const [newCage, setNewCage] = useState({
    name: '',
    type: 'oyster' as 'oyster',
    size: 40,
  });
  const [tempCoordinates, setTempCoordinates] = useState({ x: 0, y: 0 });
  const [selectedBagCage, setSelectedBagCage] = useState<string | null>(null);
  const [editingBag, setEditingBag] = useState<Bag | null>(null);
  
  // Pan Responder for zoom and pan
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        translateXValue.setOffset(translateX);
        translateYValue.setOffset(translateY);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length === 2) {
          // Handle pinch zoom
          const touch1 = evt.nativeEvent.touches[0];
          const touch2 = evt.nativeEvent.touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) + Math.pow(touch2.pageY - touch1.pageY, 2)
          );
          const newScale = Math.max(0.5, Math.min(3, distance / 200));
          setScale(newScale);
          scaleValue.setValue(newScale);
        } else {
          // Handle pan
          translateXValue.setValue(gestureState.dx);
          translateYValue.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        translateXValue.flattenOffset();
        translateYValue.flattenOffset();
        setTranslateX(translateX + gestureState.dx);
        setTranslateY(translateY + gestureState.dy);
      },
    })
  ).current;

  // Load saved farm data on component mount
  useEffect(() => {
    loadFarmData();
    requestPermissions();
  }, []);

  // Migration function to add bags to existing cages and handle size conversions
  const migrateCageData = (cageSpots: CageSpot[]): CageSpot[] => {
    return cageSpots.map(cage => {
      if (!cage.bags) {
        // Create new bags with empty string sizes
        return {
          ...cage,
          bags: [
            { id: `${cage.id}-B1`, amount: 0, size: '', cohort: '', status: 'empty' },
            { id: `${cage.id}-B2`, amount: 0, size: '', cohort: '', status: 'empty' },
            { id: `${cage.id}-B3`, amount: 0, size: '', cohort: '', status: 'empty' },
            { id: `${cage.id}-B4`, amount: 0, size: '', cohort: '', status: 'empty' },
            { id: `${cage.id}-B5`, amount: 0, size: '', cohort: '', status: 'empty' },
            { id: `${cage.id}-B6`, amount: 0, size: '', cohort: '', status: 'empty' },
          ] as Bag[]
        };
      }
      
      // Migrate existing bags with numeric sizes to string sizes
      const migratedBags = cage.bags.map(bag => {
        if (typeof bag.size === 'number') {
          // Convert numeric sizes to string values
          let stringSize = '';
          if (bag.size === 1.5) stringSize = 'Small';
          else if (bag.size === 2.5) stringSize = 'Medium';
          else if (bag.size === 3.5) stringSize = 'Large';
          else if (bag.size > 0) stringSize = `${bag.size}"`;
          else stringSize = '';
          return { ...bag, size: stringSize };
        }
        return bag;
      });
      
      return { ...cage, bags: migratedBags };
    });
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll permissions to upload your farm image.');
    }
  };

  // Replace AsyncStorage logic with Supabase CRUD for farm map data

  const loadFarmData = async () => {
    try {
      if (!currentUser?.id) return;
      const { data, error } = await supabase
        .from('farm_map')
        .select('*')
        .eq('farm_id', currentUser.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // ignore no rows error
      if (data) {
        // Migrate existing data to include bags if needed
        const migratedData = {
          ...data,
          cageSpots: migrateCageData(data.cageSpots || [])
        };
        setFarmMapData(migratedData);
        saveFarmData(migratedData);
      } else {
        // Use default data if no saved data exists
        const defaultData = {
          backgroundImage: null,
          cageSpots: defaultCageSpots,
          mapDimensions: { width: 350, height: 400 },
        };
        setFarmMapData(defaultData);
        saveFarmData(defaultData);
      }
    } catch (error) {
      console.error('Error loading farm data:', error);
    }
  };

  const saveFarmData = async (data: FarmMapData) => {
    try {
      if (!currentUser?.id) return;
      // Upsert (insert or update)
      await supabase.from('farm_map').upsert([{ ...data, farm_id: currentUser.id }], { onConflict: 'farm_id' });
      setFarmMapData(data);
    } catch (error) {
      console.error('Error saving farm data:', error);
    }
  };

  // Start with empty farm - users can add their own cages
  const defaultCageSpots: CageSpot[] = [];

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        if (!currentUser?.id) {
          Alert.alert('Error', 'No current user');
          return;
        }
        const imageUri = result.assets[0].uri;
        // Upload to Supabase Storage
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const filePath = `farm_${currentUser.id}.jpg`;
        // Remove existing file if it exists (optional, for upsert)
        await supabase.storage.from('farm-images').remove([filePath]);
        const { error: uploadError } = await supabase.storage
          .from('farm-images')
          .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' });
        if (uploadError) {
          Alert.alert('Error', 'Failed to upload image to storage');
          return;
        }
        // Get the public URL
        const { data: publicUrlData } = supabase.storage
          .from('farm-images')
          .getPublicUrl(filePath);
        const publicUrl = publicUrlData.publicUrl;
        const newData = {
          ...farmMapData,
          backgroundImage: publicUrl,
        };
        saveFarmData(newData);
        Alert.alert('Success', 'Farm image uploaded successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const handleMapPress = (event: any) => {
    if (!editMode) return;

    const { locationX, locationY } = event.nativeEvent;
    setTempCoordinates({ x: locationX, y: locationY });
    setShowAddModal(true);
  };

  const addCageSpot = () => {
    if (!newCage.name) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const newSpot: CageSpot = {
      id: `C${Date.now()}`,
      name: newCage.name,
      type: newCage.type,
      status: 'empty',
      batches: 0,
      capacity: 0, // Default capacity
      waterDepth: 12, // Default depth
      coordinates: tempCoordinates,
      size: newCage.size,
      bags: [
        { id: `C${Date.now()}-B1`, amount: 0, size: '', cohort: '', status: 'empty' },
        { id: `C${Date.now()}-B2`, amount: 0, size: '', cohort: '', status: 'empty' },
        { id: `C${Date.now()}-B3`, amount: 0, size: '', cohort: '', status: 'empty' },
        { id: `C${Date.now()}-B4`, amount: 0, size: '', cohort: '', status: 'empty' },
        { id: `C${Date.now()}-B5`, amount: 0, size: '', cohort: '', status: 'empty' },
        { id: `C${Date.now()}-B6`, amount: 0, size: '', cohort: '', status: 'empty' },
      ],
    };

    const newData = {
      ...farmMapData,
      cageSpots: [...farmMapData.cageSpots, newSpot],
    };

    saveFarmData(newData);
    setShowAddModal(false);
    setNewCage({ name: '', type: 'oyster', size: 40 });
  };

  const deleteCageSpot = (id: string) => {
    Alert.alert(
      'Delete Cage',
      'Are you sure you want to delete this cage?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newData = {
              ...farmMapData,
              cageSpots: farmMapData.cageSpots.filter(spot => spot.id !== id),
            };
            saveFarmData(newData);
          },
        },
      ]
    );
  };

  const openBagModal = (cageId: string) => {
    setSelectedBagCage(cageId);
    setShowBagModal(true);
  };

  const updateBag = (cageId: string, bagId: string, updatedBag: Bag) => {
    const newData = {
      ...farmMapData,
      cageSpots: farmMapData.cageSpots.map(cage => 
        cage.id === cageId 
          ? {
              ...cage,
              bags: cage.bags.map(bag => 
                bag.id === bagId ? updatedBag : bag
              )
            }
          : cage
      )
    };
    saveFarmData(newData);
  };

  // Multi-select functions
  const toggleCageSelection = (cageId: string) => {
    if (multiSelectMode) {
      setSelectedCages(prev => 
        prev.includes(cageId) 
          ? prev.filter(id => id !== cageId)
          : [...prev, cageId]
      );
    } else {
      setSelectedCage(cageId);
    }
  };

  const toggleMultiSelectMode = () => {
    setMultiSelectMode(!multiSelectMode);
    setSelectedCages([]);
    setSelectedCage(null);
  };

  const selectAllCages = () => {
    setSelectedCages(farmMapData.cageSpots.map(cage => cage.id));
  };

  const clearSelection = () => {
    setSelectedCages([]);
    setSelectedCage(null);
  };

  // Mass edit functions
  const applyMassEdit = (updates: Partial<Bag>) => {
    const newData = {
      ...farmMapData,
      cageSpots: farmMapData.cageSpots.map(cage => {
        if (selectedCages.includes(cage.id)) {
          return {
            ...cage,
            bags: cage.bags.map(bag => ({ ...bag, ...updates }))
          };
        }
        return cage;
      })
    };
    saveFarmData(newData);
    setShowMassEditModal(false);
    setMultiSelectMode(false);
    setSelectedCages([]);
  };

  const resetZoom = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    scaleValue.setValue(1);
    translateXValue.setValue(0);
    translateYValue.setValue(0);
  };

  const getCageColor = (type: string, status: string) => {
    if (status === 'maintenance') return '#FF9800';
    if (status === 'empty') return '#9E9E9E';
    
    switch (type) {
      case 'oyster': return '#4CAF50';
      case 'mussel': return '#2196F3';
      case 'salmon': return '#FF5722';
      default: return '#9E9E9E';
    }
  };

  const renderCageSpot = (spot: CageSpot) => {
    const isSelected = selectedCage === spot.id;
    const isMultiSelected = selectedCages.includes(spot.id);
    const showSelection = multiSelectMode ? isMultiSelected : isSelected;
    
    return (
      <TouchableOpacity
        key={spot.id}
        style={[
          styles.cageSpot,
          {
            left: spot.coordinates.x - spot.size / 2,
            top: spot.coordinates.y - spot.size / 2,
            width: spot.size,
            height: spot.size,
            backgroundColor: getCageColor(spot.type, spot.status),
            borderWidth: showSelection ? 3 : 1,
            borderColor: showSelection ? (multiSelectMode ? Colors.accent : Colors.primary) : '#FFF',
            opacity: multiSelectMode && !isMultiSelected ? 0.6 : 1,
          },
        ]}
        onPress={() => toggleCageSelection(spot.id)}
        onLongPress={() => editMode && deleteCageSpot(spot.id)}
      >
        {multiSelectMode && isMultiSelected && (
          <View style={styles.selectionIndicator}>
            <Ionicons name="checkmark" size={16} color={Colors.white} />
          </View>
        )}
        <Text style={styles.cageLabel}>{spot.name}</Text>
        <Text style={styles.bagCount}>
          {(spot.bags || []).filter(bag => bag.status === 'active').length}/6
        </Text>
        <TouchableOpacity 
          style={styles.bagButton}
          onPress={(e) => {
            e.stopPropagation();
            openBagModal(spot.id);
          }}
        >
          <Ionicons name="list" size={12} color="white" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const selectedSpot = farmMapData.cageSpots.find(spot => spot.id === selectedCage);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Interactive Farm Map</Text>
          <TouchableOpacity
            onPress={() => setEditMode(!editMode)}
            style={[styles.editButton, editMode && styles.editButtonActive]}
          >
            <Ionicons 
              name={editMode ? "checkmark" : "create"} 
              size={20} 
              color={editMode ? Colors.surface : Colors.primary} 
            />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={pickImage} disabled={!currentUser}>
            <Ionicons name="image" size={20} color={Colors.primary} />
            <Text style={styles.actionButtonText}>Upload Farm Image</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, multiSelectMode && styles.actionButtonActive]} 
            onPress={toggleMultiSelectMode}
          >
            <Ionicons name="checkmark-circle" size={20} color={multiSelectMode ? Colors.white : Colors.primary} />
            <Text style={[styles.actionButtonText, multiSelectMode && styles.actionButtonTextActive]}>
              {multiSelectMode ? 'Exit Multi-Select' : 'Multi-Select'}
            </Text>
          </TouchableOpacity>
          
          {editMode && (
            <Text style={styles.editModeText}>
              Tap on map to add cage spots • Long press to delete
            </Text>
          )}
        </View>

        {/* Multi-Select Toolbar */}
        {multiSelectMode && (
          <View style={styles.multiSelectToolbar}>
            <View style={styles.selectionInfo}>
              <Text style={styles.selectionText}>
                {selectedCages.length} cage{selectedCages.length !== 1 ? 's' : ''} selected
              </Text>
            </View>
            <View style={styles.multiSelectActions}>
              <TouchableOpacity style={styles.toolbarButton} onPress={selectAllCages}>
                <Ionicons name="checkmark-done" size={16} color={Colors.primary} />
                <Text style={styles.toolbarButtonText}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolbarButton} onPress={clearSelection}>
                <Ionicons name="close" size={16} color={Colors.textSecondary} />
                <Text style={styles.toolbarButtonText}>Clear</Text>
              </TouchableOpacity>
              {selectedCages.length > 0 && (
                <TouchableOpacity 
                  style={[styles.toolbarButton, styles.massEditButton]} 
                  onPress={() => setShowMassEditModal(true)}
                >
                  <Ionicons name="create" size={16} color={Colors.white} />
                  <Text style={[styles.toolbarButtonText, styles.massEditButtonText]}>Mass Edit</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Map Container with Zoom Controls */}
        <View style={styles.mapContainer}>
          <View style={styles.zoomControls}>
            <TouchableOpacity style={styles.zoomButton} onPress={() => {
              const newScale = Math.min(3, scale * 1.2);
              setScale(newScale);
              scaleValue.setValue(newScale);
            }}>
              <Ionicons name="add" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomButton} onPress={() => {
              const newScale = Math.max(0.5, scale * 0.8);
              setScale(newScale);
              scaleValue.setValue(newScale);
            }}>
              <Ionicons name="remove" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetButton} onPress={resetZoom}>
              <Ionicons name="refresh" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.mapArea} {...panResponder.panHandlers}>
            <Animated.View
              style={[
                styles.animatedMapContent,
                {
                  transform: [
                    { scale: scaleValue },
                    { translateX: translateXValue },
                    { translateY: translateYValue },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.mapBackground}
                onPress={handleMapPress}
                activeOpacity={1}
              >
                {farmMapData.backgroundImage ? (
                  <Image
                    source={{ uri: farmMapData.backgroundImage }}
                    style={styles.backgroundImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.placeholderBackground}>
                    {/* Placeholder farm layout */}
                    <View style={styles.waterArea}>
                      <View style={styles.dockArea} />
                      <View style={styles.shallowWater} />
                      <View style={styles.deepWater} />
                    </View>
                    <Text style={styles.placeholderText}>
                      Sample Farm Layout
                    </Text>
                    <Text style={styles.placeholderSubtext}>
                      Tap "Upload Farm Image" to use your own farm photo
                    </Text>
                  </View>
                )}
                
                {/* Render cage spots */}
                {farmMapData.cageSpots.map(renderCageSpot)}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Selected Cage Info */}
        {selectedSpot && (
          <View style={styles.selectedCageInfo}>
            <View style={styles.selectedCageHeader}>
              <Text style={styles.selectedCageTitle}>{selectedSpot.name}</Text>
              {editMode && (
                <View style={styles.cageActions}>
                  <TouchableOpacity 
                    style={styles.editCageButton}
                    onPress={() => {
                      setNewCage({
                        name: selectedSpot.name,
                        type: selectedSpot.type,
                        size: selectedSpot.size
                      });
                      setShowEditModal(true);
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color={Colors.primary} />
                    <Text style={styles.editCageButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.deleteCageButton}
                    onPress={() => deleteCageSpot(selectedSpot.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                    <Text style={styles.deleteCageButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View style={styles.selectedCageDetails}>
              <Text style={styles.selectedCageDetail}>
                ID: {selectedSpot.id}
              </Text>
              <Text style={styles.selectedCageDetail}>
                Type: {selectedSpot.type.charAt(0).toUpperCase() + selectedSpot.type.slice(1)}
              </Text>
              <Text style={styles.selectedCageDetail}>
                Status: {selectedSpot.status.charAt(0).toUpperCase() + selectedSpot.status.slice(1)}
              </Text>

              <Text style={styles.selectedCageDetail}>
                Active Bags: {(selectedSpot.bags || []).filter(bag => bag.status === 'active').length}/6
              </Text>
            </View>
          </View>
        )}



        {/* Add Cage Modal */}
        <Modal visible={showAddModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add New Oyster Cage</Text>
              <Text style={styles.modalDescription}>Create a new oyster cage on your farm map. Enter a descriptive name for your new oyster growing area.</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cage Name *</Text>
                <Text style={styles.inputDescription}>Give your oyster cage a descriptive name (e.g., "Line A - Section 1", "North Oyster Bed", "Deep Water Cage")</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter oyster cage name..."
                  value={newCage.name}
                  onChangeText={(text) => setNewCage({ ...newCage, name: text })}
                />
              </View>
              
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.addButton]}
                  onPress={addCageSpot}
                >
                  <Text style={styles.addButtonText}>Add Oyster Cage</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Bag Management Modal */}
        <Modal
          visible={showBagModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Manage Bags - {selectedBagCage && farmMapData.cageSpots.find(c => c.id === selectedBagCage)?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowBagModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.bagList}>
              <View style={styles.bagGrid}>
                {selectedBagCage && farmMapData.cageSpots.find(c => c.id === selectedBagCage)?.bags?.map((bag, index) => {
                  const row = Math.floor(index / 3);
                  const col = index % 3;
                  return (
                    <TouchableOpacity 
                      key={bag.id} 
                      style={[
                        styles.bagGridItem,
                        {
                          backgroundColor: bag.status === 'active' ? Colors.success + '20' : 
                                         bag.status === 'harvested' ? Colors.warning + '20' : 
                                         Colors.background
                        }
                      ]}
                      onPress={() => setEditingBag(editingBag?.id === bag.id ? null : bag)}
                    >
                      <View style={styles.bagGridHeader}>
                        <Text style={styles.bagGridTitle}>Bag {index + 1}</Text>
                        <View style={[
                          styles.bagGridStatus,
                          { 
                            backgroundColor: bag.status === 'active' ? Colors.success : 
                                           bag.status === 'harvested' ? Colors.warning : 
                                           Colors.textSecondary 
                          }
                        ]}>
                          <Text style={styles.bagGridStatusText}>
                            {bag.status.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.bagGridInfo}>
                        <Text style={styles.bagGridAmount}>{bag.amount}</Text>
                        <Text style={styles.bagGridSize}>
                          {bag.size && bag.size.trim() !== '' ? bag.size : 'No size'}
                        </Text>
                        {bag.cohort && (
                          <Text style={styles.bagGridCohort}>{bag.cohort}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              {/* Editing Panel */}
              {editingBag && (
                <View style={styles.bagEditPanel}>
                  <View style={styles.bagEditHeader}>
                    <Text style={styles.bagEditTitle}>
                      Editing Bag {farmMapData.cageSpots.find(c => c.id === selectedBagCage)?.bags?.findIndex(b => b.id === editingBag.id)! + 1}
                    </Text>
                    <TouchableOpacity onPress={() => setEditingBag(null)}>
                      <Ionicons name="close" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.bagEditContent}>
                    <View style={styles.bagEditGroup}>
                      <Text style={styles.bagEditLabel}>Quantity/Amount</Text>
                      <Text style={styles.bagEditDescription}>Number of units in this bag (e.g., 150 oysters, 50 salmon)</Text>
                      <TextInput
                        style={styles.bagEditInput}
                        value={editingBag.amount.toString()}
                        onChangeText={(text) => {
                          const amount = parseInt(text) || 0;
                          const updatedBag = { ...editingBag, amount };
                          setEditingBag(updatedBag);
                          updateBag(selectedBagCage!, editingBag.id, updatedBag);
                        }}
                        keyboardType="numeric"
                        placeholder="Enter quantity..."
                      />
                    </View>
                    
                    <View style={styles.bagEditGroup}>
                      <Text style={styles.bagEditLabel}>Animal Size</Text>
                      <Text style={styles.bagEditDescription}>Average size of individual animals (e.g., 2.5 inches for oysters, 150 grams for salmon)</Text>
                      <TextInput
                        style={styles.bagEditInput}
                        value={editingBag.size}
                        onChangeText={(size) => {
                          const updatedBag = { ...editingBag, size };
                          setEditingBag(updatedBag);
                          updateBag(selectedBagCage!, editingBag.id, updatedBag);
                        }}
                        placeholder="Enter size (e.g., 2.5 inches, 150g, Large, M)..."
                      />
                    </View>
                    
                    <View style={styles.bagEditGroup}>
                      <Text style={styles.bagEditLabel}>Batch/Cohort ID</Text>
                      <Text style={styles.bagEditDescription}>Unique identifier for this batch (e.g., "OB-2024-001", "Spring-Batch-A")</Text>
                      <TextInput
                        style={styles.bagEditInput}
                        value={editingBag.cohort}
                        onChangeText={(text) => {
                          const updatedBag = { ...editingBag, cohort: text };
                          setEditingBag(updatedBag);
                          updateBag(selectedBagCage!, editingBag.id, updatedBag);
                        }}
                        placeholder="Enter batch ID (optional)..."
                      />
                    </View>
                    
                    <View style={styles.bagEditGroup}>
                      <Text style={styles.bagEditLabel}>Current Status</Text>
                      <Text style={styles.bagEditDescription}>Track the current state of this bag</Text>
                      <View style={styles.bagEditButtons}>
                        {['empty', 'active', 'harvested'].map((status) => (
                          <TouchableOpacity
                            key={status}
                            style={[
                              styles.bagEditButton,
                              editingBag.status === status && styles.bagEditButtonActive,
                            ]}
                            onPress={() => {
                              const updatedBag = { ...editingBag, status: status as any };
                              setEditingBag(updatedBag);
                              updateBag(selectedBagCage!, editingBag.id, updatedBag);
                            }}
                          >
                            <Text style={[
                              styles.bagEditButtonText,
                              editingBag.status === status && styles.bagEditButtonTextActive,
                            ]}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Mass Edit Modal */}
        <Modal
          visible={showMassEditModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setShowMassEditModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Mass Edit Cages</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.container}>
              <View style={styles.modalContent}>
                <Text style={styles.modalDescription}>
                  Apply changes to all bags in {selectedCages.length} selected cage{selectedCages.length !== 1 ? 's' : ''}:
                </Text>
                
                <View style={styles.selectedCagesList}>
                  {selectedCages.map(cageId => {
                    const cage = farmMapData.cageSpots.find(c => c.id === cageId);
                    return cage ? (
                      <Text key={cageId} style={styles.selectedCageItem}>
                        • {cage.name} ({cage.type})
                      </Text>
                    ) : null;
                  })}
                </View>

                <View style={styles.massEditOptions}>
                  <TouchableOpacity 
                    style={styles.massEditOption}
                    onPress={() => {
                      Alert.alert(
                        'Set Animal Size',
                        'Enter the size for all animals in selected cages:',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Set Size',
                            onPress: () => {
                              // For demo, we'll set a default size
                              applyMassEdit({ size: '2.5"' });
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="resize" size={24} color={Colors.primary} />
                    <View style={styles.massEditOptionContent}>
                      <Text style={styles.massEditOptionTitle}>Set Animal Size</Text>
                      <Text style={styles.massEditOptionDescription}>
                        Update size for all animals in selected cages
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.massEditOption}
                    onPress={() => {
                      Alert.alert(
                        'Set Status',
                        'Choose status for all bags in selected cages:',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Empty', onPress: () => applyMassEdit({ status: 'empty' }) },
                          { text: 'Active', onPress: () => applyMassEdit({ status: 'active' }) },
                          { text: 'Harvested', onPress: () => applyMassEdit({ status: 'harvested' }) },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="flag" size={24} color={Colors.primary} />
                    <View style={styles.massEditOptionContent}>
                      <Text style={styles.massEditOptionTitle}>Set Status</Text>
                      <Text style={styles.massEditOptionDescription}>
                        Update status for all bags in selected cages
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.massEditOption}
                    onPress={() => {
                      Alert.alert(
                        'Clear All Data',
                        'This will reset all bags in selected cages to empty state. Are you sure?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Clear All',
                            style: 'destructive',
                            onPress: () => applyMassEdit({ 
                              amount: 0, 
                              size: '', 
                              cohort: '', 
                              status: 'empty' 
                            })
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash" size={24} color={Colors.error} />
                    <View style={styles.massEditOptionContent}>
                      <Text style={[styles.massEditOptionTitle, { color: Colors.error }]}>Clear All Data</Text>
                      <Text style={styles.massEditOptionDescription}>
                        Reset all bags to empty state
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </View>
      <ChatbotFAB />
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
  editButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  editButtonActive: {
    backgroundColor: Colors.primary,
  },
  actionButtons: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  actionButtonText: {
    ...Typography.body2,
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },
  editModeText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  mapContainer: {
    flex: 1,
    margin: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#E3F2FD',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  placeholderBackground: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#E3F2FD',
  },
  waterArea: {
    flex: 1,
    position: 'relative',
  },
  dockArea: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 60,
    height: 100,
    backgroundColor: '#8D6E63',
    borderRadius: 8,
  },
  shallowWater: {
    position: 'absolute',
    top: 50,
    left: 100,
    right: 50,
    height: 150,
    backgroundColor: '#81C784',
    borderRadius: 20,
    opacity: 0.7,
  },
  deepWater: {
    position: 'absolute',
    bottom: 80,
    left: 50,
    right: 20,
    height: 120,
    backgroundColor: '#42A5F5',
    borderRadius: 25,
    opacity: 0.8,
  },
  placeholderText: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    ...Typography.h3,
    color: Colors.primary,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  placeholderSubtext: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  cageSpot: {
    position: 'absolute',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  cageLabel: {
    ...Typography.caption,
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 10,
  },
  selectedCageInfo: {
    position: 'absolute',
    bottom: 20,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  selectedCageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  selectedCageTitle: {
    ...Typography.h3,
    color: Colors.text,
    flex: 1,
  },
  cageActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  editCageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  editCageButtonText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  deleteCageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  deleteCageButtonText: {
    ...Typography.caption,
    color: Colors.error,
    fontWeight: '600',
  },
  selectedCageDetails: {
    gap: Spacing.xs,
  },
  selectedCageDetail: {
    ...Typography.body2,
    color: Colors.textSecondary,
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
    marginBottom: Spacing.sm,
  },
  modalDescription: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: 16,
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
  typeSelector: {
    marginBottom: Spacing.md,
  },
  typeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeButton: {
    flex: 1,
    padding: Spacing.md,
    marginHorizontal: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    minHeight: 70,
    justifyContent: 'center',
  },
  typeButtonIcon: {
    fontSize: 24,
    marginBottom: Spacing.xs,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
  },
  typeButtonText: {
    ...Typography.body2,
    color: Colors.primary,
  },
  typeButtonTextActive: {
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
  addButton: {
    backgroundColor: Colors.primary,
  },
  addButtonText: {
    ...Typography.body1,
    color: Colors.surface,
    fontWeight: 'bold',
  },
  // Zoom and Pan Styles
  zoomControls: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
    flexDirection: 'column',
  },
  zoomButton: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resetButton: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  animatedMapContent: {
    flex: 1,
  },
  mapBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // Bag Styles
  bagCount: {
    ...Typography.caption,
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  bagButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 2,
  },
  // Bag Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  bagList: {
    flex: 1,
    padding: Spacing.md,
  },
  bagItem: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  bagTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontSize: 16,
  },
  bagStatus: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  bagStatusText: {
    ...Typography.caption,
    color: 'white',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  bagDetails: {
    gap: Spacing.md,
  },
  bagDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bagLabel: {
    ...Typography.body1,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
  },
  bagInput: {
    flex: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    ...Typography.body1,
    textAlign: 'right',
  },
  sizeSelector: {
    flexDirection: 'row',
    flex: 2,
    gap: Spacing.xs,
  },
  sizeButton: {
    flex: 1,
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  sizeButtonActive: {
    backgroundColor: Colors.primary,
  },
  sizeButtonText: {
    ...Typography.caption,
    color: Colors.primary,
  },
  sizeButtonTextActive: {
    color: 'white',
  },
  statusSelector: {
    flexDirection: 'row',
    flex: 2,
    gap: Spacing.xs,
  },
  statusButton: {
    flex: 1,
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  statusButtonText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  statusButtonTextActive: {
    color: 'white',
  },
  // Bag Grid Styles
  bagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  bagGridItem: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'space-between',
  },
  bagGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bagGridTitle: {
    ...Typography.caption,
    fontWeight: 'bold',
    color: Colors.text,
  },
  bagGridStatus: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bagGridStatusText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  bagGridInfo: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  bagGridAmount: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: 'bold',
  },
  bagGridSize: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  bagGridCohort: {
    ...Typography.caption,
    color: Colors.primary,
    fontSize: 10,
  },
  // Bag Edit Panel Styles
  bagEditPanel: {
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bagEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  bagEditTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  bagEditContent: {
    gap: Spacing.lg,
  },
  bagEditGroup: {
    gap: Spacing.xs,
  },
  bagEditDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  bagEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bagEditLabel: {
    ...Typography.body1,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
  },
  bagEditInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body1,
    backgroundColor: Colors.surface,
    minHeight: 44,
  },
  bagEditButtons: {
    flexDirection: 'row',
    flex: 2,
    gap: Spacing.xs,
  },
  bagEditButton: {
    flex: 1,
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  bagEditButtonActive: {
    backgroundColor: Colors.primary,
  },
  bagEditButtonText: {
    ...Typography.caption,
    color: Colors.primary,
  },
  bagEditButtonTextActive: {
    color: 'white',
  },
  // Multi-select styles
  selectionIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonActive: {
    backgroundColor: Colors.primary,
  },
  actionButtonTextActive: {
    color: Colors.white,
  },
  multiSelectToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectionInfo: {
    flex: 1,
  },
  selectionText: {
    ...Typography.body2,
    color: Colors.text,
    fontWeight: '600',
  },
  multiSelectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    gap: 4,
  },
  toolbarButtonText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  massEditButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  massEditButtonText: {
    color: Colors.white,
  },
  // Mass edit modal styles
  selectedCagesList: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.md,
  },
  selectedCageItem: {
    ...Typography.body2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  massEditOptions: {
    marginTop: Spacing.lg,
  },
  massEditOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  massEditOptionContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  massEditOptionTitle: {
    ...Typography.body1,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  massEditOptionDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
});

export default InteractiveFarmMapScreen;
