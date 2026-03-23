import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../api/client';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

interface SearchResult {
  name: string;
  points: number;
  activity_type_name: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setHasSearched(true);
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get(API.SEARCH, { params: { q: query } });
      setResults(data);
    } catch {
      setError(MESSAGES.SEARCH_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={results}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between p-4 border border-gray-200 rounded-lg bg-white mb-2 mx-4">
            <Text className="text-base font-semibold text-gray-800 flex-1">{item.name}</Text>
            <View className="items-center mx-4">
              <Text className="text-sm font-medium text-gray-700">{item.activity_type_name}</Text>
              <Text className="text-xs text-gray-400">Activity</Text>
            </View>
            <View className="items-end">
              <Text className="text-lg font-bold text-gray-800">{item.points}</Text>
              <Text className="text-xs text-gray-500">Points</Text>
            </View>
          </View>
        )}
        ListHeaderComponent={
          <View className="px-4 pt-6 pb-4">
            <Text className="text-3xl font-bold text-gray-800 text-center mb-1">Search</Text>
            <Text className="text-gray-500 text-center mb-6">Find participants by name</Text>

            <View className="flex-row gap-2 mb-4">
              <TextInput
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white"
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name..."
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              <Pressable
                onPress={handleSearch}
                disabled={loading}
                className={`bg-blue-500 px-4 rounded-lg items-center justify-center ${loading ? 'opacity-70' : ''}`}
              >
                <Ionicons name="search" size={20} color="white" />
              </Pressable>
            </View>

            {loading && <ActivityIndicator color="#3b82f6" className="my-6" />}

            {error && (
              <View className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-4">
                <Text className="text-sm text-red-700">{error}</Text>
              </View>
            )}

            {results.length > 0 && (
              <Text className="text-lg font-bold text-gray-800 mb-3">Results ({results.length})</Text>
            )}

            {hasSearched && !loading && results.length === 0 && !error && (
              <View className="bg-white rounded-2xl shadow-md p-12 items-center">
                <Ionicons name="sad-outline" size={64} color="#9ca3af" />
                <Text className="text-lg font-medium text-gray-700 mt-4">No results found</Text>
                <Text className="text-gray-500 mt-1 text-center">No participants match "{query}"</Text>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}
