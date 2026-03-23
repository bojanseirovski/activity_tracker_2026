import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ModalMessage from '../../components/common/ModalMessage';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

const REMEMBER_ME_KEY = 'rememberedEmail';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  useEffect(() => {
    AsyncStorage.getItem(REMEMBER_ME_KEY).then((saved) => {
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    });
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.post(API.LOGIN, { email, password });

      if (data.token) await AsyncStorage.setItem('authToken', data.token);

      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_ME_KEY, email);
      } else {
        await AsyncStorage.removeItem(REMEMBER_ME_KEY);
      }

      try {
        const { data: fullUser } = await apiClient.get(API.USER_ME);
        login(fullUser);
      } catch {
        login(data);
      }

      setTimeout(() => router.replace('/tabs'), 1500);
    } catch (error: any) {
      const message = error.response?.data?.message || MESSAGES.LOGIN_ERROR;
      setModal({ isOpen: true, message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="bg-gray-50 flex-1" contentContainerStyle={{ paddingVertical: 48 }}>
      <ModalMessage
        isOpen={modal?.isOpen || false}
        message={modal?.message || ''}
        type={modal?.type || 'success'}
        onClose={() => setModal(null)}
      />

      <View className="px-4 max-w-md w-full self-center">
        <View className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <View className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 items-center" style={{ backgroundColor: '#3b82f6' }}>
            <Text className="text-2xl font-bold text-white">Welcome Back</Text>
            <Text className="text-blue-100 mt-1">Sign in to your account</Text>
          </View>

          <View className="p-6 gap-6">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Email Address</Text>
              <TextInput
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
              <View className="relative flex-row items-center">
                <TextInput
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg pr-11"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  onPress={() => setShowPassword(v => !v)}
                  className="absolute right-3"
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
                </Pressable>
              </View>
            </View>

            <View className="flex-row items-center justify-between">
              <Pressable
                className="flex-row items-center"
                onPress={() => setRememberMe(v => !v)}
              >
                <View className={`w-4 h-4 border rounded mr-2 items-center justify-center ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {rememberMe && <Ionicons name="checkmark" size={10} color="white" />}
                </View>
                <Text className="text-sm text-gray-700">Remember me</Text>
              </Pressable>

              <Link href="/auth/forgot-password" className="text-sm font-medium text-blue-600">
                Forgot password?
              </Link>
            </View>

            <View className="pt-4">
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg items-center ${loading ? 'opacity-75' : ''}`}
                style={{ backgroundColor: '#3b82f6' }}
              >
                <Text className="text-white font-semibold">{loading ? 'Signing in...' : 'Sign In'}</Text>
              </Pressable>
            </View>
          </View>

          <View className="px-6 py-4 bg-gray-50 items-center">
            <Text className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link href="/auth/register" className="font-medium text-blue-600">Sign up</Link>
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default Login;
