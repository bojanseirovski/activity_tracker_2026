import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
type Coord = { latitude: number; longitude: number };

interface TrackMapProps {
  path: Coord[];
}

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function FitBounds({ path }: { path: Coord[] }) {
  const map = useMap();
  useEffect(() => {
    if (path.length > 1) {
      const bounds = path.map((p) => [p.latitude, p.longitude] as [number, number]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [path, map]);
  return null;
}

export default function TrackMap({ path }: TrackMapProps) {
  const [cssLoaded, setCssLoaded] = useState(false);

  useEffect(() => {
    const id = 'leaflet-css';
    const existing = document.getElementById(id);
    if (existing) {
      setCssLoaded(true);
      return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.onload = () => setCssLoaded(true);
    document.head.appendChild(link);
  }, []);

  const positions = path.map((p) => [p.latitude, p.longitude] as [number, number]);

  if (!cssLoaded) return null;

  return (
    <MapContainer
      center={positions[0]}
      zoom={15}
      style={{ flex: 1, height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={positions} pathOptions={{ color: '#3b82f6', weight: 4 }} />
      <Marker position={positions[0]} icon={greenIcon} />
      <Marker position={positions[positions.length - 1]} icon={redIcon} />
      <FitBounds path={path} />
    </MapContainer>
  );
}
