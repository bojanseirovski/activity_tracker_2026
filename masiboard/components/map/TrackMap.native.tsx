import React, { useMemo } from 'react';
import { WebView } from 'react-native-webview';

type Coord = { latitude: number; longitude: number };

interface TrackMapProps {
  path: Coord[];
}

export default function TrackMap({ path }: TrackMapProps) {
  const html = useMemo(() => {
    const coords = JSON.stringify(path.map(p => [p.latitude, p.longitude]));
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%}</style>
</head><body>
<div id="map"></div>
<script>
var coords=${coords};
var map=L.map('map',{zoomControl:false});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'© OpenStreetMap'
}).addTo(map);
var line=L.polyline(coords,{color:'#3b82f6',weight:4}).addTo(map);
map.fitBounds(line.getBounds(),{padding:[40,40]});
var greenIcon=new L.Icon({
  iconUrl:'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize:[25,41],iconAnchor:[12,41]
});
var redIcon=new L.Icon({
  iconUrl:'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize:[25,41],iconAnchor:[12,41]
});
L.marker(coords[0],{icon:greenIcon}).addTo(map);
L.marker(coords[coords.length-1],{icon:redIcon}).addTo(map);
<\/script>
</body></html>`;
  }, [path]);

  return (
    <WebView
      source={{ html }}
      style={{ flex: 1 }}
      originWhitelist={['*']}
      scrollEnabled={false}
      nestedScrollEnabled={false}
    />
  );
}
