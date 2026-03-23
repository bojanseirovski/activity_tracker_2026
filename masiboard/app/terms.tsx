import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TermsPage() {
  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingVertical: 32, paddingHorizontal: 16 }}>
      <View className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-2xl w-full self-center">
        <View className="p-6 items-center" style={{ backgroundColor: '#3b82f6' }}>
          <Text className="text-2xl font-bold text-white">Terms of Service</Text>
          <Text className="text-blue-100 mt-1 text-center">Please read these terms carefully before using the app</Text>
        </View>

        <View className="p-6 gap-6">
          <View>
            <Text className="text-base font-semibold text-gray-900 mb-2">1. Acceptance of Terms</Text>
            <Text className="text-sm text-gray-700 leading-relaxed">
              By registering for or using this application, you agree to be bound by these Terms of Service.
              If you do not agree to these terms, you may not access or use the app.
            </Text>
          </View>

          <View>
            <Text className="text-base font-semibold text-gray-900 mb-2">2. Real Names Required</Text>
            <Text className="text-sm text-gray-700 leading-relaxed">
              You must register using your real, legal name. Fictitious names, pseudonyms, or
              impersonations of other individuals are strictly prohibited.
            </Text>
          </View>

          <View>
            <Text className="text-base font-semibold text-gray-900 mb-2">3. Valid Email Address</Text>
            <Text className="text-sm text-gray-700 leading-relaxed">
              You must provide a real, valid email address that you own and have access to. Disposable or
              temporary email addresses are not permitted.
            </Text>
          </View>

          <View>
            <Text className="text-base font-semibold text-gray-900 mb-2">4. Accuracy of Activity Data</Text>
            <Text className="text-sm text-gray-700 leading-relaxed">
              You are solely responsible for the accuracy of any activity entries you submit. Submitting
              false, exaggerated, or misleading records may result in account suspension.
            </Text>
          </View>

          <View>
            <Text className="text-base font-semibold text-gray-900 mb-2">5. Disclaimer of Liability</Text>
            <Text className="text-sm text-gray-700 leading-relaxed">
              This application is provided "as is" without warranties of any kind. We are not responsible
              for loss of data, service interruptions, or any damages arising from your use of the app.
            </Text>
          </View>

          <View>
            <Text className="text-base font-semibold text-gray-900 mb-2">6. Account Security</Text>
            <Text className="text-sm text-gray-700 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and must
              notify us immediately of any unauthorized use.
            </Text>
          </View>

          <View>
            <Text className="text-base font-semibold text-gray-900 mb-2">7. Changes to Terms</Text>
            <Text className="text-sm text-gray-700 leading-relaxed">
              We reserve the right to update these Terms at any time. Continued use constitutes acceptance.
            </Text>
          </View>

          <View className="pt-4 border-t border-gray-100">
            <Text className="text-xs text-gray-400 text-center">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </View>
        </View>
      </View>

      <Link href="/auth/register" className="mt-5 self-center">
        <View className="flex-row items-center gap-1">
          <Ionicons name="arrow-back" size={16} color="#3b82f6" />
          <Text className="text-blue-600 font-medium">Back to Register</Text>
        </View>
      </Link>
    </ScrollView>
  );
}
