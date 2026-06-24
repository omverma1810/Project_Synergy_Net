'use client';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Territory } from '@/lib/api';

/** Colour a territory by its headline rebate rate. */
function rateColor(pct: number): string {
  if (pct >= 50) return '#f5c451'; // gold — exceptional
  if (pct >= 33) return '#34d399'; // green — strong
  if (pct >= 25) return '#22d3ee'; // cyan — solid
  return '#a78bfa'; // violet — modest
}

interface Props {
  territories: Territory[];
  onSelect?: (id: number) => void;
}

export default function TerritoryMap({ territories, onSelect }: Props) {
  const pinned = territories.filter(
    (t) => t.latitude != null && t.longitude != null,
  );

  return (
    <MapContainer
      center={[30, 15]}
      zoom={2}
      minZoom={2}
      maxZoom={7}
      scrollWheelZoom={false}
      worldCopyJump
      style={{ height: '100%', width: '100%', background: '#0b1120' }}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />
      {pinned.map((t) => {
        const pct = parseFloat(t.base_percentage);
        const color = rateColor(pct);
        return (
          <CircleMarker
            key={t.id}
            center={[Number(t.latitude), Number(t.longitude)]}
            radius={7 + Math.min(pct, 60) / 6}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.55,
              weight: 2,
            }}
            eventHandlers={onSelect ? { click: () => onSelect(t.id) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={1}>
              <span style={{ fontWeight: 700 }}>{t.name}</span> · {pct.toFixed(0)}%
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</div>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{t.region}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{pct.toFixed(1)}%</div>
                {t.film_commission && (
                  <div style={{ fontSize: 11, marginTop: 4 }}>{t.film_commission}</div>
                )}
                {t.film_commission_url && (
                  <a href={t.film_commission_url} target="_blank" rel="noopener noreferrer"
                     style={{ fontSize: 11, color: '#0891b2' }}>
                    Film commission →
                  </a>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
