import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ModalMessage from '../../components/common/ModalMessage';
import apiClient from '../../api/client';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async () => {
    if (name.length < 3) {
      setModal({ isOpen: true, message: MESSAGES.REGISTER_NAME_ERROR, type: 'error' });
      return;
    }
    if (!validateEmail(email)) {
      setModal({ isOpen: true, message: MESSAGES.REGISTER_EMAIL_ERROR, type: 'error' });
      return;
    }
    if (password.length < 6) {
      setModal({ isOpen: true, message: MESSAGES.REGISTER_PASSWORD_LENGTH_ERROR, type: 'error' });
      return;
    }
    if (password !== confirmPassword) {
      setModal({ isOpen: true, message: MESSAGES.REGISTER_PASSWORD_MATCH_ERROR, type: 'error' });
      return;
    }
    if (!agreedToTerms) {
      setModal({ isOpen: true, message: 'Please agree to the Terms and Conditions.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await apiClient.post(API.REGISTER, { username: name, email, password });
      setModal({ isOpen: true, message: MESSAGES.REGISTER_SUCCESS, type: 'success' });
      setTimeout(() => router.replace('/auth/login'), 1500);
    } catch (error: any) {
      const message = error.response?.data?.error || MESSAGES.REGISTER_ERROR;
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
          <View className="p-6 items-center" style={{ backgroundColor: '#3b82f6' }}>
            <Text className="text-2xl font-bold text-white">Create Account</Text>
            <Text className="text-blue-100 mt-1">Join us today</Text>
          </View>

          <View className="p-6 gap-6">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Full Name</Text>
              <TextInput
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                value={name}
                onChangeText={setName}
                placeholder="John Doe"
              />
            </View>

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
              <View className="flex-row items-center">
                <TextInput
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg pr-11"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(v => !v)} className="absolute right-3">
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
                </Pressable>
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Confirm Password</Text>
              <View className="flex-row items-center">
                <TextInput
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg pr-11"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showConfirmPassword}
                />
                <Pressable onPress={() => setShowConfirmPassword(v => !v)} className="absolute right-3">
                  <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
                </Pressable>
              </View>
            </View>

            <Pressable
              className="flex-row items-center"
              onPress={() => setAgreedToTerms(v => !v)}
            >
              <View className={`w-4 h-4 border rounded mr-2 items-center justify-center ${agreedToTerms ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                {agreedToTerms && <Ionicons name="checkmark" size={10} color="white" />}
              </View>
              <Text className="text-sm text-gray-700">
                I agree to the{' '}
                <Link href="/terms" className="text-blue-600">Terms and Conditions</Link>
              </Text>
            </Pressable>

            <View className="pt-4">
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg items-center ${loading ? 'opacity-75' : ''}`}
                style={{ backgroundColor: '#3b82f6' }}
              >
                <Text className="text-white font-semibold">{loading ? 'Creating Account...' : 'Create Account'}</Text>
              </Pressable>
            </View>
          </View>

          <View className="px-6 py-4 bg-gray-50 items-center">
            <Text className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/auth/login" className="font-medium text-blue-600">Sign in</Link>
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default Register;
