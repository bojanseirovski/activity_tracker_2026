import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ErrorMessageProps {
  message: string;
  onReload: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onReload }) => {
  return (
    <View className="bg-white rounded-2xl shadow-xl p-4 mb-8">
      <View className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
        <View className="flex-row">
          <Ionicons name="close-circle" size={20} color="#f87171" />
          <View className="ml-3 flex-1">
            <Text className="text-sm text-red-700 mb-3">{message}</Text>
            <Pressable
              onPress={onReload}
              className="flex-row items-center self-start px-3 py-1 bg-red-100 rounded-md"
            >
              <Ionicons name="refresh" size={16} color="#b91c1c" />
              <Text className="text-sm font-medium text-red-700 ml-1">Reload</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ErrorMessage;
