import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useAdmin } from '../contexts/AdminContext';
import { Validator } from '../utils/validation';
import { errorHandler } from '../utils/errorHandler';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;
const isIPhone = Platform.OS === 'ios';

interface LoginScreenProps {
  navigation: any;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { login } = useAdmin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: { username?: string; password?: string } = {};
    
    // Validate username
    const usernameValidation = Validator.validateRequired(username, 'Username');
    if (!usernameValidation.isValid) {
      newErrors.username = usernameValidation.errors[0];
    }
    
    // Validate password
    const passwordValidation = Validator.validateRequired(password, 'Password');
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.errors[0];
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    setGeneralError(null);
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        // Login successful - navigation will happen automatically via AppNavigator
        // No need to navigate manually since the AppNavigator will detect currentUser
      } else {
        setGeneralError(result.error || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setGeneralError('Login failed. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: 'username' | 'password', value: string) => {
    if (field === 'username') {
      setUsername(value);
    } else {
      setPassword(value);
    }
    
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.container}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="water" size={60} color={Colors.surface} />
            </View>
            <Text style={styles.logoText}>AquaFarm Manager</Text>
            <Text style={styles.tagline}>Smart Aquaculture Management</Text>
          </View>

          {generalError && (
            <ErrorMessage
              message={generalError}
              onDismiss={() => setGeneralError(null)}
              type="error"
            />
          )}

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={Colors.textSecondary} />
              <TextInput
                style={[styles.input, errors.username && styles.inputError]}
                placeholder="Username"
                placeholderTextColor={Colors.textSecondary}
                value={username}
                onChangeText={(value) => handleInputChange('username', value)}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {errors.username && (
              <Text style={styles.errorText}>{errors.username}</Text>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <LoadingSpinner visible={true} size="small" color={Colors.surface} />
                  <Text style={styles.loginButtonText}>Signing In...</Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.demoCredentials}>
              <Text style={styles.demoTitle}>Available Farms:</Text>
              <Text style={styles.demoText}>threesisters / admin123 (Three Sisters Oyster Farm)</Text>
              <Text style={styles.demoText}>coopfarm / admin123 (Pacific Coop Oyster Farm)</Text>
              <Text style={styles.demoText}>bluewaters / admin123 (Blue Waters Oyster Co.)</Text>
              <Text style={styles.demoText}>coastalaqua / admin123 (Coastal Oyster Farm)</Text>
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: isSmallScreen ? Spacing.md : Spacing.lg,
    paddingTop: isIPhone ? 60 : Spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoCircle: {
    width: isSmallScreen ? 100 : 120,
    height: isSmallScreen ? 100 : 120,
    borderRadius: isSmallScreen ? 50 : 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isSmallScreen ? Spacing.md : Spacing.lg,
  },
  logoText: {
    ...Typography.h1,
    color: Colors.surface,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  tagline: {
    ...Typography.body1,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    height: 50,
    marginLeft: Spacing.sm,
    ...Typography.body1,
    color: Colors.text,
  },
  eyeIcon: {
    padding: Spacing.sm,
  },
  loginButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  loginButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  loginButtonText: {
    ...Typography.h3,
    color: Colors.surface,
  },
  demoCredentials: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: '#F5F5F5',
    borderRadius: BorderRadius.md,
  },
  demoTitle: {
    ...Typography.body1,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  demoText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LoginScreen;
