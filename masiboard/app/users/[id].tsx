import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ErrorMessage from '../../components/common/ErrorMessage';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';

interface UserProfile {
  username: string;
  total_entries: number;
  position: number;
  last_activity_types: string[];
}
interface UserChallenge { id: number; title: string; start_date: string; end_date: string; activity_type_name: string | null; user_points: number; }
interface UserTeam { id: number; title: string; activity_type_name: string | null; user_points: number; }

export default function UserProfilePage() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [challenges, setChallenges] = useState<UserChallenge[]>([]);
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = () => {
    setLoading(true);
    setError(null);
    const uid = Number(id);
    Promise.all([
      apiClient.get(API.USER_PROFILE(uid)),
      apiClient.get(API.USER_CHALLENGES(uid)),
      apiClient.get(API.USER_TEAMS(uid)),
    ])
      .then(([profileRes, challengesRes, teamsRes]) => {
        setProfile(profileRes.data);
        setChallenges(challengesRes.data);
        setTeams(teamsRes.data);
      })
      .catch(() => setError('Could not load user profile.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProfile(); }, [id]);

  const positionBadge = (pos: number) =>
    pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingVertical: 32, paddingHorizontal: 16 }}>
      {loading && (
        <View className="items-center justify-center h-64 bg-white rounded-2xl shadow-xl">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}

      {error && <ErrorMessage message={error} onReload={fetchProfile} />}

      {!loading && !error && profile && (
        <View className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <View className="p-6 items-center" style={{ backgroundColor: '#3b82f6' }}>
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <Text className="text-2xl font-bold text-white">
                {profile.username.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text className="text-2xl font-bold text-white">{profile.username}</Text>
            <Text className="text-blue-100 mt-1">
              {positionBadge(profile.position)} Leaderboard Position
            </Text>
          </View>

          <View className="p-6 gap-6">
            <View className="flex-row gap-4">
              <View className="flex-1 bg-gray-50 rounded-xl p-4 items-center">
                <Text className="text-3xl font-bold text-gray-800">{profile.total_entries}</Text>
                <Text className="text-sm text-gray-500 mt-1">Total Entries</Text>
              </View>
              <View className="flex-1 bg-gray-50 rounded-xl p-4 items-center">
                <Text className="text-3xl font-bold text-gray-800">#{profile.position}</Text>
                <Text className="text-sm text-gray-500 mt-1">Rank</Text>
              </View>
            </View>

            {profile.last_activity_types.length > 0 && (
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-3">Recent Activities</Text>
                <View className="flex-row flex-wrap gap-2">
                  {profile.last_activity_types.map((type, i) => (
                    <View key={i} className="px-3 py-1 rounded-full bg-blue-100">
                      <Text className="text-sm font-medium text-blue-800">{type}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {challenges.length > 0 && (
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-3">Challenges</Text>
                <View className="gap-2">
                  {challenges.map(c => (
                    <Link key={c.id} href={`/challenges/${c.id}`} asChild>
                      <Pressable className="flex-row items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-gray-800">{c.title}</Text>
                          <View className="flex-row flex-wrap items-center gap-2 mt-0.5">
                            {c.activity_type_name && (
                              <View className="px-2 py-0.5 rounded-full bg-blue-100">
                                <Text className="text-xs text-blue-800">{c.activity_type_name}</Text>
                              </View>
                            )}
                            <Text className="text-xs text-gray-400">{c.start_date} – {c.end_date}</Text>
                          </View>
                        </View>
                        <Text className="text-sm font-bold text-blue-600 ml-3">{c.user_points} pts</Text>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              </View>
            )}

            {teams.length > 0 && (
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-3">Teams</Text>
                <View className="gap-2">
                  {teams.map(t => (
                    <Link key={t.id} href={`/teams/${t.id}`} asChild>
                      <Pressable className="flex-row items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-gray-800">{t.title}</Text>
                          {t.activity_type_name && (
                            <View className="px-2 py-0.5 rounded-full bg-indigo-100 self-start mt-0.5">
                              <Text className="text-xs text-indigo-800">{t.activity_type_name}</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-sm font-bold text-blue-600 ml-3">{t.user_points} pts</Text>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      <View className="mt-5 items-center">
        {user ? (
          <Link href='/tabs' asChild>
            <Pressable className="flex-row items-center gap-1">
              <Ionicons name="arrow-back" size={16} color="#3b82f6" />
              <Text className="text-blue-600 font-medium">Back to Leaderboard</Text>
            </Pressable>
          </Link>
        ) : (
          <Link href="/auth/login" asChild>
            <Pressable className="flex-row items-center gap-1">
              <Ionicons name="log-in-outline" size={16} color="#3b82f6" />
              <Text className="text-blue-600 font-medium">Login</Text>
            </Pressable>
          </Link>
        )}
      </View>
    </ScrollView>
  );
}
