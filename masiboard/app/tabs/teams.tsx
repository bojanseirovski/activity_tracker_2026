import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import ModalMessage from '../../components/common/ModalMessage';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

interface ActivityType { id: number; name: string; }
interface Team {
  id: number;
  title: string;
  activity_type_name: string | null;
  activity_type_id: number | null;
  created_by: number;
  member_count: number;
}
type ModalState = { isOpen: boolean; message: string; type: 'success' | 'error' | 'confirm'; onConfirm?: () => void } | null;

export default function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', activity_type_id: '' as number | '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: '', activity_type_id: '' as number | '' });
  const [modal, setModal] = useState<ModalState>(null);

  const fetchTeams = async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get(API.TEAMS, { params: q ? { q } : {} });
      setTeams(data);
    } catch {
      setError(MESSAGES.TEAMS_LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
    apiClient.get(API.ACTIVITY_TYPES).then(r => setActivityTypes(r.data)).catch(() => {});
  }, []);

  const handleCreate = async () => {
    try {
      const { data } = await apiClient.post(API.TEAMS, {
        ...createForm,
        activity_type_id: createForm.activity_type_id || null,
      });
      setTeams([data, ...teams]);
      setCreateForm({ title: '', activity_type_id: '' });
      setShowCreateForm(false);
      setModal({ isOpen: true, message: MESSAGES.TEAM_CREATE_SUCCESS, type: 'success' });
    } catch {
      setModal({ isOpen: true, message: MESSAGES.TEAM_CREATE_ERROR, type: 'error' });
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await apiClient.put(API.TEAM(id), { ...editForm, activity_type_id: editForm.activity_type_id || null });
      setTeams(teams.map(t => t.id === id
        ? { ...t, title: editForm.title as string, activity_type_id: editForm.activity_type_id as number | null }
        : t
      ));
      setEditingId(null);
      setModal({ isOpen: true, message: MESSAGES.TEAM_UPDATE_SUCCESS, type: 'success' });
    } catch {
      setModal({ isOpen: true, message: MESSAGES.TEAM_UPDATE_ERROR, type: 'error' });
    }
  };

  const handleDelete = (id: number) => {
    setModal({
      isOpen: true,
      message: MESSAGES.TEAM_DELETE_CONFIRM,
      type: 'confirm',
      onConfirm: async () => {
        try {
          await apiClient.delete(API.TEAM(id));
          setTeams(prev => prev.filter(t => t.id !== id));
          setModal({ isOpen: true, message: MESSAGES.TEAM_DELETE_SUCCESS, type: 'success' });
        } catch {
          setModal({ isOpen: true, message: MESSAGES.TEAM_DELETE_ERROR, type: 'error' });
        }
      }
    });
  };

  const renderTeam = ({ item: t }: { item: Team }) => (
    <View className="bg-white rounded-xl shadow-sm p-4 mb-3 mx-4">
      {editingId === t.id ? (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-800">Edit Team</Text>
            <Pressable onPress={() => setEditingId(null)}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </Pressable>
          </View>
          <TextInput
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            value={editForm.title}
            onChangeText={v => setEditForm({ ...editForm, title: v })}
            placeholder="Team name"
          />
          <View className="border border-gray-300 rounded-lg overflow-hidden">
            <Picker
              selectedValue={editForm.activity_type_id}
              onValueChange={v => setEditForm({ ...editForm, activity_type_id: v })}
            >
              <Picker.Item label="Any activity type" value="" />
              {activityTypes.map(at => <Picker.Item key={at.id} label={at.name} value={at.id} />)}
            </Picker>
          </View>
          <View className="flex-row gap-2">
            <Pressable onPress={() => handleUpdate(t.id)} className="flex-1 bg-green-500 py-2 rounded-lg items-center">
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
            <Text className="text-base font-semibold text-gray-800">{t.title}</Text>
            <View className="flex-row flex-wrap items-center gap-2 mt-1">
              {t.activity_type_name && (
                <View className="px-2 py-0.5 rounded-full bg-blue-100">
                  <Text className="text-xs font-medium text-blue-800">{t.activity_type_name}</Text>
                </View>
              )}
              <Text className="text-xs text-gray-500">{t.member_count} member{Number(t.member_count) !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2 ml-3">
            <Link href={`/teams/${t.id}`} asChild>
              <Pressable className="bg-indigo-50 px-3 py-1.5 rounded-md">
                <Text className="text-sm font-medium text-indigo-700">View</Text>
              </Pressable>
            </Link>
            {user && user.id === t.created_by && (
              <>
                <Pressable onPress={() => { setEditingId(t.id); setEditForm({ title: t.title, activity_type_id: t.activity_type_id ?? '' }); }}>
                  <Ionicons name="pencil" size={18} color="#3b82f6" />
                </Pressable>
                <Pressable onPress={() => handleDelete(t.id)}>
                  <Ionicons name="trash" size={18} color="#ef4444" />
                </Pressable>
              </>
            )}
          </View>
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
        data={teams}
        keyExtractor={item => String(item.id)}
        renderItem={renderTeam}
        ListHeaderComponent={
          <View className="px-4 pt-6 pb-2">
            <Text className="text-3xl font-bold text-gray-800 text-center mb-1">Teams</Text>
            <Text className="text-gray-500 text-center mb-5">Join permanent groups</Text>

            <View className="flex-row gap-2 mb-4">
              <TextInput
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search teams..."
              />
              <Pressable
                onPress={() => fetchTeams(searchQuery || undefined)}
                className="bg-blue-500 px-4 py-2 rounded-lg items-center justify-center"
              >
                <Text className="text-white font-medium">Search</Text>
              </Pressable>
              {searchQuery ? (
                <Pressable
                  onPress={() => { setSearchQuery(''); fetchTeams(); }}
                  className="bg-gray-200 px-3 py-2 rounded-lg items-center justify-center"
                >
                  <Ionicons name="close" size={18} color="#374151" />
                </Pressable>
              ) : null}
            </View>

            <View className="bg-white rounded-xl shadow-sm mb-4 overflow-hidden">
              <Pressable
                onPress={() => setShowCreateForm(v => !v)}
                className="flex-row items-center justify-between px-5 py-4"
              >
                <Text className="text-base font-semibold text-gray-800">Create Team</Text>
                <Ionicons name={showCreateForm ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
              </Pressable>
              {showCreateForm && (
                <View className="px-5 pb-5 gap-3">
                  <TextInput
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={createForm.title}
                    onChangeText={v => setCreateForm({ ...createForm, title: v })}
                    placeholder="e.g. The Running Crew"
                  />
                  <View className="border border-gray-300 rounded-lg overflow-hidden">
                    <Picker
                      selectedValue={createForm.activity_type_id}
                      onValueChange={v => setCreateForm({ ...createForm, activity_type_id: v })}
                    >
                      <Picker.Item label="Any activity type" value="" />
                      {activityTypes.map(t => <Picker.Item key={t.id} label={t.name} value={t.id} />)}
                    </Picker>
                  </View>
                  <Pressable
                    onPress={handleCreate}
                    className="py-2 px-5 rounded-lg items-center self-start"
                    style={{ backgroundColor: '#3b82f6' }}
                  >
                    <Text className="text-white font-semibold">Create</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {loading && <ActivityIndicator color="#3b82f6" className="my-8" />}
            {error && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex-row items-center justify-between">
                <Text className="text-red-700 flex-1">{error}</Text>
                <Pressable onPress={() => fetchTeams()}>
                  <Text className="text-red-600 underline ml-3">Retry</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View className="bg-white rounded-xl shadow-sm p-10 mx-4 items-center">
              <Text className="text-gray-500">No teams found. Create one above!</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
