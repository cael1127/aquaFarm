import React from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import InteractiveFarmMapScreen from '../screens/InteractiveFarmMapScreen';
import BatchManagementScreen from '../screens/BatchManagementScreen';
import HarvestTrackingScreen from '../screens/HarvestTrackingScreen';
import AdminPanelScreen from '../screens/AdminPanelScreen';
import ChatbotScreen from '../screens/ChatbotScreen';
import InventoryScreen from '../screens/InventoryScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';

import { RootStackParamList, BottomTabParamList } from '../types/navigation';
import { Colors } from '../constants/theme';
import { useAdmin } from '../contexts/AdminContext';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

// Loading Screen Component
const LoadingScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface }}>
    <ActivityIndicator size="large" color={Colors.primary} />
  </View>
);

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'FarmMap') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'BatchManagement') {
            iconName = focused ? 'layers' : 'layers-outline';
          } else if (route.name === 'HarvestTracking') {
            iconName = focused ? 'basket' : 'basket-outline';
          } else if (route.name === 'Chatbot') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else {
            iconName = 'ellipse-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: '#E0E0E0',
          paddingBottom: Platform.OS === 'ios' ? 20 : 5,
          paddingTop: 5,
          height: Platform.OS === 'ios' ? 85 : 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="FarmMap"
        component={InteractiveFarmMapScreen}
        options={{
          tabBarLabel: 'Farm Map',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="BatchManagement" 
        component={BatchManagementScreen}
        options={{ tabBarLabel: 'Batches' }}
      />
      <Tab.Screen 
        name="HarvestTracking" 
        component={HarvestTrackingScreen}
        options={{ tabBarLabel: 'Harvest' }}
      />
      <Tab.Screen 
        name="Chatbot" 
        component={ChatbotScreen}
        options={{ tabBarLabel: 'Assistant' }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { currentUser, isLoading } = useAdmin();

  // Show loading screen while checking authentication
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {currentUser ? (
        <MainTabNavigator />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

export default AppNavigator;
