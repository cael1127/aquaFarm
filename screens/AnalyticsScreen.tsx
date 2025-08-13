import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useAdmin } from '../contexts/AdminContext';
import { getFarmStorageKey, STORAGE_KEYS } from '../utils/storage';
import { supabase } from '../utils/supabase';

interface AnalyticsData {
  totalCages: number;
  activeCages: number;
  totalAnimals: number;
  averageSize: number;
  growthRate: number;
  harvestReady: number;
  productionValue: number;
  efficiency: number;
}

interface GrowthData {
  labels: string[];
  datasets: [{
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }];
}

const AnalyticsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { currentUser } = useAdmin();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalCages: 0,
    activeCages: 0,
    totalAnimals: 0,
    averageSize: 0,
    growthRate: 0,
    harvestReady: 0,
    productionValue: 0,
    efficiency: 0,
  });

  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [growthData, setGrowthData] = useState<GrowthData>({
    labels: [],
    datasets: [{ data: [] }]
  });

  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    try {
      if (!currentUser?.id) return;
      const { data, error } = await supabase
        .from('analytics')
        .select('*')
        .eq('farm_id', currentUser.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // ignore no rows error
      if (data) {
        calculateAnalytics(data);
        generateGrowthData();
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const calculateAnalytics = (farmData: any) => {
    const cages = farmData.cageSpots || [];
    const totalCages = cages.length;
    const activeCages = cages.filter((cage: any) => cage.status === 'active').length;
    
    let totalAnimals = 0;
    let totalSize = 0;
    let sizeCount = 0;
    let harvestReady = 0;

    cages.forEach((cage: any) => {
      if (cage.bags) {
        cage.bags.forEach((bag: any) => {
          if (bag.status === 'active') {
            totalAnimals += bag.amount;
            if (bag.size > 0) {
              totalSize += bag.size * bag.amount;
              sizeCount += bag.amount;
            }
            // Consider harvest ready if size > 2.5 inches for oysters/mussels or > 500g for salmon
            if ((cage.type !== 'salmon' && bag.size >= 2.5) || 
                (cage.type === 'salmon' && bag.size >= 500)) {
              harvestReady += bag.amount;
            }
          }
        });
      }
    });

    const averageSize = sizeCount > 0 ? totalSize / sizeCount : 0;
    const growthRate = 12.5; // Mock growth rate percentage
    const productionValue = totalAnimals * 2.5; // Mock value calculation
    const efficiency = activeCages > 0 ? (totalAnimals / (activeCages * 500)) * 100 : 0;

    setAnalytics({
      totalCages,
      activeCages,
      totalAnimals,
      averageSize,
      growthRate,
      harvestReady,
      productionValue,
      efficiency,
    });
  };

  const generateGrowthData = () => {
    // Mock growth data - in real app, this would come from historical data
    const labels = selectedPeriod === 'week' 
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : selectedPeriod === 'month'
      ? ['Week 1', 'Week 2', 'Week 3', 'Week 4']
      : ['Q1', 'Q2', 'Q3', 'Q4'];

    const data = selectedPeriod === 'week'
      ? [2.1, 2.15, 2.2, 2.25, 2.3, 2.35, 2.4]
      : selectedPeriod === 'month'
      ? [2.0, 2.2, 2.4, 2.6]
      : [1.8, 2.2, 2.8, 3.2];

    setGrowthData({
      labels,
      datasets: [{
        data,
        color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
        strokeWidth: 3,
      }]
    });
  };

  const chartConfig = {
    backgroundColor: Colors.surface,
    backgroundGradientFrom: Colors.surface,
    backgroundGradientTo: Colors.surface,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: BorderRadius.lg,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: Colors.primary,
    },
  };

  const productionData = [
    {
      name: 'Oysters',
      population: analytics.totalAnimals * 0.6,
      color: '#2E7D32',
      legendFontColor: Colors.text,
      legendFontSize: 12,
    },
    {
      name: 'Mussels',
      population: analytics.totalAnimals * 0.3,
      color: '#1976D2',
      legendFontColor: Colors.text,
      legendFontSize: 12,
    },
    {
      name: 'Salmon',
      population: analytics.totalAnimals * 0.1,
      color: '#D32F2F',
      legendFontColor: Colors.text,
      legendFontSize: 12,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics Dashboard</Text>
        <TouchableOpacity>
          <Ionicons name="download-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Ionicons name="grid-outline" size={24} color={Colors.primary} />
            <Text style={styles.metricValue}>{analytics.totalCages}</Text>
            <Text style={styles.metricLabel}>Total Cages</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="pulse-outline" size={24} color={Colors.success} />
            <Text style={styles.metricValue}>{analytics.activeCages}</Text>
            <Text style={styles.metricLabel}>Active Cages</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="fish-outline" size={24} color={Colors.info} />
            <Text style={styles.metricValue}>{analytics.totalAnimals.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Total Animals</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="trending-up-outline" size={24} color={Colors.warning} />
            <Text style={styles.metricValue}>{analytics.averageSize.toFixed(1)}"</Text>
            <Text style={styles.metricLabel}>Avg Size</Text>
          </View>
        </View>

        {/* Growth Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Growth Tracking</Text>
            <View style={styles.periodSelector}>
              {(['week', 'month', 'year'] as const).map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    selectedPeriod === period && styles.periodButtonActive,
                  ]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text
                    style={[
                      styles.periodButtonText,
                      selectedPeriod === period && styles.periodButtonTextActive,
                    ]}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {growthData.labels.length > 0 && (
            <LineChart
              data={growthData}
              width={screenWidth - 40}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          )}
        </View>

        {/* Production Distribution */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Production Distribution</Text>
          <PieChart
            data={productionData}
            width={screenWidth - 40}
            height={200}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>

        {/* Performance Indicators */}
        <View style={styles.performanceCard}>
          <Text style={styles.sectionTitle}>Performance Indicators</Text>
          <View style={styles.performanceItem}>
            <View style={styles.performanceInfo}>
              <Text style={styles.performanceLabel}>Growth Rate</Text>
              <Text style={styles.performanceValue}>+{analytics.growthRate}%</Text>
            </View>
            <View style={[styles.progressBar, { width: `${analytics.growthRate * 4}%` }]} />
          </View>
          <View style={styles.performanceItem}>
            <View style={styles.performanceInfo}>
              <Text style={styles.performanceLabel}>Harvest Ready</Text>
              <Text style={styles.performanceValue}>{analytics.harvestReady.toLocaleString()}</Text>
            </View>
            <View style={[styles.progressBar, { width: `${(analytics.harvestReady / analytics.totalAnimals) * 100}%` }]} />
          </View>
          <View style={styles.performanceItem}>
            <View style={styles.performanceInfo}>
              <Text style={styles.performanceLabel}>Efficiency</Text>
              <Text style={styles.performanceValue}>{analytics.efficiency.toFixed(1)}%</Text>
            </View>
            <View style={[styles.progressBar, { width: `${analytics.efficiency}%` }]} />
          </View>
          <View style={styles.performanceItem}>
            <View style={styles.performanceInfo}>
              <Text style={styles.performanceLabel}>Est. Value</Text>
              <Text style={styles.performanceValue}>${analytics.productionValue.toLocaleString()}</Text>
            </View>
            <View style={[styles.progressBar, { width: '75%' }]} />
          </View>
        </View>
      </ScrollView>
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
    padding: Spacing.lg,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  metricCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  metricValue: {
    ...Typography.h1,
    color: Colors.text,
    marginVertical: Spacing.sm,
  },
  metricLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  chartTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: BorderRadius.md,
    padding: 2,
  },
  periodButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodButtonText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  periodButtonTextActive: {
    color: Colors.surface,
  },
  chart: {
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  performanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  performanceItem: {
    marginBottom: Spacing.lg,
  },
  performanceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  performanceLabel: {
    ...Typography.body1,
    color: Colors.text,
  },
  performanceValue: {
    ...Typography.body1,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
});

export default AnalyticsScreen;
