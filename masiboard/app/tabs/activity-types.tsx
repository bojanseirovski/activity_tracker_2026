import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ModalMessage from '../../components/common/ModalMessage';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

interface ActivityType {
  id: number;
  name: string;
  description?: string;
  userId: number;
}
type ModalState = { isOpen: boolean; message: string; type: 'success' | 'error' | 'confirm'; onConfirm?: () => void } | null;

export default function ActivityTypesPage() {
  const { user } = useAuth();
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [modal, setModal] = useState<ModalState>(null);

  const fetchTypes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get(API.ACTIVITY_TYPES, { params: { userId: user?.id } });
      setTypes(data);
    } catch {
      setError(MESSAGES.ACTIVITY_TYPES_LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTypes(); }, []);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    try {
      const { data } = await apiClient.post(API.ACTIVITY_TYPES, { name: createName, userId: user?.id });
      setTypes([...types, data]);
      setCreateName('');
      setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_CREATE_SUCCESS, type: 'success' });
    } catch {
      setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_CREATE_ERROR, type: 'error' });
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      const { data: updated } = await apiClient.put(API.ACTIVITY_TYPE(id), { name: editName, userId: user?.id });
      setTypes(types.map(t => t.id === id ? { ...t, ...updated } : t));
      setEditingId(null);
      setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_UPDATE_SUCCESS, type: 'success' });
    } catch {
      setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_UPDATE_ERROR, type: 'error' });
    }
  };

  const handleDelete = (id: number) => {
    setModal({
      isOpen: true,
      message: MESSAGES.ACTIVITY_TYPE_DELETE_CONFIRM,
      type: 'confirm',
      onConfirm: async () => {
        try {
          await apiClient.delete(API.ACTIVITY_TYPE(id), { params: { userId: user?.id } });
          setTypes(prev => prev.filter(t => t.id !== id));
          setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_DELETE_SUCCESS, type: 'success' });
        } catch {
          setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_DELETE_ERROR, type: 'error' });
        }
      }
    });
  };

  const renderType = ({ item: type }: { item: ActivityType }) => (
    <View className="bg-white rounded-xl shadow-sm p-4 mb-3 mx-4">
      {editingId === type.id ? (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-800">Edit Activity Type</Text>
            <Pressable onPress={() => setEditingId(null)}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </Pressable>
          </View>
          <TextInput
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            value={editName}
            onChangeText={setEditName}
            placeholder="Name"
          />
          <View className="flex-row gap-2">
            <Pressable onPress={() => handleUpdate(type.id)} className="flex-1 bg-green-500 py-2 rounded-lg items-center">
              <Text className="text-white font-medium">Save</Text>
            </Pressable>
            <Pressable onPress={() => setEditingId(null)} className="flex-1 bg-gray-200 py-2 rounded-lg items-center">
              <Text className="text-gray-700">Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-800">{type.name}</Text>
            {type.description && <Text className="text-sm text-gray-500 mt-0.5">{type.description}</Text>}
          </View>
          {user && user.id === type.userId && (
            <View className="flex-row gap-3 ml-3">
              <Pressable onPress={() => { setEditingId(type.id); setEditName(type.name); }}>
                <Ionicons name="pencil" size={18} color="#3b82f6" />
              </Pressable>
              <Pressable onPress={() => handleDelete(type.id)}>
                <Ionicons name="trash" size={18} color="#ef4444" />
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <ModalMessage
        isOpen={modal?.isOpen || false}
        message={modal?.message || ''}
        type={modal?.type || 'success'}
        onClose={() => setModal(null)}
        onConfirm={modal?.onConfirm}
      />

      <FlatList
        data={types}
        keyExtractor={item => String(item.id)}
        renderItem={renderType}
        ListHeaderComponent={
          <View className="px-4 pt-6 pb-2">
            <Text className="text-3xl font-bold text-gray-800 text-center mb-1">Activity Types</Text>
            <Text className="text-gray-500 text-center mb-6">Manage your activity categories</Text>

            <View className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <Text className="text-base font-semibold text-gray-800 mb-3">Add New Activity Type</Text>
              <TextInput
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
                value={createName}
                onChangeText={setCreateName}
                placeholder="e.g. Running, Cycling..."
              />
              <Pressable
                onPress={handleCreate}
                className="py-2 px-5 rounded-lg items-center self-start"
                style={{ backgroundColor: '#3b82f6' }}
              >
                <Text className="text-white font-semibold">Create</Text>
              </Pressable>
            </View>

            {loading && <ActivityIndicator color="#3b82f6" className="my-6" />}
            {error && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex-row items-center justify-between">
                <Text className="text-red-700 flex-1">{error}</Text>
                <Pressable onPress={fetchTypes}>
                  <Text className="text-red-600 underline ml-3">Retry</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View className="bg-white rounded-xl shadow-sm p-10 mx-4 items-center">
              <Text className="text-gray-500">No activity types yet. Create one above!</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
