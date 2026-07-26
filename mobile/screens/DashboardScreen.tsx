import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAdmin } from '../contexts/AdminContext';
import ChatbotFAB from '../components/ChatbotFAB';
import AppHeader from '../components/AppHeader';
import { supabase } from '../utils/supabase';
import { errorHandler } from '../utils/errorHandler';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { networkUtils } from '../utils/networkUtils';
import { useToast } from '../utils/useToast';
import { getFarmStats, getLatestTelemetry } from '../utils/iotApi';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

interface DashboardScreenProps {
  navigation: any;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { currentUser, logout, getCurrentFarmName } = useAdmin();
  const { showSuccess, showError } = useToast();
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState('Farm A - Oyster Bay');
  const [editMode, setEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iotLive, setIotLive] = useState<{
    points1h: number;
    sensors: number;
    doValue: string;
    tempValue: string;
  } | null>(null);
  
  useEffect(() => {
    // Check if currentUser exists and has admin role
    if (currentUser && currentUser.role === 'admin') {
      setIsAdminUser(true);
    } else {
      setIsAdminUser(false);
      setEditMode(false); // Disable edit mode if not admin
    }
  }, [currentUser]);
  
  // Editable metrics data
  const [metricsData, setMetricsData] = useState({
    totalProduction: { value: '0', unit: 'kg', change: '0%', type: 'neutral' },
    activeBatches: { value: '0', unit: 'batches', change: '0', type: 'neutral' },
    waterQuality: { value: '0', unit: '/10', change: '0', type: 'neutral' },
    revenue: { value: '$0', unit: 'this month', change: '0%', type: 'neutral' },
  });

  // Live IoT pipeline metrics (FastAPI + Timescale) — best-effort overlay
  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const [stats, latest] = await Promise.all([
          getFarmStats('farm-alpha'),
          getLatestTelemetry('farm-alpha', 40),
        ]);
        if (cancelled) return;
        const doReading = latest.find((p) => p.metric === 'dissolved_oxygen');
        const tempReading = latest.find((p) => p.metric === 'temperature');
        setIotLive({
          points1h: stats.total_points_1h,
          sensors: stats.active_sensors_1h,
          doValue: doReading ? `${doReading.value}${doReading.unit}` : '—',
          tempValue: tempReading ? `${tempReading.value}${tempReading.unit}` : '—',
        });
        if (doReading) {
          const score = Math.max(0, Math.min(10, doReading.value)).toFixed(1);
          setMetricsData((prev) => ({
            ...prev,
            waterQuality: {
              ...prev.waterQuality,
              value: score,
              change: 'live',
              type: doReading.value < 5 ? 'negative' : 'positive',
            },
          }));
        }
      } catch {
        // Backend optional when developing mobile offline
      }
    };
    void pull();
    const id = setInterval(pull, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Load saved metrics data
  useEffect(() => {
    loadMetricsData();
  }, []);

  const loadMetricsData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!currentUser?.id) return;
      
      // Check network connectivity
      if (!networkUtils.isOnline()) {
        setError('No internet connection. Please check your network.');
        return;
      }
      
      const { data, error } = await supabase
        .from('dashboard')
        .select('*')
        .eq('farm_id', currentUser.id)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error; // ignore no rows error
      if (data) {
        setMetricsData(data.metricsData || data); // support both direct and nested
        showSuccess('Dashboard data loaded successfully');
      }
    } catch (error) {
      const appError = errorHandler.logError(error as Error, 'Failed to load metrics data');
      const errorMessage = errorHandler.getUserFriendlyMessage(appError);
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Save metrics data when it changes
  useEffect(() => {
    if (currentUser?.id) {
      saveMetricsData();
    }
  }, [metricsData]);

  const saveMetricsData = async () => {
    try {
      if (!currentUser?.id) return;
      
      const { error } = await supabase
        .from('dashboard')
        .upsert({
          farm_id: currentUser.id,
          metricsData: metricsData,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'farm_id'
        });
        
      if (error) throw error;
    } catch (error) {
      console.error('Error saving metrics data:', error);
      showError('Failed to save dashboard data');
    }
  };

  const handleMetricUpdate = (key: string, value: string) => {
    setMetricsData(prev => ({
      ...prev,
      [key]: {
        ...prev[key as keyof typeof prev],
        value: value,
      }
    }));
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadMetricsData().finally(() => setIsRefreshing(false));
  };

  const startEditing = (itemId: string, currentValue: string) => {
    setEditingItem(itemId);
    setTempValue(currentValue);
  };

  const saveEdit = (itemId: string) => {
    const key = itemId.replace('metric-', '');
    handleMetricUpdate(key, tempValue);
    setEditingItem(null);
    setTempValue('');
    showSuccess('Metric updated successfully');
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setTempValue('');
  };

  const getMetricTitle = (key: string) => {
    const titles: { [key: string]: string } = {
      totalProduction: 'Total Production',
      activeBatches: 'Active Batches',
      waterQuality: 'Water Quality',
      revenue: 'Revenue',
    };
    return titles[key] || key;
  };

  const getMetricIcon = (key: string): keyof typeof Ionicons.glyphMap => {
    const icons: { [key: string]: keyof typeof Ionicons.glyphMap } = {
      totalProduction: 'trending-up',
      activeBatches: 'layers',
      waterQuality: 'water',
      revenue: 'cash',
    };
    return icons[key] || 'analytics';
  };

  const saveMetric = (key: string, value: string) => {
    handleMetricUpdate(key, value);
    setEditingItem(null);
    setTempValue('');
    showSuccess('Metric updated successfully');
  };

  const getChangeColor = (type: string) => {
    switch (type) {
      case 'positive': return Colors.success;
      case 'negative': return Colors.error;
      default: return Colors.textSecondary;
    }
  };

  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        data: [20, 45, 28, 80, 99, 43],
        color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader title="Dashboard" />
        <LoadingSpinner visible={true} message="Loading dashboard..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Dashboard" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {error && (
          <ErrorMessage
            message={error}
            onRetry={loadMetricsData}
            type="error"
          />
        )}

        {iotLive && (
          <View style={styles.iotStrip}>
            <Text style={styles.iotTitle}>Live IoT pipeline</Text>
            <Text style={styles.iotMeta}>
              {iotLive.sensors} sensors · {iotLive.points1h.toLocaleString()} pts/hr · DO {iotLive.doValue} · Temp {iotLive.tempValue}
            </Text>
          </View>
        )}

        {/* Admin Controls */}
        {isAdminUser && (
          <View style={styles.adminControls}>
            <Text style={styles.sectionTitle}>Admin Controls</Text>
            <View style={styles.controlButtons}>
              <TouchableOpacity
                style={[styles.controlButton, editMode && styles.controlButtonActive]}
                onPress={() => setEditMode(!editMode)}
              >
                <Ionicons 
                  name={editMode ? 'checkmark' : 'create'} 
                  size={18} 
                  color={editMode ? Colors.surface : Colors.primary} 
                />
                <Text style={[styles.controlButtonText, editMode && styles.controlButtonTextActive]}>
                  {editMode ? 'Done' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Farm Selector */}
        <View style={styles.farmSelector}>
          <Text style={styles.sectionTitle}>Selected Farm</Text>
          <TouchableOpacity style={styles.farmButton}>
            <Text style={styles.farmButtonText}>{selectedFarm}</Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Metrics Cards */}
        <View style={styles.metricsContainer}>
          {Object.entries(metricsData).map(([key, metric]) => {
            const metricId = `metric-${key}`;
            const isEditing = editingItem === metricId;
            
            return (
              <TouchableOpacity 
                key={key} 
                style={[
                  styles.metricCard,
                  isAdminUser && editMode && styles.editableCard
                ]}
                onPress={() => {
                  if (isAdminUser && editMode) {
                    startEditing(metricId, metric.value);
                  }
                }}
              >
                <View style={styles.metricHeader}>
                  <Ionicons 
                    name={getMetricIcon(key)} 
                    size={24} 
                    color={Colors.primary} 
                  />
                  {isEditing ? (
                    <TextInput
                      style={styles.metricInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                      onBlur={() => {
                        saveMetric(key, tempValue);
                      }}
                      onSubmitEditing={() => {
                        saveMetric(key, tempValue);
                      }}
                      keyboardType={key === 'waterQuality' ? 'decimal-pad' : 'default'}
                    />
                  ) : (
                    <Text style={styles.metricValue}>
                      {metric.value} {metric.unit}
                    </Text>
                  )}
                </View>
                <Text style={styles.metricTitle}>
                  {getMetricTitle(key)}
                </Text>
                <Text 
                  style={[
                    styles.metricChange, 
                    { color: getChangeColor(metric.type) }
                  ]}
                >
                  {metric.change}
                </Text>
                {isAdminUser && editMode && !isEditing && (
                  <View style={styles.editHint}>
                    <Text style={styles.editHintText}>Tap to edit</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Growth Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>Growth Trends</Text>
          <LineChart
            data={chartData}
            width={screenWidth - (isSmallScreen ? 24 : 32)}
            height={isSmallScreen ? 180 : 220}
            chartConfig={{
              backgroundColor: Colors.surface,
              backgroundGradientFrom: Colors.surface,
              backgroundGradientTo: Colors.surface,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '6',
                strokeWidth: '2',
                stroke: Colors.primary,
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>

        {/* Recent Activity */}
        <View style={styles.activityContainer}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Ionicons name="basket" size={16} color={Colors.success} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Harvest Completed</Text>
                <Text style={styles.activityTime}>2 hours ago</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Ionicons name="water" size={16} color={Colors.info} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Water Quality Check</Text>
                <Text style={styles.activityTime}>4 hours ago</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Ionicons name="layers" size={16} color={Colors.warning} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>New Batch Started</Text>
                <Text style={styles.activityTime}>1 day ago</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <ChatbotFAB />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  iotStrip: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  iotTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  iotMeta: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  adminControls: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  controlButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  controlButtonActive: {
    backgroundColor: Colors.primary,
  },
  controlButtonText: {
    ...Typography.body2,
    color: Colors.primary,
    marginLeft: Spacing.xs,
    fontWeight: '600',
  },
  controlButtonTextActive: {
    color: Colors.surface,
  },
  farmSelector: {
    marginBottom: Spacing.lg,
  },
  farmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  farmButtonText: {
    ...Typography.body1,
    color: Colors.text,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  metricCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 2,
  },
  editableCard: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  metricValue: {
    ...Typography.h2,
    color: Colors.text,
    fontWeight: 'bold',
  },
  metricInput: {
    ...Typography.h2,
    color: Colors.text,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  metricTitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  metricChange: {
    ...Typography.caption,
    fontWeight: '600',
  },
  editHint: {
    marginTop: Spacing.xs,
  },
  editHintText: {
    ...Typography.caption,
    color: Colors.primary,
    fontStyle: 'italic',
  },
  chartContainer: {
    marginBottom: Spacing.lg,
  },
  chart: {
    marginVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  activityContainer: {
    marginBottom: Spacing.lg,
  },
  activityList: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    ...Typography.body2,
    color: Colors.text,
    fontWeight: '500',
  },
  activityTime: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

export default DashboardScreen;
