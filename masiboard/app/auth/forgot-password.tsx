import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ModalMessage from '../../components/common/ModalMessage';
import apiClient from '../../api/client';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await apiClient.post(API.FORGOT_PASSWORD, { email });
      setSent(true);
    } catch {
      setModal({ isOpen: true, message: MESSAGES.FORGOT_PASSWORD_ERROR });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="bg-gray-50 flex-1" contentContainerStyle={{ paddingVertical: 48 }}>
      <ModalMessage
        isOpen={modal?.isOpen || false}
        message={modal?.message || ''}
        type="error"
        onClose={() => setModal(null)}
      />

      <View className="px-4 max-w-md w-full self-center">
        <View className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <View className="p-6 items-center" style={{ backgroundColor: '#3b82f6' }}>
            <Text className="text-2xl font-bold text-white">Forgot Password</Text>
            <Text className="text-blue-100 mt-1">We'll send you a reset link</Text>
          </View>

          <View className="p-6">
            {sent ? (
              <View className="items-center py-6">
                <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
                  <Ionicons name="mail" size={32} color="#16a34a" />
                </View>
                <Text className="text-gray-700 font-medium text-center">{MESSAGES.FORGOT_PASSWORD_SUCCESS}</Text>
              </View>
            ) : (
              <View className="gap-6">
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

                <View className="pt-2">
                  <Pressable
                    onPress={handleSubmit}
                    disabled={loading}
                    className={`w-full py-3 px-4 rounded-lg items-center ${loading ? 'opacity-75' : ''}`}
                    style={{ backgroundColor: '#3b82f6' }}
                  >
                    <Text className="text-white font-semibold">{loading ? 'Sending...' : 'Send Reset Link'}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          <View className="px-6 py-4 bg-gray-50 items-center">
            <Text className="text-sm text-gray-600">
              Remember your password?{' '}
              <Link href="/auth/login" className="font-medium text-blue-600">Sign in</Link>
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default ForgotPasswordPage;
