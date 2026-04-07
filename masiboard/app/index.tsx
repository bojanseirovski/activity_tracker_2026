import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { API } from '../constants/api';

export default function Index() {
  const { user, isLoading } = useAuth();
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkHealth = async () => {
      while (!cancelled) {
        try {
          await apiClient.get(API.HEALTH);
          if (!cancelled) setApiReady(true);
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 2200));
        }
      }
    };

    checkHealth();
    return () => { cancelled = true; };
  }, []);

  if (isLoading || !apiReady) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        {!apiReady && (
          <Text className="mt-4 text-gray-500">Connecting to server...</Text>
        )}
      </View>
    );
  }

  return <Redirect href={user ? '/tabs' : '/auth/login'} />;
}
