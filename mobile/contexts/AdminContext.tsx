import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

interface User {
  id: string;
  username: string;
  email: string;
  farmName: string;
  farmType: 'oyster' | 'mussel' | 'salmon' | 'mixed';
  location: string;
  role: 'admin' | 'manager' | 'worker';
  permissions: string[];
  createdAt: string;
  lastLogin: string;
}

interface AdminContextType {
  currentUser: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  farms: User[]; // Each user represents a farm
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  addFarm: (farmData: Omit<User, 'id' | 'createdAt' | 'lastLogin'>) => Promise<void>;
  updateFarm: (farmId: string, farmData: Partial<User>) => Promise<void>;
  deleteFarm: (farmId: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  getCurrentFarmName: () => string;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

const defaultUsers: User[] = [
  {
    id: 'farm-1',
    username: 'threesisters',
    email: 'admin@threesistersfarm.com',
    farmName: 'Three Sisters Oyster Farm',
    farmType: 'oyster',
    location: 'Chesapeake Bay, MD',
    role: 'admin',
    permissions: ['*'], // All permissions
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: new Date().toISOString(),
  },
  {
    id: 'farm-2',
    username: 'coopfarm',
    email: 'manager@pacificcoopfarm.com',
    farmName: 'Pacific Coop Oyster Farm',
    farmType: 'oyster',
    location: 'Puget Sound, WA',
    role: 'admin',
    permissions: ['*'],
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: '2024-01-15T10:30:00Z',
  },
  {
    id: 'farm-3',
    username: 'bluewaters',
    email: 'admin@bluewaterssalmon.com',
    farmName: 'Blue Waters Oyster Co.',
    farmType: 'oyster',
    location: 'Bay of Fundy, NS',
    role: 'admin',
    permissions: ['*'],
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: '2024-01-20T08:15:00Z',
  },
  {
    id: 'farm-4',
    username: 'coastalaqua',
    email: 'admin@coastalaquaculture.com',
    farmName: 'Coastal Oyster Farm',
    farmType: 'oyster',
    location: 'Monterey Bay, CA',
    role: 'admin',
    permissions: ['*'],
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: '2024-01-18T14:20:00Z',
  },
];

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>(defaultUsers);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setIsLoading(true);
      const savedCurrentUser = await AsyncStorage.getItem('currentUser');
      const savedUsers = await AsyncStorage.getItem('allUsers');
      
      if (savedCurrentUser) {
        setCurrentUser(JSON.parse(savedCurrentUser));
      }
      
      if (savedUsers) {
        setUsers(JSON.parse(savedUsers));
      } else {
        // Save default users if none exist and set them in state
        setUsers(defaultUsers);
        await AsyncStorage.setItem('allUsers', JSON.stringify(defaultUsers));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Replace AsyncStorage CRUD with Supabase CRUD
  // Example: addFarm, updateFarm, deleteFarm, login, loadUserData

  // Add a new farm to Supabase
  const addFarm = async (farmData: Omit<User, 'id' | 'createdAt' | 'lastLogin'>) => {
    const newFarm = {
      ...farmData,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('farms').insert([newFarm]);
    if (error) throw error;
    // Optionally update local state
  };

  // Update a farm in Supabase
  const updateFarm = async (farmId: string, farmData: Partial<User>) => {
    const { data, error } = await supabase.from('farms').update(farmData).eq('id', farmId);
    if (error) throw error;
    // Optionally update local state
  };

  // Delete a farm in Supabase
  const deleteFarm = async (farmId: string) => {
    const { data, error } = await supabase.from('farms').delete().eq('id', farmId);
    if (error) throw error;
    // Optionally update local state
  };

  // Load all farms from Supabase
  const loadFarms = async () => {
    const { data, error } = await supabase.from('farms').select('*');
    if (error) throw error;
    // setUsers(data) or similar
  };

  // Login: check users table in Supabase with improved error handling
  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Validate input
      if (!username.trim() || !password.trim()) {
        return { success: false, error: 'Username and password are required' };
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username.trim())
        .eq('password', password.trim())
        .single();

      if (error || !data) {
        return { success: false, error: 'Invalid username or password' };
      }

      setCurrentUser(data);
      await AsyncStorage.setItem('currentUser', JSON.stringify(data));
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    await AsyncStorage.removeItem('currentUser');
  };

  const getCurrentFarmName = (): string => {
    return currentUser?.farmName || 'Unknown Farm';
  };

  const hasPermission = (permission: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.permissions.includes('*')) return true; // Admin has all permissions
    return currentUser.permissions.includes(permission);
  };

  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager' || isAdmin;

  return (
    <AdminContext.Provider
      value={{
        currentUser,
        isLoading,
        isAdmin,
        isManager,
        farms: users,
        login,
        logout,
        addFarm,
        updateFarm,
        deleteFarm,
        hasPermission,
        getCurrentFarmName,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};
