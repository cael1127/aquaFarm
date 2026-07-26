import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../constants/theme';

interface LoadingSpinnerProps {
  visible: boolean;
  message?: string;
  size?: 'small' | 'large';
  color?: string;
  overlay?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  visible,
  message = 'Loading...',
  size = 'large',
  color = Colors.primary,
  overlay = false,
}) => {
  if (!visible) return null;

  const containerStyle = overlay ? styles.overlay : styles.container;

  return (
    <View style={containerStyle}>
      <View style={styles.spinnerContainer}>
        <ActivityIndicator size={size} color={color} />
        {message && <Text style={styles.message}>{message}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  spinnerContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  message: {
    ...Typography.body1,
    color: Colors.text,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});

export default LoadingSpinner; 