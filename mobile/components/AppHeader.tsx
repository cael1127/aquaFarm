import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { useAdmin } from '../contexts/AdminContext';

interface AppHeaderProps {
  title?: string;
  showLogout?: boolean;
  onLogout?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ 
  title, 
  showLogout = true, 
  onLogout 
}) => {
  const { currentUser, logout, getCurrentFarmName } = useAdmin();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      logout();
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.titleContainer}>
          <Ionicons name="water" size={24} color={Colors.primary} />
          <Text style={styles.title}>
            {title || getCurrentFarmName()}
          </Text>
        </View>
        
        {showLogout && currentUser && (
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {currentUser && (
        <View style={styles.userInfo}>
          <Text style={styles.userText}>
            Welcome, {currentUser.username}
          </Text>
          <Text style={styles.roleText}>
            {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F5F5F5',
  },
  logoutText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
    fontWeight: '500',
  },
  userInfo: {
    marginTop: Spacing.sm,
  },
  userText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  roleText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

export default AppHeader; 