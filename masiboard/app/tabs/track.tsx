import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Alert, Platform } from 'react-native';
import apiClient from '../../api/client';
import { API } from '../../constants/api';
import { useAuth } from '../../context/AuthContext';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackMap from '../../components/map/TrackMap';
import { Picker } from '@react-native-picker/picker';
import { LOCATION_TASK, TRACKING_PATH_KEY } from '../../tasks/locationTask';

type Coord = { latitude: number; longitude: number; speed?: number | null; altitude?: number | null };
interface ActivityType { id: number; name: string; }

function haversineDistance(coords: Coord[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const R = 6371000;
    const dLat = ((coords[i].latitude - coords[i - 1].latitude) * Math.PI) / 180;
    const dLon = ((coords[i].longitude - coords[i - 1].longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((coords[i - 1].latitude * Math.PI) / 180) *
        Math.cos((coords[i].latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatSpeed(mps: number | null | undefined): string {
  if (mps == null || mps < 0) return '-- km/h';
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

function formatElevation(meters: number | null | undefined): string {
  if (meters == null) return '-- m';
  return `${Math.round(meters)} m`;
}

export default function TrackScreen() {
  const [tracking, setTracking] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [path, setPath] = useState<Coord[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [activityTypeId, setActivityTypeId] = useState<number | ''>('');
  const { user } = useAuth();

  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      TaskManager.isTaskRegisteredAsync(LOCATION_TASK).then((registered) => {
        if (registered) Location.stopLocationUpdatesAsync(LOCATION_TASK);
      });
    };
  }, []);

  useEffect(() => {
    apiClient.get(API.ACTIVITY_TYPES, { params: { userId: user?.id } })
      .then(res => setActivityTypes(res.data))
      .catch(() => {});
  }, [user?.id]);

  const handleStart = async () => {
    setError(null);

    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      setError('Location permission is required to track activities.');
      return;
    }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      setError('Background location permission is required to track while the app is minimized.');
      return;
    }

    await AsyncStorage.removeItem(TRACKING_PATH_KEY);
    setPath([]);
    setElapsed(0);
    setStopped(false);
    setTracking(true);
    startTimeRef.current = Date.now();

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 500,
      distanceInterval: 1,
      foregroundService: {
        notificationTitle: 'Tracking Activity',
        notificationBody: 'Tap to return to the app',
        notificationColor: '#3b82f6',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    if (Platform.OS === 'ios') {
      await Notifications.requestPermissionsAsync();
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Tracking Activity', body: 'Tap to return to the app' },
        trigger: null,
      });
    }

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    pollRef.current = setInterval(async () => {
      const raw = await AsyncStorage.getItem(TRACKING_PATH_KEY);
      if (raw) setPath(JSON.parse(raw));
    }, 2000);
  };

  const handleStop = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    timerRef.current = null;
    pollRef.current = null;

    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }

    if (Platform.OS === 'ios') {
      await Notifications.dismissAllNotificationsAsync();
    }

    const raw = await AsyncStorage.getItem(TRACKING_PATH_KEY);
    const finalPath: Coord[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.removeItem(TRACKING_PATH_KEY);

    setPath(finalPath);
    setTracking(false);
    setStopped(true);
  };

  const handleReset = () => {
    setPath([]);
    setElapsed(0);
    setStopped(false);
    setError(null);
    setActivityTypeId('');
  };

  const distance = haversineDistance(path);
  const lastCoord = path[path.length - 1];
  const currentSpeed = lastCoord?.speed;
  const currentElevation = lastCoord?.altitude;

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.post(API.ENTRIES, {
        name: user?.username,
        points: Math.round(distance),
        date: new Date().toISOString().split('T')[0],
        activity_type_id: activityTypeId || null,
        tracking_data: path.length > 1 ? path : null,
      });
      Alert.alert('Success', 'Activity saved!');
      handleReset();
    } catch {
      Alert.alert('Error', 'Failed to save activity.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white rounded-xl shadow-sm p-5 mx-4 mt-4 mb-3">
        <Text className="text-2xl font-bold text-gray-800 text-center mb-4">
          Activity Tracker
        </Text>

        <View className="flex-row justify-around mb-2">
          <View className="items-center">
            <Text className="text-sm text-gray-500">Time</Text>
            <Text className="text-3xl font-bold text-gray-800">{formatTime(elapsed)}</Text>
          </View>
          <View className="items-center">
            <Text className="text-sm text-gray-500">Distance</Text>
            <Text className="text-3xl font-bold text-gray-800">{formatDistance(distance)}</Text>
          </View>
          <View className="items-center">
            <Text className="text-sm text-gray-500">Points</Text>
            <Text className="text-3xl font-bold text-gray-800">{path.length}</Text>
          </View>
        </View>

        {(tracking || stopped) && (
          <View className="flex-row justify-around mb-4">
            <View className="items-center">
              <Text className="text-sm text-gray-500">Speed</Text>
              <Text className="text-xl font-bold text-gray-800">{formatSpeed(currentSpeed)}</Text>
            </View>
            <View className="items-center">
              <Text className="text-sm text-gray-500">Elevation</Text>
              <Text className="text-xl font-bold text-gray-800">{formatElevation(currentElevation)}</Text>
            </View>
          </View>
        )}

        {error && (
          <Text className="text-red-500 text-center mb-3">{error}</Text>
        )}

        {!tracking && !stopped && (
          <>
            <View className="mb-4">
              <Text className="text-sm text-gray-500 mb-1">Activity Type</Text>
              <View className="border border-gray-300 rounded-lg">
                <Picker selectedValue={activityTypeId} onValueChange={setActivityTypeId}>
                  <Picker.Item label="Select an activity type" value="" />
                  {activityTypes.map(t => (
                    <Picker.Item key={t.id} label={t.name} value={t.id} />
                  ))}
                </Picker>
              </View>
            </View>
            <Pressable
              className="bg-blue-500 rounded-lg py-4 items-center"
              onPress={handleStart}
            >
              <Text className="text-white text-lg font-bold">Start</Text>
            </Pressable>
          </>
        )}

        {tracking && (
          <Pressable
            className="bg-red-500 rounded-lg py-4 items-center"
            onPress={handleStop}
          >
            <Text className="text-white text-lg font-bold">Stop</Text>
          </Pressable>
        )}

        {stopped && (
          <>
            <Pressable
              className="bg-gray-500 rounded-lg py-4 items-center"
              onPress={handleReset}
            >
              <Text className="text-white text-lg font-bold">Reset</Text>
            </Pressable>
            <Pressable
              className={`${saving ? 'bg-green-300' : 'bg-green-500'} rounded-lg py-4 items-center mt-3`}
              onPress={handleSave}
              disabled={saving}
            >
              <Text className="text-white text-lg font-bold">{saving ? 'Saving...' : 'Save Activity'}</Text>
            </Pressable>
          </>
        )}
      </View>

      {stopped && path.length > 0 && (
        <View className="flex-1 mx-4 mb-4 rounded-xl overflow-hidden">
          <TrackMap path={path} />
        </View>
      )}

      {stopped && path.length === 0 && (
        <View className="flex-1 items-center justify-center mx-4">
          <Text className="text-gray-400 text-lg">No location data recorded.</Text>
        </View>
      )}

      {!stopped && !tracking && (
        <View className="flex-1 items-center justify-center mx-4">
          <Text className="text-gray-400 text-lg text-center">
            Press Start to begin tracking your activity.
          </Text>
        </View>
      )}
    </View>
  );
}
