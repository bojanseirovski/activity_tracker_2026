import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCATION_TASK = 'background-location-task';
export const TRACKING_PATH_KEY = 'tracking_path';

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const raw = await AsyncStorage.getItem(TRACKING_PATH_KEY);
  const existing = raw ? JSON.parse(raw) : [];
  const newCoords = locations.map((l: Location.LocationObject) => ({
    latitude: l.coords.latitude,
    longitude: l.coords.longitude,
  }));
  await AsyncStorage.setItem(TRACKING_PATH_KEY, JSON.stringify([...existing, ...newCoords]));
});
