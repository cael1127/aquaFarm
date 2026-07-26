export const Colors = {
  primary: '#2E7D32',
  primaryDark: '#1B5E20',
  secondary: '#00ACC1',
  accent: '#FF7043',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  error: '#F44336',
  success: '#4CAF50',
  warning: '#FF9800',
  info: '#2196F3',
};

import { Dimensions, Platform } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;
const isIPhone = Platform.OS === 'ios';

export const Spacing = {
  xs: 4,
  sm: isSmallScreen ? 6 : 8,
  md: isSmallScreen ? 12 : 16,
  lg: isSmallScreen ? 18 : 24,
  xl: isSmallScreen ? 24 : 32,
  xxl: isSmallScreen ? 36 : 48,
  safeTop: isIPhone ? 44 : 0,
  safeBottom: isIPhone ? 34 : 0,
};

export const Typography = {
  h1: {
    fontSize: isSmallScreen ? 28 : 32,
    fontWeight: 'bold' as const,
    lineHeight: isSmallScreen ? 36 : 40,
  },
  h2: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: 'bold' as const,
    lineHeight: isSmallScreen ? 28 : 32,
  },
  h3: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '600' as const,
    lineHeight: isSmallScreen ? 24 : 28,
  },
  body1: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: 'normal' as const,
    lineHeight: isSmallScreen ? 20 : 24,
  },
  body2: {
    fontSize: isSmallScreen ? 12 : 14,
    fontWeight: 'normal' as const,
    lineHeight: isSmallScreen ? 18 : 20,
  },
  caption: {
    fontSize: isSmallScreen ? 10 : 12,
    fontWeight: 'normal' as const,
    lineHeight: isSmallScreen ? 14 : 16,
  },
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 50,
};
