// User and Authentication Types
export interface User {
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

// Batch Management Types
export interface Batch {
  id: string;
  species: string;
  location: string;
  quantity: number;
  startDate: string;
  status: 'active' | 'pending' | 'harvested' | 'cancelled';
  notes?: string;
  farmId: string;
  createdAt: string;
  updatedAt: string;
}

// Harvest Tracking Types
export interface Harvest {
  id: string;
  batchId: string;
  quantity: number;
  quality: 'A' | 'B' | 'C' | 'D';
  harvestDate: string;
  revenue: number;
  notes?: string;
  farmId: string;
  createdAt: string;
}

// Farm Map Types
export interface CageSpot {
  id: string;
  x: number;
  y: number;
  type: 'oyster' | 'mussel' | 'salmon';
  status: 'active' | 'inactive' | 'maintenance';
  batchId?: string;
  notes?: string;
  farmId: string;
}

// Analytics Types
export interface AnalyticsData {
  totalProduction: number;
  activeBatches: number;
  waterQuality: number;
  revenue: number;
  growthRate: number;
  mortalityRate: number;
  harvestEfficiency: number;
}

// Inventory Types
export interface InventoryItem {
  id: string;
  name: string;
  category: 'equipment' | 'supplies' | 'feed' | 'other';
  quantity: number;
  unit: string;
  minThreshold: number;
  cost: number;
  supplier?: string;
  lastUpdated: string;
  farmId: string;
}

// Settings Types
export interface FarmSettings {
  farmName: string;
  location: string;
  waterQuality: {
    temperature: number;
    salinity: number;
    oxygen: number;
    ph: number;
  };
  notifications: {
    enabled: boolean;
    lowStock: boolean;
    waterQuality: boolean;
    harvestReminders: boolean;
  };
  autoBackup: boolean;
  farmId: string;
}

// Chatbot Types
export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  type: 'text' | 'quick_action' | 'error';
}

export interface QuickAction {
  id: string;
  title: string;
  icon: string;
  action: string;
}

// Navigation Types
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type BottomTabParamList = {
  Dashboard: undefined;
  FarmMap: undefined;
  BatchManagement: undefined;
  HarvestTracking: undefined;
  Chatbot: undefined;
  Analytics: undefined;
  Inventory: undefined;
  Reports: undefined;
  Settings: undefined;
};

// API Response Types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: string;
  timestamp: Date;
  userId?: string;
}

// Loading States
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  retryCount: number;
}

// Form Types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'password' | 'select' | 'date';
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean;
  };
  options?: Array<{ label: string; value: any }>;
}

// Theme Types
export interface ThemeColors {
  primary: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  white: string;
  text: string;
  textSecondary: string;
  error: string;
  success: string;
  warning: string;
  info: string;
}

// Chart Data Types
export interface ChartData {
  labels: string[];
  datasets: Array<{
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }>;
}

// Notification Types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
  read: boolean;
  action?: {
    type: string;
    data: any;
  };
} 