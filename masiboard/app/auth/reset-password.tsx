import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ModalMessage from '../../components/common/ModalMessage';
import apiClient from '../../api/client';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

const ResetPasswordPage: React.FC = () => {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setModal({ isOpen: true, message: MESSAGES.RESET_PASSWORD_LENGTH_ERROR, type: 'error' });
      return;
    }
    if (password !== confirmPassword) {
      setModal({ isOpen: true, message: MESSAGES.RESET_PASSWORD_MATCH_ERROR, type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await apiClient.post(API.RESET_PASSWORD, { token, password });
      setModal({ isOpen: true, message: MESSAGES.RESET_PASSWORD_SUCCESS, type: 'success' });
    } catch (error: any) {
      const message = error.response?.data?.message || MESSAGES.RESET_PASSWORD_ERROR;
      setModal({ isOpen: true, message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    if (modal?.type === 'success') {
      router.replace('/auth/login');
    } else {
      setModal(null);
    }
  };

  return (
    <ScrollView className="bg-gray-50 flex-1" contentContainerStyle={{ paddingVertical: 48 }}>
      <ModalMessage
        isOpen={modal?.isOpen || false}
        message={modal?.message || ''}
        type={modal?.type || 'error'}
        onClose={handleModalClose}
      />

      <View className="px-4 max-w-md w-full self-center">
        <View className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <View className="p-6 items-center" style={{ backgroundColor: '#3b82f6' }}>
            <Text className="text-2xl font-bold text-white">Reset Password</Text>
            <Text className="text-blue-100 mt-1">Enter your new password</Text>
          </View>

          <View className="p-6 gap-6">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">New Password</Text>
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
              <Text className="text-sm font-medium text-gray-700 mb-1">Confirm New Password</Text>
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

            <View className="pt-2">
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg items-center ${loading ? 'opacity-75' : ''}`}
                style={{ backgroundColor: '#3b82f6' }}
              >
                <Text className="text-white font-semibold">{loading ? 'Saving...' : 'Reset Password'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default ResetPasswordPage;
