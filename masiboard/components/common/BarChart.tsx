import React from 'react';
import { View, Text } from 'react-native';
import { formatDistance } from '../../utils/distance';

interface BarChartProps {
  data: { label: string; value: number }[];
  unit: string;
}

const BAR_MAX_HEIGHT = 120;
const BAR_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6'];

export default function BarChart({ data, unit }: BarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <View className="flex-row items-end justify-around" style={{ height: BAR_MAX_HEIGHT + 60 }}>
      {data.map((item, i) => {
        const height = Math.max(4, (item.value / maxValue) * BAR_MAX_HEIGHT);
        return (
          <View key={item.label} className="items-center flex-1">
            <Text className="text-sm font-bold text-gray-800 mb-1">
              {formatDistance(item.value, unit)}
            </Text>
            <Text className="text-xs text-gray-500 mb-2">{unit}</Text>
            <View
              style={{ width: 40, height, backgroundColor: BAR_COLORS[i % BAR_COLORS.length], borderRadius: 6 }}
            />
            <Text className="text-xs font-medium text-gray-600 mt-2">{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}
