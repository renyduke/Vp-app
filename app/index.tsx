// LoginScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../src/supabaseClient';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationKey, setRegistrationKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const REGISTRATION_KEY = 'AGRI2024';

  // Clear inputs when toggling between login/register
  const handleToggleMode = () => {
    setIsRegistering(!isRegistering);
    setUsername('');
    setPassword('');
    setRegistrationKey('');
    setShowPassword(false);
  };

  // Handle Login
  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Missing Fields', 'Please enter both username and password');
      return;
    }

    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const trimmedUsername = username.trim();
      const trimmedPassword = password.trim();
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', trimmedUsername)
        .eq('password', trimmedPassword)
        .maybeSingle();

      if (error) {
        console.error('Login error:', error);
        Alert.alert('Error', 'An error occurred during login');
        setIsLoading(false);
        return;
      }

      if (!data) {
        Alert.alert('Login Failed', 'Invalid username or password');
        setIsLoading(false);
        return;
      }

      // Save user info to AsyncStorage
      await AsyncStorage.setItem('currentUser', JSON.stringify({
        id: data.id,
        username: data.username
      }));

      // Success - route to data page
      setIsLoading(false);
      router.replace('/data');
      
    } catch (err) {
      console.error('Login catch error:', err);
      Alert.alert('Error', 'An error occurred during login');
      setIsLoading(false);
    }
  };

  // Handle Registration
  const handleRegister = async () => {
    if (!username || !password) {
      Alert.alert('Missing Fields', 'Please enter both username and password');
      return;
    }

    if (registrationKey.trim() !== REGISTRATION_KEY) {
      Alert.alert('Invalid Key', 'The registration key is incorrect');
      return;
    }

    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const trimmedUsername = username.trim();
      const trimmedPassword = password.trim();
      
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', trimmedUsername)
        .maybeSingle();

      if (existingUser) {
        Alert.alert('Username Taken', 'This username already exists');
        setIsLoading(false);
        return;
      }

      const { error } = await supabase
        .from('users')
        .insert([
          {
            username: trimmedUsername,
            password: trimmedPassword,
            created_at: new Date().toISOString(),
          },
        ]);

      if (error) {
        console.error('Registration error:', error);
        throw error;
      }

      setIsLoading(false);
      Alert.alert(
        '✓ Registration Successful',
        'Your account has been created! You can now log in.',
        [
          {
            text: 'OK',
            onPress: () => {
              setIsRegistering(false);
              setUsername('');
              setPassword('');
              setRegistrationKey('');
              setShowPassword(false);
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Registration catch error:', err);
      Alert.alert('Error', 'Failed to create account: ' + (err.message || 'Unknown error'));
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>
            {isRegistering ? '📝 Create Account' : '🔒 Secure Access'}
          </Text>
          <Text style={styles.subtitle}>
            {isRegistering
              ? 'Register a new account'
              : 'Enter your credentials to continue'}
          </Text>

          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              placeholderTextColor="#aaa"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              secureTextEntry={!showPassword}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#aaa"
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          {isRegistering && (
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color="#666" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Registration Key"
                value={registrationKey}
                onChangeText={setRegistrationKey}
                placeholderTextColor="#aaa"
                autoCapitalize="characters"
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={isRegistering ? handleRegister : handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Processing...' : isRegistering ? 'Register' : 'Login'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={handleToggleMode}
            disabled={isLoading}
          >
            <Text style={styles.toggleText}>
              {isRegistering
                ? 'Already have an account? Login'
                : "Don't have an account? Register"}
            </Text>
          </TouchableOpacity>

          {isRegistering && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color="#2d6a4f" />
              <Text style={styles.infoText}>
                You need a registration key to create an account
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const shadowCommon =
  Platform.OS === 'web'
    ? { boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }
    : { elevation: 6 };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    width: '92%',
    maxWidth: 420,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    ...shadowCommon,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#222',
  },
  button: {
    backgroundColor: '#2d6a4f',
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  toggleText: {
    color: '#2d6a4f',
    fontSize: 14,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    width: '100%',
  },
  infoText: {
    fontSize: 12,
    color: '#166534',
    marginLeft: 8,
    flex: 1,
  },
});