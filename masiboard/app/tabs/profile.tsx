import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import ModalMessage from '../../components/common/ModalMessage';
import ImageUpload from '../../components/common/ImageUpload';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [unit, setUnit] = useState<'km' | 'mi'>('km');
  const [modal, setModal] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    apiClient.get(API.USER_ME)
      .then(response => {
        setUsername(response.data.username || '');
        setEmail(response.data.email || '');
        setImageUrl(response.data.image_url || null);
        setUnit(response.data.unit === 'mi' ? 'mi' : 'km');
        updateUser(response.data);
      })
      .catch(() => setModal({ isOpen: true, message: MESSAGES.PROFILE_LOAD_ERROR, type: 'error' }));
  }, []);

  const handleSubmit = async () => {
    try {
      const response = await apiClient.post(API.USER_ME, { id: user?.id, username, email, unit });
      updateUser(response.data);
      setModal({ isOpen: true, message: MESSAGES.PROFILE_UPDATE_SUCCESS, type: 'success' });
    } catch {
      setModal({ isOpen: true, message: MESSAGES.PROFILE_UPDATE_ERROR, type: 'error' });
    }
  };

  const handleShare = async () => {
    if (!user?.id) return;
    const url = Linking.createURL(`/users/${user.id}`);
    await Clipboard.setStringAsync(url);
    setModal({ isOpen: true, message: 'Profile link copied to clipboard!', type: 'success' });
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingVertical: 32 }}>
      <ModalMessage
        isOpen={modal?.isOpen || false}
        message={modal?.message || ''}
        type={modal?.type || 'success'}
        onClose={() => setModal(null)}
      />

      <View className="px-4 max-w-md w-full self-center gap-4">
        <View className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <View className="p-6 items-center" style={{ backgroundColor: '#3b82f6' }}>
            {user && (
              <View className="mb-3">
                <ImageUpload
                  entityType="user"
                  entityId={user.id}
                  currentImageUrl={imageUrl}
                  onUploadSuccess={(url) => setImageUrl(url)}
                  circular
                  size={80}
                />
              </View>
            )}
            <View className="flex-row items-center gap-2">
              <Text className="text-2xl font-bold text-white">My Profile</Text>
              <Pressable onPress={handleShare} hitSlop={8}>
                <Ionicons name="share-social-outline" size={20} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>
            <Text className="text-blue-100 mt-1">Update your account details</Text>
          </View>

          <View className="p-6 gap-5">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Name</Text>
              <TextInput
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your name"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
              <View className="px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
                <Text className="text-gray-500">{email}</Text>
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Distance Unit</Text>
              <View className="flex-row border border-gray-300 rounded-lg overflow-hidden">
                <Pressable
                  onPress={() => setUnit('km')}
                  className="flex-1 py-3 items-center"
                  style={{ backgroundColor: unit === 'km' ? '#3b82f6' : 'white' }}
                >
                  <Text className={unit === 'km' ? 'text-white font-semibold' : 'text-gray-700'}>km</Text>
                </Pressable>
                <Pressable
                  onPress={() => setUnit('mi')}
                  className="flex-1 py-3 items-center"
                  style={{ backgroundColor: unit === 'mi' ? '#3b82f6' : 'white' }}
                >
                  <Text className={unit === 'mi' ? 'text-white font-semibold' : 'text-gray-700'}>mi</Text>
                </Pressable>
              </View>
            </View>

            <View className="pt-2">
              <Pressable
                onPress={handleSubmit}
                className="w-full py-3 px-4 rounded-lg items-center"
                style={{ backgroundColor: '#3b82f6' }}
              >
                <Text className="text-white font-semibold">Save Changes</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Quick links */}
        <View className="bg-white rounded-2xl shadow-md overflow-hidden">
          <Link href="/tabs/activity-types" asChild>
            <Pressable className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
              <View className="flex-row items-center gap-3">
                <Ionicons name="list" size={20} color="#6b7280" />
                <Text className="text-gray-800 font-medium">Activity Types</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </Pressable>
          </Link>
          <Link href="/tabs/search" asChild>
            <Pressable className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
              <View className="flex-row items-center gap-3">
                <Ionicons name="search" size={20} color="#6b7280" />
                <Text className="text-gray-800 font-medium">Search Entries</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </Pressable>
          </Link>
          <Pressable onPress={handleLogout} className="flex-row items-center justify-between px-5 py-4">
            <View className="flex-row items-center gap-3">
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text className="text-red-600 font-medium">Logout</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
