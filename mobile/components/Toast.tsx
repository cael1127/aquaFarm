import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

interface ToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onDismiss?: () => void;
}

const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type,
  duration = 3000,
  onDismiss,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      // Slide in and fade in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#E8F5E8',
          borderColor: Colors.success,
          iconColor: Colors.success,
          iconName: 'checkmark-circle',
        };
      case 'warning':
        return {
          backgroundColor: '#FFF3E0',
          borderColor: Colors.warning,
          iconColor: Colors.warning,
          iconName: 'warning',
        };
      case 'info':
        return {
          backgroundColor: '#E3F2FD',
          borderColor: Colors.info,
          iconColor: Colors.info,
          iconName: 'information-circle',
        };
      default:
        return {
          backgroundColor: '#FFEBEE',
          borderColor: Colors.error,
          iconColor: Colors.error,
          iconName: 'alert-circle',
        };
    }
  };

  const typeStyles = getTypeStyles();

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: typeStyles.backgroundColor,
          borderColor: typeStyles.borderColor,
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={typeStyles.iconName as any}
          size={20}
          color={typeStyles.iconColor}
        />
        <Text style={[styles.message, { color: Colors.text }]}>
          {message}
        </Text>
      </View>
      
      <TouchableOpacity onPress={hideToast} style={styles.dismissButton}>
        <Ionicons name="close" size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: Spacing.md,
    right: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  message: {
    ...Typography.body2,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  dismissButton: {
    padding: Spacing.xs,
  },
});

export default Toast; 