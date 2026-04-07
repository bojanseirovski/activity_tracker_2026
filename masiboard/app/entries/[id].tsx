import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Image, Platform, Modal } from 'react-native';
import { useLocalSearchParams, Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ErrorMessage from '../../components/common/ErrorMessage';
import ModalMessage from '../../components/common/ModalMessage';
import ImageUpload from '../../components/common/ImageUpload';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';
import { formatDistance, toDisplayDistance, toRawDistance } from '../../utils/distance';
import TrackMap from '../../components/map/TrackMap';
import Gallery from 'react-native-awesome-gallery';

interface EntryDetail {
  id: number;
  name: string;
  points: number;
  date: string;
  activityTypeId: number | null;
  userId: number;
  activity_type: string | null;
  image_url: string | null;
  unit?: string;
  tracking_data?: { latitude: number; longitude: number; speed?: number | null; altitude?: number | null }[] | null;
}

interface LikesData {
  count: number;
  liked_by_me: boolean;
  users: { user_id: number; username: string }[];
}

interface GalleryImage { id: number; url: string; }

type ModalState = { isOpen: boolean; message: string; type: 'success' | 'error' | 'confirm'; onConfirm?: () => void } | null;

function avgSpeed(data: { speed?: number | null }[]): string {
  const speeds = data.map(c => c.speed).filter((s): s is number => s != null && s >= 0);
  if (!speeds.length) return '--';
  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  return `${(avg * 3.6).toFixed(1)} km/h`;
}

function elevationGain(data: { altitude?: number | null }[]): string {
  const alts = data.map(c => c.altitude).filter((a): a is number => a != null);
  if (alts.length < 2) return '--';
  let gain = 0;
  for (let i = 1; i < alts.length; i++) {
    if (alts[i] > alts[i - 1]) gain += alts[i] - alts[i - 1];
  }
  return `+${Math.round(gain)} m`;
}

export default function EntryPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [likes, setLikes] = useState<LikesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [editingPoints, setEditingPoints] = useState(false);
  const [editPoints, setEditPoints] = useState('');
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    const eid = Number(id);
    Promise.all([
      apiClient.get(API.ENTRY(eid)),
      apiClient.get(API.ENTRY_LIKES(eid)),
      apiClient.get(API.IMAGES('entry', eid)),
    ])
      .then(([entryRes, likesRes, galleryRes]) => {
        setEntry(entryRes.data);
        setLikes(likesRes.data);
        setGallery(galleryRes.data);
      })
      .catch(() => setError(MESSAGES.ENTRY_LOAD_ERROR))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleShare = async () => {
    const url = Linking.createURL(`/entries/${id}`);
    await Clipboard.setStringAsync(url);
    setModal({ isOpen: true, message: 'Entry link copied to clipboard!', type: 'success' });
  };

  const handleLikeToggle = async () => {
    if (!entry || !likes) return;
    const wasLiked = likes.liked_by_me;
    setLikes(prev => prev ? { ...prev, liked_by_me: !wasLiked, count: prev.count + (wasLiked ? -1 : 1) } : prev);
    try {
      if (wasLiked) {
        await apiClient.delete(API.ENTRY_LIKES(entry.id));
      } else {
        await apiClient.post(API.ENTRY_LIKES(entry.id));
      }
    } catch {
      setLikes(prev => prev ? { ...prev, liked_by_me: wasLiked, count: prev.count + (wasLiked ? 1 : -1) } : prev);
    }
  };

  const handleUpdate = async () => {
    if (!entry) return;
    try {
      const { data } = await apiClient.put(API.ENTRY(entry.id), {
        points: toRawDistance(Number(editPoints), entry.unit || 'km'),
        date: entry.date,
        userId: user?.id,
      });
      setEntry(prev => prev ? { ...prev, points: data.points } : prev);
      setEditingPoints(false);
      setModal({ isOpen: true, message: MESSAGES.ENTRY_UPDATE_SUCCESS, type: 'success' });
    } catch {
      setModal({ isOpen: true, message: MESSAGES.ENTRY_UPDATE_ERROR, type: 'error' });
    }
  };

  const performDelete = async () => {
    if (!entry) return;
    try {
      await apiClient.delete(API.ENTRY(entry.id), { params: { userId: user?.id } });
      setModal({ isOpen: true, message: MESSAGES.ENTRY_DELETE_SUCCESS, type: 'success' });
      setTimeout(() => router.replace('/tabs'), 1200);
    } catch {
      setModal({ isOpen: true, message: MESSAGES.ENTRY_DELETE_ERROR, type: 'error' });
    }
  };

  const handleDelete = () => {
    setModal({
      isOpen: true,
      message: MESSAGES.ENTRY_DELETE_CONFIRM,
      type: 'confirm',
      onConfirm: performDelete,
    });
  };

  const handleGalleryUpload = async () => {
    if (!entry) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const name = uri.split('/').pop() || 'image.jpg';
    const type = asset.mimeType || 'image/jpeg';

    setGalleryUploading(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        formData.append('image', blob, name);
      } else {
        formData.append('image', { uri, name, type } as any);
      }
      formData.append('entity_type', 'entry');
      formData.append('entity_id', String(entry.id));

      const token = await AsyncStorage.getItem('authToken');
      const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseURL}${API.IMAGE_UPLOAD}`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      setGallery(prev => [...prev, { id: data.id, url: data.url }]);
    } catch {
      setModal({ isOpen: true, message: 'Failed to upload image', type: 'error' });
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleGalleryDelete = async (imageId: number) => {
    try {
      await apiClient.delete(API.IMAGE_DELETE(imageId));
      setGallery(prev => prev.filter(img => img.id !== imageId));
    } catch {
      setModal({ isOpen: true, message: 'Failed to delete image', type: 'error' });
    }
  };

  const isOwner = user && entry && user.id === entry.userId;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingVertical: 32, paddingHorizontal: 16 }}>
      <ModalMessage
        isOpen={modal?.isOpen || false}
        message={modal?.message || ''}
        type={modal?.type || 'success'}
        onClose={() => setModal(null)}
        onConfirm={modal?.onConfirm}
      />

      {loading && (
        <View className="items-center justify-center h-64 bg-white rounded-2xl shadow-xl">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}
      {error && <ErrorMessage message={error} onReload={fetchData} />}

      {!loading && !error && entry && (
        <View className="gap-5">
          <View className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <View className="p-6" style={{ backgroundColor: '#3b82f6' }}>
              <View className="flex-row items-center gap-4 mb-2">
                {isOwner ? (
                  <ImageUpload
                    entityType="entry"
                    entityId={entry.id}
                    currentImageUrl={entry.image_url}
                    onUploadSuccess={(url) => setEntry(prev => prev ? { ...prev, image_url: url } : prev)}
                  />
                ) : entry.image_url ? (
                  <Image source={{ uri: entry.image_url }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                ) : null}
                <View className="flex-1">
                  {entry.activity_type && (
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-2xl font-bold text-white">{entry.activity_type}</Text>
                      <Pressable onPress={handleShare} hitSlop={8}>
                        <Ionicons name="share-social-outline" size={18} color="rgba(255,255,255,0.8)" />
                      </Pressable>
                    </View>
                  )}
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Link href={`/users/${entry.userId}`} asChild>
                      <Pressable className="bg-blue-600 px-4 py-2 rounded-full shadow active:opacity-80">
                        <Text className="text-blue-100 text-xl font-medium">{entry.name}</Text>
                      </Pressable>
                    </Link>
                    <Text className="text-blue-100 text-xl">
                      {new Date(entry.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="p-6">
              <View className="flex-row gap-4 mb-5">
                <View className="flex-1 bg-gray-50 rounded-xl p-4 items-center">
                  {editingPoints ? (
                    <View className="gap-2 w-full items-center">
                      <TextInput
                        value={editPoints}
                        onChangeText={setEditPoints}
                        keyboardType="numeric"
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-center text-lg font-bold"
                      />
                      <View className="flex-row gap-2">
                        <Pressable onPress={handleUpdate} className="bg-green-500 px-3 py-1 rounded-md">
                          <Text className="text-white text-sm font-medium">Save</Text>
                        </Pressable>
                        <Pressable onPress={() => setEditingPoints(false)} className="bg-gray-200 px-3 py-1 rounded-md">
                          <Text className="text-gray-700 text-sm">Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text className="text-3xl font-bold text-gray-800">{formatDistance(entry.points, entry.unit || 'km')}</Text>
                      <Text className="text-sm text-gray-500 mt-1">{entry.unit || 'km'}</Text>
                    </>
                  )}
                </View>
                <View className="flex-1 bg-gray-50 rounded-xl p-4 items-center">
                  <Text className="text-3xl font-bold text-gray-800">{likes?.count ?? 0}</Text>
                  <Text className="text-sm text-gray-500 mt-1">Likes</Text>
                </View>
              </View>

              {entry.tracking_data && entry.tracking_data.length > 1 && (
                <View className="flex-row gap-4 mb-5">
                  <View className="flex-1 bg-gray-50 rounded-xl p-4 items-center">
                    <Text className="text-2xl font-bold text-gray-800">{avgSpeed(entry.tracking_data)}</Text>
                    <Text className="text-sm text-gray-500 mt-1">Avg Speed</Text>
                  </View>
                  <View className="flex-1 bg-gray-50 rounded-xl p-4 items-center">
                    <Text className="text-2xl font-bold text-gray-800">{elevationGain(entry.tracking_data)}</Text>
                    <Text className="text-sm text-gray-500 mt-1">Elevation Gain</Text>
                  </View>
                </View>
              )}

              {/* Like button */}
              {user && user.id !== entry.userId && likes && (
                <Pressable
                  onPress={handleLikeToggle}
                  className={`w-full py-3 px-4 rounded-lg items-center flex-row justify-center gap-2 ${
                    likes.liked_by_me ? 'border border-red-200' : ''
                  }`}
                  style={{ backgroundColor: likes.liked_by_me ? '#fef2f2' : '#3b82f6' }}
                >
                  <Ionicons
                    name={likes.liked_by_me ? 'heart' : 'heart-outline'}
                    size={20}
                    color={likes.liked_by_me ? '#b91c1c' : 'white'}
                  />
                  <Text className={`font-semibold ${likes.liked_by_me ? 'text-red-700' : 'text-white'}`}>
                    {likes.liked_by_me ? 'Unlike' : 'Like'}
                  </Text>
                </Pressable>
              )}

              {/* Owner actions */}
              {isOwner && (
                <View className="flex-row gap-3 mt-4">
                  {!editingPoints && (
                    <Pressable
                      onPress={() => { setEditPoints(String(toDisplayDistance(entry.points, entry.unit || 'km'))); setEditingPoints(true); }}
                      className="flex-1 py-2 px-4 rounded-lg items-center border border-blue-200"
                      style={{ backgroundColor: '#eff6ff' }}
                    >
                      <Text className="font-semibold text-blue-700">Edit Points</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={handleDelete}
                    className="flex-1 py-2 px-4 rounded-lg items-center border border-red-200"
                    style={{ backgroundColor: '#fef2f2' }}
                  >
                    <Text className="font-semibold text-red-700">Delete Entry</Text>
                  </Pressable>
                </View>
              )}

              {/* Liked by */}
              {likes && likes.users.length > 0 && (
                <View className="mt-6">
                  <Text className="text-sm font-medium text-gray-700 mb-3">Liked by</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {likes.users.map(u => (
                      <Link key={u.user_id} href={`/users/${u.user_id}`} asChild>
                        <Pressable className="px-3 py-1 rounded-full bg-blue-100">
                          <Text className="text-sm font-medium text-blue-800">{u.username}</Text>
                        </Pressable>
                      </Link>
                    ))}
                  </View>
                </View>
              )}

              {/* Gallery */}
              {(gallery.length > 0 || isOwner) && (
                <View className="mt-6">
                  <Text className="text-sm font-medium text-gray-700 mb-3">Images</Text>
                  <View className="flex-row flex-wrap gap-3">
                    {gallery.map((img, index) => (
                      <View key={img.id} style={{ position: 'relative' }}>
                        <Pressable onPress={() => { setLightboxIndex(index); setLightboxVisible(true); }}>
                          <Image
                            source={{ uri: img.url }}
                            style={{ width: 100, height: 100, borderRadius: 8 }}
                          />
                        </Pressable>
                        {isOwner && (
                          <Pressable
                            onPress={(e) => { e.stopPropagation(); handleGalleryDelete(img.id); }}
                            style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20 }}
                            className="items-center justify-center"
                          >
                            <Ionicons name="close" size={14} color="white" />
                          </Pressable>
                        )}
                      </View>
                    ))}
                    {isOwner && (
                      <Pressable
                        onPress={handleGalleryUpload}
                        disabled={galleryUploading}
                        style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: '#e5e7eb' }}
                        className="items-center justify-center"
                      >
                        {galleryUploading ? (
                          <ActivityIndicator color="#9ca3af" />
                        ) : (
                          <Ionicons name="add" size={32} color="#9ca3af" />
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>

          {entry.tracking_data && entry.tracking_data.length > 1 && (
            <View className="bg-white rounded-2xl shadow-xl overflow-hidden" style={{ height: 300 }}>
              <TrackMap path={entry.tracking_data} />
            </View>
          )}
        </View>
      )}

      <Modal visible={lightboxVisible} transparent={false} onRequestClose={() => setLightboxVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Gallery
            data={gallery.map(img => img.url)}
            initialIndex={lightboxIndex}
            onSwipeToClose={() => setLightboxVisible(false)}
            renderItem={({ item, setImageDimensions }) => (
              <Image
                source={{ uri: item }}
                style={{ flex: 1 }}
                resizeMode="contain"
                onLoad={(e) => { const s = e.nativeEvent.source; if (s) setImageDimensions({ width: s.width, height: s.height }); }}
              />
            )}
          />
          <Pressable
            onPress={() => setLightboxVisible(false)}
            style={{ position: 'absolute', top: 48, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6 }}
          >
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
        </View>
      </Modal>

      <Link href="/tabs" className="mt-5 self-center">
        <View className="flex-row items-center gap-1">
          <Ionicons name="arrow-back" size={16} color="#3b82f6" />
          <Text className="text-blue-600 font-medium">Back to Leaderboard</Text>
        </View>
      </Link>
    </ScrollView>
  );
}
