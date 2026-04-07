import React from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ModalMessageProps {
  isOpen: boolean;
  message: string;
  type: 'success' | 'error' | 'confirm';
  onClose: () => void;
  onConfirm?: () => void;
}

const ModalMessage: React.FC<ModalMessageProps> = ({ isOpen, message, type, onClose, onConfirm }) => {
  const isConfirm = type === 'confirm';

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const titleColor =
    type === 'success' ? 'text-green-600' :
    type === 'error' ? 'text-red-600' :
    'text-gray-800';

  const btnColor =
    type === 'success' ? 'bg-green-500' :
    type === 'error' ? 'bg-red-500' :
    'bg-blue-500';

  const titleText =
    type === 'success' ? 'Success' :
    type === 'error' ? 'Error' :
    'Confirm';

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 items-center justify-center">
        <View className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className={`text-lg font-semibold ${titleColor}`}>{titleText}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </Pressable>
          </View>

          <Text className="text-gray-700 mb-6">{message}</Text>

          <View className="flex-row justify-end gap-2">
            {isConfirm && (
              <Pressable
                onPress={onClose}
                className="px-4 py-2 rounded-md bg-gray-200"
              >
                <Text className="text-gray-800">Cancel</Text>
              </Pressable>
            )}
            <Pressable
              onPress={isConfirm ? handleConfirm : onClose}
              className={`px-4 py-2 rounded-md ${btnColor}`}
            >
              <Text className="text-white">{isConfirm ? 'Confirm' : 'OK'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ModalMessage;
