import React, { useRef } from 'react';
import MapView, { Polyline, Marker } from 'react-native-maps';

type Coord = { latitude: number; longitude: number };

interface TrackMapProps {
  path: Coord[];
}

export default function TrackMap({ path }: TrackMapProps) {
  const mapRef = useRef<MapView>(null);

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialRegion={{
        latitude: path[0].latitude,
        longitude: path[0].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      onLayout={() => {
        if (path.length > 1) {
          mapRef.current?.fitToCoordinates(path, {
            edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
            animated: true,
          });
        }
      }}
    >
      <Polyline coordinates={path} strokeColor="#3b82f6" strokeWidth={4} />
      <Marker coordinate={path[0]} title="Start" pinColor="green" />
      <Marker coordinate={path[path.length - 1]} title="End" pinColor="red" />
    </MapView>
  );
}
