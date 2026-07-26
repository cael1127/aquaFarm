import React from 'react';
import { View, StyleSheet } from 'react-native';
import Toast from './Toast';
import { useToast } from '../utils/useToast';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <View style={styles.container}>
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          visible={true}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
});

export default ToastContainer; 