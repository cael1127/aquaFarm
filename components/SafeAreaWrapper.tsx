import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  backgroundColor?: string;
}

const SafeAreaWrapper: React.FC<SafeAreaWrapperProps> = ({ 
  children, 
  backgroundColor = Colors.background 
}) => {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SafeAreaWrapper;
