import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  type?: 'error' | 'warning' | 'info';
  dismissible?: boolean;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  onRetry,
  onDismiss,
  type = 'error',
  dismissible = true,
}) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'warning':
        return {
          backgroundColor: '#FFF3E0',
          borderColor: Colors.warning,
          iconColor: Colors.warning,
        };
      case 'info':
        return {
          backgroundColor: '#E3F2FD',
          borderColor: Colors.info,
          iconColor: Colors.info,
        };
      default:
        return {
          backgroundColor: '#FFEBEE',
          borderColor: Colors.error,
          iconColor: Colors.error,
        };
    }
  };

  const typeStyles = getTypeStyles();

  return (
    <View style={[styles.container, { backgroundColor: typeStyles.backgroundColor, borderColor: typeStyles.borderColor }]}>
      <View style={styles.content}>
        <Ionicons 
          name={type === 'warning' ? 'warning' : type === 'info' ? 'information-circle' : 'alert-circle'} 
          size={20} 
          color={typeStyles.iconColor} 
        />
        <Text style={[styles.message, { color: Colors.text }]}>{message}</Text>
      </View>
      
      <View style={styles.actions}>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
            <Ionicons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
        
        {dismissible && onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
            <Ionicons name="close" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    margin: Spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  message: {
    ...Typography.body2,
    flex: 1,
    marginLeft: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    marginRight: Spacing.sm,
  },
  retryText: {
    ...Typography.caption,
    color: Colors.primary,
    marginLeft: Spacing.xs,
    fontWeight: '600',
  },
  dismissButton: {
    padding: Spacing.xs,
  },
});

export default ErrorMessage; 