import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, Link } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import ErrorMessage from '../../components/common/ErrorMessage';
import ModalMessage from '../../components/common/ModalMessage';
import ImageUpload from '../../components/common/ImageUpload';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';
import { formatDistance } from '../../utils/distance';

interface ChallengeDetail {
  id: number;
  title: string;
  activity_type_name: string | null;
  start_date: string;
  end_date: string;
  member_count: number;
  total_points: number;
  is_member: boolean;
  image_url: string | null;
  createdBy: number;
}
interface LeaderboardEntry { id: number; username: string; total_points: number; rank: number; }
interface ChallengeStats { total_distance: number; top_users: LeaderboardEntry[]; }
type ModalState = { isOpen: boolean; message: string; type: 'success' | 'error' } | null;

const rankBadge = (rank: number) =>
  rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

export default function ChallengePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [stats, setStats] = useState<ChallengeStats | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.get(API.CHALLENGE(Number(id))),
      apiClient.get(API.CHALLENGE_LEADERBOARD(Number(id))),
      apiClient.get(API.CHALLENGE_STATS(Number(id))),
    ])
      .then(([cRes, lRes, sRes]) => {
        setChallenge(cRes.data);
        setLeaderboard(lRes.data);
        setStats(sRes.data);
      })
      .catch(() => setError(MESSAGES.CHALLENGE_LOAD_ERROR))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleShare = async () => {
    const url = Linking.createURL(`/challenges/${id}`);
    await Clipboard.setStringAsync(url);
    setModal({ isOpen: true, message: 'Challenge link copied to clipboard!', type: 'success' });
  };

  const handleJoin = async () => {
    if (!challenge) return;
    setJoining(true);
    try {
      await apiClient.post(API.CHALLENGE_JOIN(challenge.id));
      setChallenge(prev => prev ? { ...prev, is_member: true, member_count: Number(prev.member_count) + 1 } : prev);
    } catch {
      setModal({ isOpen: true, message: MESSAGES.CHALLENGE_JOIN_ERROR, type: 'error' });
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!challenge) return;
    setJoining(true);
    try {
      await apiClient.delete(API.CHALLENGE_JOIN(challenge.id));
      setChallenge(prev => prev ? { ...prev, is_member: false, member_count: Math.max(0, Number(prev.member_count) - 1) } : prev);
    } catch {
      setModal({ isOpen: true, message: MESSAGES.CHALLENGE_LEAVE_ERROR, type: 'error' });
    } finally {
      setJoining(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingVertical: 32, paddingHorizontal: 16 }}>
      <ModalMessage
        isOpen={modal?.isOpen || false}
        message={modal?.message || ''}
        type={modal?.type || 'error'}
        onClose={() => setModal(null)}
      />

      {loading && (
        <View className="items-center justify-center h-64 bg-white rounded-2xl shadow-xl">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}
      {error && <ErrorMessage message={error} onReload={fetchData} />}

      {!loading && !error && challenge && (
        <View className="gap-5">
          <View className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <View className="p-6" style={{ backgroundColor: '#3b82f6' }}>
              <View className="flex-row items-center gap-4 mb-2">
                {user && user.id === challenge.createdBy ? (
                  <ImageUpload
                    entityType="challenge"
                    entityId={challenge.id}
                    currentImageUrl={challenge.image_url}
                    onUploadSuccess={(url) => setChallenge(prev => prev ? { ...prev, image_url: url } : prev)}
                  />
                ) : challenge.image_url ? (
                  <Image source={{ uri: challenge.image_url }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                ) : null}
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-2xl font-bold text-white mb-1">{challenge.title}</Text>
                    <Pressable onPress={handleShare} hitSlop={8} className="mb-1">
                      <Ionicons name="share-social-outline" size={18} color="rgba(255,255,255,0.8)" />
                    </Pressable>
                  </View>
                </View>
              </View>
              <View className="flex-row flex-wrap items-center gap-2 mt-2">
                {challenge.activity_type_name && (
                  <View className="px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Text className="text-sm font-medium text-white">{challenge.activity_type_name}</Text>
                  </View>
                )}
                <Text className="text-blue-100 text-sm">{challenge.start_date} → {challenge.end_date}</Text>
              </View>
            </View>
            <View className="p-6">
              <View className="flex-row gap-4 mb-5">
                <View className="flex-1 bg-gray-50 rounded-xl p-4 items-center">
                  <Text className="text-3xl font-bold text-gray-800">{challenge.member_count}</Text>
                  <Text className="text-sm text-gray-500 mt-1">Members Joined</Text>
                </View>
                <View className="flex-1 bg-gray-50 rounded-xl p-4 items-center">
                  <Text className="text-3xl font-bold text-gray-800">
                    {stats ? formatDistance(stats.total_distance, 'km') : challenge.total_points}
                  </Text>
                  <Text className="text-sm text-gray-500 mt-1">{stats ? 'Total Distance (km)' : 'Total Points'}</Text>
                </View>
              </View>
              {user && (
                <Pressable
                  onPress={challenge.is_member ? handleLeave : handleJoin}
                  disabled={joining}
                  className={`w-full py-3 px-4 rounded-lg items-center ${joining ? 'opacity-70' : ''}`}
                  style={{ backgroundColor: challenge.is_member ? undefined : '#3b82f6' }}
                >
                  {challenge.is_member ? (
                    <Text className="font-semibold text-red-700">{joining ? '...' : 'Leave Challenge'}</Text>
                  ) : (
                    <Text className="font-semibold text-white">{joining ? '...' : 'Join Challenge'}</Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>

          <View className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <View className="p-5 border-b border-gray-100">
              <Text className="text-lg font-bold text-gray-800">Top 20 Leaderboard</Text>
            </View>
            {(stats?.top_users ?? leaderboard).length === 0 ? (
              <View className="p-10 items-center">
                <Text className="text-gray-500">No participants yet. Be the first to join and submit!</Text>
              </View>
            ) : (
              (stats?.top_users ?? leaderboard).slice(0, 20).map(entry => (
                <View key={entry.id} className="flex-row items-center justify-between px-5 py-3 border-b border-gray-50">
                  <View className="flex-row items-center gap-3">
                    <Text className="text-xl w-8 text-center">{rankBadge(Number(entry.rank))}</Text>
                    <Link href={`/users/${entry.id}`}>
                      <Text className="font-medium text-gray-800">{entry.username}</Text>
                    </Link>
                  </View>
                  <Text className="font-bold text-blue-600">{formatDistance(Number(entry.total_points), 'km')} km</Text>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      <Link href="/tabs/challenges" className="mt-5 self-center">
        <View className="flex-row items-center gap-1">
          <Ionicons name="arrow-back" size={16} color="#3b82f6" />
          <Text className="text-blue-600 font-medium">Back to Challenges</Text>
        </View>
      </Link>
    </ScrollView>
  );
}
