import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useAdmin } from '../contexts/AdminContext';
import { getFarmStorageKey, STORAGE_KEYS } from '../utils/storage';
import { supabase } from '../utils/supabase';

interface ReportData {
  farmName: string;
  reportDate: string;
  totalCages: number;
  activeCages: number;
  totalProduction: number;
  harvestReady: number;
  estimatedValue: number;
  growthRate: number;
  efficiency: number;
  cageDetails: CageReport[];
}

interface CageReport {
  id: string;
  name: string;
  type: string;
  status: string;
  totalAnimals: number;
  averageSize: number;
  harvestReady: number;
  estimatedValue: number;
  lastUpdated: string;
}

const ReportsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { currentUser, getCurrentFarmName } = useAdmin();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [selectedReportType, setSelectedReportType] = useState<'summary' | 'detailed' | 'financial'>('summary');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateReport();
  }, []);

  const generateReport = async () => {
    try {
      setLoading(true);
      if (!currentUser?.id) return;
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('farm_id', currentUser.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // ignore no rows error
      if (data) {
        const report = await processReportData(data);
        setReportData(report);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const processReportData = async (farmData: any): Promise<ReportData> => {
    const cages = farmData.cageSpots || [];
    const reportDate = new Date().toLocaleDateString();
    
    let totalProduction = 0;
    let harvestReady = 0;
    let totalValue = 0;
    
    const cageDetails: CageReport[] = cages.map((cage: any) => {
      let cageTotalAnimals = 0;
      let cageTotalSize = 0;
      let cageSizeCount = 0;
      let cageHarvestReady = 0;
      
      if (cage.bags) {
        cage.bags.forEach((bag: any) => {
          if (bag.status === 'active') {
            cageTotalAnimals += bag.amount;
            totalProduction += bag.amount;
            
            if (bag.size > 0) {
              cageTotalSize += bag.size * bag.amount;
              cageSizeCount += bag.amount;
            }
            
            // Harvest ready calculation
            const isHarvestReady = (cage.type !== 'salmon' && bag.size >= 2.5) || 
                                 (cage.type === 'salmon' && bag.size >= 500);
            if (isHarvestReady) {
              cageHarvestReady += bag.amount;
              harvestReady += bag.amount;
            }
          }
        });
      }
      
      const averageSize = cageSizeCount > 0 ? cageTotalSize / cageSizeCount : 0;
      const cageValue = calculateCageValue(cage.type, cageTotalAnimals, averageSize);
      totalValue += cageValue;
      
      return {
        id: cage.id,
        name: cage.name,
        type: cage.type,
        status: cage.status,
        totalAnimals: cageTotalAnimals,
        averageSize,
        harvestReady: cageHarvestReady,
        estimatedValue: cageValue,
        lastUpdated: new Date().toLocaleDateString(),
      };
    });

    return {
      farmName: 'Aquafarm Management System',
      reportDate,
      totalCages: cages.length,
      activeCages: cages.filter((c: any) => c.status === 'active').length,
      totalProduction,
      harvestReady,
      estimatedValue: totalValue,
      growthRate: 12.5, // Mock growth rate
      efficiency: cages.length > 0 ? (totalProduction / (cages.length * 500)) * 100 : 0,
      cageDetails,
    };
  };

  const calculateCageValue = (type: string, animals: number, avgSize: number): number => {
    const prices = {
      oyster: 0.75, // per piece
      mussel: 0.50, // per piece
      salmon: 8.00, // per pound (assuming size in grams, convert to pounds)
    };
    
    const basePrice = prices[type as keyof typeof prices] || 0.50;
    
    if (type === 'salmon') {
      // Convert grams to pounds and calculate
      const pounds = (avgSize * animals) / 453.592;
      return pounds * basePrice;
    } else {
      // Size premium for shellfish
      const sizePremium = avgSize > 2.5 ? 1.2 : avgSize > 2.0 ? 1.1 : 1.0;
      return animals * basePrice * sizePremium;
    }
  };

  const exportReport = async () => {
    if (!reportData) return;
    
    const reportText = generateReportText(reportData);
    
    try {
      await Share.share({
        message: reportText,
        title: `Aquafarm Report - ${reportData.reportDate}`,
      });
    } catch (error) {
      console.error('Error sharing report:', error);
      Alert.alert('Error', 'Failed to export report');
    }
  };

  const generateReportText = (data: ReportData): string => {
    return `
AQUAFARM MANAGEMENT REPORT
${data.farmName}
Report Date: ${data.reportDate}

EXECUTIVE SUMMARY
================
Total Cages: ${data.totalCages}
Active Cages: ${data.activeCages}
Total Production: ${data.totalProduction.toLocaleString()} animals
Harvest Ready: ${data.harvestReady.toLocaleString()} animals
Estimated Value: $${data.estimatedValue.toLocaleString()}
Growth Rate: ${data.growthRate}%
Efficiency: ${data.efficiency.toFixed(1)}%

CAGE DETAILS
============
${data.cageDetails.map(cage => `
${cage.name} (${cage.id})
- Type: ${cage.type.charAt(0).toUpperCase() + cage.type.slice(1)}
- Status: ${cage.status.charAt(0).toUpperCase() + cage.status.slice(1)}
- Animals: ${cage.totalAnimals.toLocaleString()}
- Avg Size: ${cage.averageSize.toFixed(1)}"
- Harvest Ready: ${cage.harvestReady.toLocaleString()}
- Est. Value: $${cage.estimatedValue.toLocaleString()}
`).join('')}

Generated by Aquafarm Management System
    `;
  };

  const renderSummaryReport = () => (
    <View style={styles.reportSection}>
      <Text style={styles.sectionTitle}>Executive Summary</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{reportData?.totalCages}</Text>
          <Text style={styles.summaryLabel}>Total Cages</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{reportData?.activeCages}</Text>
          <Text style={styles.summaryLabel}>Active Cages</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{reportData?.totalProduction.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Total Animals</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{reportData?.harvestReady.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Harvest Ready</Text>
        </View>
      </View>
      
      <View style={styles.valueSection}>
        <Text style={styles.valueTitle}>Estimated Farm Value</Text>
        <Text style={styles.valueAmount}>${reportData?.estimatedValue.toLocaleString()}</Text>
        <Text style={styles.valueSubtext}>Based on current market prices</Text>
      </View>
    </View>
  );

  const renderDetailedReport = () => (
    <View style={styles.reportSection}>
      <Text style={styles.sectionTitle}>Detailed Cage Analysis</Text>
      {reportData?.cageDetails.map((cage, index) => (
        <View key={cage.id} style={styles.cageReportCard}>
          <View style={styles.cageHeader}>
            <Text style={styles.cageName}>{cage.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(cage.status) }]}>
              <Text style={styles.statusText}>{cage.status.toUpperCase()}</Text>
            </View>
          </View>
          
          <View style={styles.cageMetrics}>
            <View style={styles.cageMetric}>
              <Text style={styles.metricLabel}>Type</Text>
              <Text style={styles.metricValue}>{cage.type.charAt(0).toUpperCase() + cage.type.slice(1)}</Text>
            </View>
            <View style={styles.cageMetric}>
              <Text style={styles.metricLabel}>Animals</Text>
              <Text style={styles.metricValue}>{cage.totalAnimals.toLocaleString()}</Text>
            </View>
            <View style={styles.cageMetric}>
              <Text style={styles.metricLabel}>Avg Size</Text>
              <Text style={styles.metricValue}>{cage.averageSize.toFixed(1)}"</Text>
            </View>
            <View style={styles.cageMetric}>
              <Text style={styles.metricLabel}>Est. Value</Text>
              <Text style={styles.metricValue}>${cage.estimatedValue.toLocaleString()}</Text>
            </View>
          </View>
          
          <View style={styles.harvestInfo}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.harvestText}>
              {cage.harvestReady.toLocaleString()} animals ready for harvest
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderFinancialReport = () => (
    <View style={styles.reportSection}>
      <Text style={styles.sectionTitle}>Financial Analysis</Text>
      
      <View style={styles.financialCard}>
        <Text style={styles.financialTitle}>Revenue Breakdown</Text>
        {reportData?.cageDetails.map((cage) => (
          <View key={cage.id} style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>{cage.name}</Text>
            <Text style={styles.revenueValue}>${cage.estimatedValue.toLocaleString()}</Text>
          </View>
        ))}
        <View style={styles.totalRevenue}>
          <Text style={styles.totalLabel}>Total Estimated Value</Text>
          <Text style={styles.totalValue}>${reportData?.estimatedValue.toLocaleString()}</Text>
        </View>
      </View>
      
      <View style={styles.performanceMetrics}>
        <Text style={styles.metricsTitle}>Performance Metrics</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricName}>Growth Rate</Text>
          <Text style={styles.metricResult}>{reportData?.growthRate}%</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricName}>Farm Efficiency</Text>
          <Text style={styles.metricResult}>{reportData?.efficiency.toFixed(1)}%</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricName}>Harvest Readiness</Text>
          <Text style={styles.metricResult}>
            {reportData ? ((reportData.harvestReady / reportData.totalProduction) * 100).toFixed(1) : 0}%
          </Text>
        </View>
      </View>
    </View>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return Colors.success;
      case 'maintenance': return Colors.warning;
      case 'empty': return Colors.textSecondary;
      default: return Colors.textSecondary;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Generating Report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Farm Reports</Text>
        <TouchableOpacity onPress={exportReport}>
          <Ionicons name="share-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.reportTypeSelector}>
        {(['summary', 'detailed', 'financial'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.typeButton,
              selectedReportType === type && styles.typeButtonActive,
            ]}
            onPress={() => setSelectedReportType(type)}
          >
            <Text
              style={[
                styles.typeButtonText,
                selectedReportType === type && styles.typeButtonTextActive,
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.reportHeader}>
          <Text style={styles.reportTitle}>Aquafarm Management Report</Text>
          <Text style={styles.reportDate}>Generated: {reportData?.reportDate}</Text>
        </View>

        {selectedReportType === 'summary' && renderSummaryReport()}
        {selectedReportType === 'detailed' && renderDetailedReport()}
        {selectedReportType === 'financial' && renderFinancialReport()}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  reportTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    margin: Spacing.lg,
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
  },
  typeButtonText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  typeButtonTextActive: {
    color: Colors.surface,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  reportHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  reportTitle: {
    ...Typography.h1,
    color: Colors.text,
    textAlign: 'center',
  },
  reportDate: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  reportSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  summaryItem: {
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
  summaryValue: {
    ...Typography.h1,
    color: Colors.primary,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  valueSection: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  valueTitle: {
    ...Typography.h3,
    color: Colors.surface,
  },
  valueAmount: {
    ...Typography.h1,
    color: Colors.surface,
    fontSize: 36,
    marginVertical: Spacing.sm,
  },
  valueSubtext: {
    ...Typography.caption,
    color: Colors.surface,
    opacity: 0.8,
  },
  cageReportCard: {
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
  cageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cageName: {
    ...Typography.h3,
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.caption,
    color: Colors.surface,
    fontWeight: 'bold',
  },
  cageMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  cageMetric: {
    alignItems: 'center',
  },
  metricLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  metricValue: {
    ...Typography.body1,
    color: Colors.text,
    fontWeight: 'bold',
    marginTop: Spacing.xs,
  },
  harvestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  harvestText: {
    ...Typography.body2,
    color: Colors.success,
    marginLeft: Spacing.sm,
  },
  financialCard: {
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
  financialTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  revenueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  revenueLabel: {
    ...Typography.body1,
    color: Colors.text,
  },
  revenueValue: {
    ...Typography.body1,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  totalRevenue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.lg,
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
    marginTop: Spacing.md,
  },
  totalLabel: {
    ...Typography.h3,
    color: Colors.text,
  },
  totalValue: {
    ...Typography.h3,
    color: Colors.primary,
  },
  performanceMetrics: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  metricsTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  metricName: {
    ...Typography.body1,
    color: Colors.text,
  },
  metricResult: {
    ...Typography.body1,
    color: Colors.success,
    fontWeight: 'bold',
  },
});

export default ReportsScreen;
