import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ModalMessage from '../../components/common/ModalMessage';
import ErrorMessage from '../../components/common/ErrorMessage';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';
import { formatDistance } from '../../utils/distance';
import TrackMap from '../../components/map/TrackMap';

interface LeaderboardEntry {
  id: number;
  name: string;
  points: number;
  date: string;
  user_id: number;
  activity_type: string;
  like_count?: number;
  liked_by_me?: boolean;
  image_url?: string | null;
  unit?: string;
  tracking_data?: { latitude: number; longitude: number }[] | null;
}

interface LikeUser { user_id: number; username: string; }

interface LikesState {
  count: number;
  likedByMe: boolean;
  users: LikeUser[] | null;
  loadingUsers: boolean;
}

const PAGE_SIZE = 10;
type ModalState = { isOpen: boolean; message: string; type: 'success' | 'error' | 'confirm'; onConfirm?: () => void } | null;

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPoints, setEditPoints] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likesMap, setLikesMap] = useState<Record<number, LikesState>>({});
  const [likesModal, setLikesModal] = useState<{ entryId: number } | null>(null);

  const fetchLeaderboard = useCallback(async (pageNum = 1) => {
    pageNum === 1 ? setLoading(true) : setLoadingMore(true);
    if (pageNum === 1) setError(null);
    try {
      const { data } = await apiClient.get(API.LEADERBOARD, {
        params: { userId: user?.id, page: pageNum, limit: PAGE_SIZE, sort: 'date' }
      });
      const incoming: LeaderboardEntry[] = data;
      setEntries(prev => pageNum === 1 ? incoming : [...prev, ...incoming]);
      setHasMore(incoming.length === PAGE_SIZE);
      setLikesMap(prev => {
        const next = { ...prev };
        incoming.forEach(e => {
          if (!next[e.id]) {
            next[e.id] = { count: e.like_count ?? 0, likedByMe: e.liked_by_me ?? false, users: null, loadingUsers: false };
          }
        });
        return next;
      });
    } catch {
      if (pageNum === 1) setError(MESSAGES.LEADERBOARD_LOAD_ERROR);
    } finally {
      pageNum === 1 ? setLoading(false) : setLoadingMore(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchLeaderboard(1);
  }, []);

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLeaderboard(nextPage);
  };

  const performDelete = async (id: number) => {
    try {
      await apiClient.delete(API.ENTRY(id), { params: { userId: user?.id } });
      setEntries(prev => prev.filter(e => e.id !== id));
      setModal({ isOpen: true, message: MESSAGES.ENTRY_DELETE_SUCCESS, type: 'success' });
    } catch {
      setModal({ isOpen: true, message: MESSAGES.ENTRY_DELETE_ERROR, type: 'error' });
    }
  };

  const handleDelete = (id: number) => {
    setModal({ isOpen: true, message: MESSAGES.ENTRY_DELETE_CONFIRM, type: 'confirm', onConfirm: () => performDelete(id) });
  };

  const handleUpdate = async (id: number) => {
    try {
      const { data: updatedEntry } = await apiClient.put(API.ENTRY(id), {
        points: Number(editPoints),
        date: new Date().toISOString().split('T')[0],
        userId: user?.id
      });
      setEntries(entries.map(e => e.id === id ? { ...e, points: updatedEntry.points } : e));
      setEditingId(null);
      setModal({ isOpen: true, message: MESSAGES.ENTRY_UPDATE_SUCCESS, type: 'success' });
    } catch {
      setModal({ isOpen: true, message: MESSAGES.ENTRY_UPDATE_ERROR, type: 'error' });
    }
  };

  const handleLikeToggle = async (entryId: number) => {
    const current = likesMap[entryId];
    if (!current) return;
    const wasLiked = current.likedByMe;
    setLikesMap(prev => ({
      ...prev,
      [entryId]: { ...prev[entryId], likedByMe: !wasLiked, count: prev[entryId].count + (wasLiked ? -1 : 1) }
    }));
    try {
      if (wasLiked) {
        await apiClient.delete(API.ENTRY_LIKES(entryId));
      } else {
        await apiClient.post(API.ENTRY_LIKES(entryId));
      }
    } catch {
      setLikesMap(prev => ({
        ...prev,
        [entryId]: { ...prev[entryId], likedByMe: wasLiked, count: prev[entryId].count + (wasLiked ? 1 : -1) }
      }));
    }
  };

  const openLikesModal = async (entryId: number) => {
    setLikesModal({ entryId });
    const state = likesMap[entryId];
    if (state && state.users === null) {
      setLikesMap(prev => ({ ...prev, [entryId]: { ...prev[entryId], loadingUsers: true } }));
      try {
        const { data } = await apiClient.get(API.ENTRY_LIKES(entryId));
        setLikesMap(prev => ({ ...prev, [entryId]: { ...prev[entryId], users: data.users ?? [], loadingUsers: false } }));
      } catch {
        setLikesMap(prev => ({ ...prev, [entryId]: { ...prev[entryId], users: [], loadingUsers: false } }));
      }
    }
  };

  const medals = ['🥇', '🥈', '🥉'];

  const renderEntry = ({ item: entry, index }: { item: LeaderboardEntry; index: number }) => {
    const likeState = likesMap[entry.id];
    const isEditing = editingId === entry.id;

    return (
      <View className="bg-white rounded-xl shadow-sm mb-3 mx-4 overflow-hidden">
      <Pressable onPress={() => !isEditing && router.push(`/entries/${entry.id}`)} className="flex-row items-center justify-between p-4">
        {isEditing ? (
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-semibold text-gray-800">Edit Points</Text>
              <Pressable onPress={() => setEditingId(null)}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </Pressable>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1 border border-gray-300 rounded-lg px-3 py-2">
                <Text className="text-gray-700">{editPoints}</Text>
              </View>
              <Pressable onPress={() => handleUpdate(entry.id)} className="bg-green-500 px-4 py-2 rounded-lg">
                <Text className="text-white font-medium">Save</Text>
              </Pressable>
              <Pressable onPress={() => setEditingId(null)} className="bg-gray-200 px-4 py-2 rounded-lg">
                <Text className="text-gray-700">Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View className="flex-row items-center flex-1">
              <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${index < 3 ? '' : 'bg-gray-200'}`}>
                {index < 3 ? (
                  <Text className="text-xl">{medals[index]}</Text>
                ) : (
                  <Text className="text-sm font-bold text-gray-700">#{index + 1}</Text>
                )}
              </View>
              <View className="flex-1">
                <Link href={`/entries/${entry.id}`}>
                  <Text className="text-base font-semibold text-blue-600">{entry.activity_type}</Text>
                </Link>
                <Text className="text-xs text-gray-500">{entry.name}</Text>
                <Text className="text-xs text-gray-400">
                  {new Date(entry.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-3">
              {likeState && (
                <View className="items-center">
                  {user && user.id !== entry.user_id ? (
                    <Pressable onPress={() => handleLikeToggle(entry.id)}>
                      <Ionicons
                        name={likeState.likedByMe ? 'heart' : 'heart-outline'}
                        size={20}
                        color={likeState.likedByMe ? '#ef4444' : '#9ca3af'}
                      />
                    </Pressable>
                  ) : (
                    <Ionicons name="heart-outline" size={20} color="#d1d5db" />
                  )}
                  <Pressable onPress={() => openLikesModal(entry.id)}>
                    <Text className="text-xs text-gray-500 mt-0.5">{likeState.count}</Text>
                  </Pressable>
                </View>
              )}

              <View className="items-end">
                <Text className="text-xl font-bold text-gray-800">{formatDistance(entry.points, entry.unit || 'km')}</Text>
                <Text className="text-xs text-gray-500">{entry.unit || 'km'}</Text>
              </View>

              {user && user.id === entry.user_id && (
                <View className="gap-2">
                  <Pressable onPress={() => { setEditingId(entry.id); setEditPoints(String(entry.points)); }}>
                    <Ionicons name="pencil" size={18} color="#3b82f6" />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(entry.id)}>
                    <Ionicons name="trash" size={18} color="#ef4444" />
                  </Pressable>
                </View>
              )}
            </View>
          </>
        )}
      </Pressable>
      {entry.tracking_data && entry.tracking_data.length > 1 && (
        <View style={{ height: 200 }}>
          <TrackMap path={entry.tracking_data} />
        </View>
      )}
      </View>
    );
  };

  const likesEntryId = likesModal?.entryId;
  const currentLikesState = likesEntryId != null ? likesMap[likesEntryId] : null;

  return (
    <View className="flex-1 bg-gray-50">
      <ModalMessage
        isOpen={modal?.isOpen || false}
        message={modal?.message || ''}
        type={modal?.type || 'success'}
        onClose={() => setModal(null)}
        onConfirm={modal?.onConfirm}
      />

      {/* Likes modal */}
      <Modal visible={!!likesModal} transparent animationType="slide" onRequestClose={() => setLikesModal(null)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setLikesModal(null)}>
          <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 max-h-80">
            <Text className="text-sm font-semibold text-gray-500 mb-3">Liked by</Text>
            {currentLikesState?.loadingUsers && <ActivityIndicator color="#3b82f6" />}
            {!currentLikesState?.loadingUsers && currentLikesState?.users?.length === 0 && (
              <Text className="text-sm text-gray-400">No likes yet</Text>
            )}
            <ScrollView>
              {currentLikesState?.users?.map(u => (
                <Pressable key={u.user_id} onPress={() => setLikesModal(null)}>
                  <Link href={`/users/${u.user_id}`}>
                    <Text className="text-sm text-blue-600 py-1">{u.username}</Text>
                  </Link>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <View className="p-4">
          <ErrorMessage message={error} onReload={() => fetchLeaderboard(1)} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => String(item.id)}
          renderItem={renderEntry}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <View className="px-4 pt-6 pb-4">
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#3b82f6" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center justify-center p-12">
              <Ionicons name="document-text-outline" size={64} color="#9ca3af" />
              <Text className="text-lg font-medium text-gray-700 mt-4">No entries yet</Text>
              <Text className="text-gray-500 mt-1">Be the first to add an entry!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
