import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdminProvider } from './contexts/AdminContext';
import AppNavigator from './navigation/AppNavigator';
import ToastContainer from './components/ToastContainer';
import { Colors } from './constants/theme';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AdminProvider>
          <AppNavigator />
          <ToastContainer />
          <StatusBar style="dark" backgroundColor={Colors.background} />
        </AdminProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
