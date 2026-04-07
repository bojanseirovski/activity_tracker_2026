import React, { useState } from 'react';
import { View, Image, Pressable, ActivityIndicator, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API } from '../../constants/api';

interface ImageUploadProps {
  entityType: 'user' | 'activity_type' | 'challenge' | 'team' | 'entry';
  entityId: number;
  currentImageUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  circular?: boolean;
  size?: number;
}

export default function ImageUpload({
  entityType,
  entityId,
  currentImageUrl,
  onUploadSuccess,
  circular = false,
  size = 80,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePress = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const name = uri.split('/').pop() || 'image.jpg';
    const type = asset.mimeType || 'image/jpeg';

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        formData.append('image', blob, name);
      } else {
        formData.append('image', { uri, name, type } as any);
      }
      formData.append('entity_type', entityType);
      formData.append('entity_id', String(entityId));

      const token = await AsyncStorage.getItem('authToken');
      const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseURL}${API.IMAGE_UPLOAD}`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      onUploadSuccess(data.url);
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const borderRadius = circular ? size / 2 : 8;

  return (
    <View>
      <Pressable
        onPress={handlePress}
        disabled={uploading}
        style={{ width: size, height: size, borderRadius, overflow: 'hidden', backgroundColor: '#e5e7eb' }}
        className="items-center justify-center"
      >
        {currentImageUrl ? (
          <Image
            source={{ uri: currentImageUrl }}
            style={{ width: size, height: size, borderRadius }}
          />
        ) : (
          <Ionicons name="camera" size={size * 0.35} color="#9ca3af" />
        )}

        {uploading && (
          <View
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius, backgroundColor: 'rgba(0,0,0,0.4)' }}
            className="items-center justify-center"
          >
            <ActivityIndicator color="white" />
          </View>
        )}
      </Pressable>
      {error && <Text className="text-red-500 text-xs mt-1">{error}</Text>}
    </View>
  );
}
