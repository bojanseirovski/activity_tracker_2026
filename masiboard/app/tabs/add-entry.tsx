import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import ModalMessage from '../../components/common/ModalMessage';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

interface ActivityType { id: number; name: string; }
interface ChallengeOption { id: number; title: string; activity_type_id: number | null; }
interface TeamOption { id: number; title: string; activity_type_id: number | null; }

export default function AddEntryPage() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const [points, setPoints] = useState('0');
  const [date, setDate] = useState(today);
  const [activityTypeId, setActivityTypeId] = useState<number | ''>('');
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [allChallenges, setAllChallenges] = useState<ChallengeOption[]>([]);
  const [allTeams, setAllTeams] = useState<TeamOption[]>([]);
  const [selectedChallengeIds, setSelectedChallengeIds] = useState<number[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [modal, setModal] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    apiClient.get(API.ACTIVITY_TYPES, { params: { userId: user?.id } })
      .then(res => setActivityTypes(res.data))
      .catch(() => setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_LOAD_ERROR, type: 'error' }));
    apiClient.get(API.CHALLENGES).then(res => setAllChallenges(res.data)).catch(() => {});
    apiClient.get(API.TEAMS).then(res => setAllTeams(res.data)).catch(() => {});
  }, [user?.id]);

  const actTypeId = activityTypeId ? Number(activityTypeId) : null;
  const filteredChallenges = actTypeId
    ? allChallenges.filter(c => c.activity_type_id === actTypeId || c.activity_type_id === null)
    : allChallenges;
  const filteredTeams = actTypeId
    ? allTeams.filter(t => t.activity_type_id === actTypeId || t.activity_type_id === null)
    : allTeams;

  const toggleChallenge = (id: number) =>
    setSelectedChallengeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleTeam = (id: number) =>
    setSelectedTeamIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSubmit = async () => {
    try {
      await apiClient.post(API.ENTRIES, {
        name: user?.username,
        points: Number(points),
        date,
        activity_type_id: activityTypeId || null,
        challenge_ids: selectedChallengeIds,
        team_ids: selectedTeamIds,
      });
      setModal({ isOpen: true, message: MESSAGES.ENTRY_ADD_SUCCESS, type: 'success' });
      setPoints('0');
      setDate(today);
      setActivityTypeId('');
      setSelectedChallengeIds([]);
      setSelectedTeamIds([]);
    } catch {
      setModal({ isOpen: true, message: MESSAGES.ENTRY_ADD_ERROR, type: 'error' });
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingVertical: 32 }}>
      <ModalMessage
        isOpen={modal?.isOpen || false}
        message={modal?.message || ''}
        type={modal?.type || 'success'}
        onClose={() => setModal(null)}
      />

      <View className="px-4 max-w-md w-full self-center">
        <View className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <View className="p-6 items-center" style={{ backgroundColor: '#3b82f6' }}>
            <Text className="text-2xl font-bold text-white">Add New Entry</Text>
            <Text className="text-blue-100 mt-1">Enter participant details</Text>
          </View>

          <View className="p-6 gap-5">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Participant Name</Text>
              <View className="px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
                <Text className="text-gray-500">{user?.username}</Text>
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Activity Type</Text>
              <View className="border border-gray-300 rounded-lg overflow-hidden">
                <Picker
                  selectedValue={activityTypeId}
                  onValueChange={val => setActivityTypeId(val)}
                >
                  <Picker.Item label="Select an activity type" value="" />
                  {activityTypes.map(t => (
                    <Picker.Item key={t.id} label={t.name} value={t.id} />
                  ))}
                </Picker>
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Points</Text>
              <TextInput
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                value={points}
                onChangeText={setPoints}
                keyboardType="numeric"
                placeholder="Enter points"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Date (YYYY-MM-DD)</Text>
              <TextInput
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
              />
            </View>

            {filteredChallenges.length > 0 && (
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-2">Submit to Challenges (optional)</Text>
                {filteredChallenges.map(c => (
                  <Pressable
                    key={c.id}
                    onPress={() => toggleChallenge(c.id)}
                    className="flex-row items-center gap-2 py-2"
                  >
                    <View className={`w-4 h-4 border rounded items-center justify-center ${selectedChallengeIds.includes(c.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                      {selectedChallengeIds.includes(c.id) && <Ionicons name="checkmark" size={10} color="white" />}
                    </View>
                    <Text className="text-sm text-gray-700">{c.title}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {filteredTeams.length > 0 && (
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-2">Submit to Teams (optional)</Text>
                {filteredTeams.map(t => (
                  <Pressable
                    key={t.id}
                    onPress={() => toggleTeam(t.id)}
                    className="flex-row items-center gap-2 py-2"
                  >
                    <View className={`w-4 h-4 border rounded items-center justify-center ${selectedTeamIds.includes(t.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                      {selectedTeamIds.includes(t.id) && <Ionicons name="checkmark" size={10} color="white" />}
                    </View>
                    <Text className="text-sm text-gray-700">{t.title}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View className="pt-2">
              <Pressable
                onPress={handleSubmit}
                className="w-full py-3 px-4 rounded-lg items-center"
                style={{ backgroundColor: '#3b82f6' }}
              >
                <Text className="text-white font-semibold">Add Entry</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
