
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Place, ItineraryItem } from '../types';
import { getTile, saveTile } from '../services/offlineMapService';

interface MapProps {
  center: [number, number];
  places: Place[];
  itineraryItems: ItineraryItem[];
  selectedPlaceId?: string;
  onMarkerClick: (place: Place) => void;
  showRoute?: boolean;
  darkMode?: boolean;
}

const MapComponent: React.FC<MapProps> = ({ 
  center, 
  places, 
  itineraryItems, 
  selectedPlaceId, 
  onMarkerClick, 
  showRoute = true,
  darkMode = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLineRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const L = (window as any).L;

    if (L) {
      // Define Custom Offline Tile Layer
      const OfflineTileLayer = L.TileLayer.extend({
        createTile: function(coords: any, done: any) {
          const tile = document.createElement('img');
          const url = this.getTileUrl(coords);
          const key = `${coords.z}_${coords.x}_${coords.y}`;

          L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
          L.DomEvent.on(tile, 'error', L.Util.bind(this._tileOnError, this, done, tile));

          if (this.options.crossOrigin) {
            tile.crossOrigin = '';
          }

          tile.alt = '';
          tile.setAttribute('role', 'presentation');

          // Check Cache First
          getTile(key).then((blob) => {
            if (blob) {
              const objectUrl = URL.createObjectURL(blob);
              tile.src = objectUrl;
              tile.onload = () => {
                 URL.revokeObjectURL(objectUrl);
                 this._tileOnLoad(done, tile);
              };
            } else {
              if (navigator.onLine) {
                tile.src = url;
                fetch(url).then(res => {
                  if(res.ok) return res.blob();
                  throw new Error("Tile fetch fail");
                }).then(blob => {
                  saveTile(key, blob);
                }).catch(() => { /* Ignore cache errors */ });
              } else {
                tile.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                this._tileOnError(done, tile, new Error('Offline and not cached'));
              }
            }
          }).catch(() => {
            tile.src = url;
          });

          return tile;
        }
      });

      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(center, 13);
      
      L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);
      
      // Initial Tile Layer
      tileLayerRef.current = new OfflineTileLayer(
        darkMode 
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
          : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', 
        {
          subdomains: 'abcd',
          maxZoom: 20
        }
      ).addTo(mapInstanceRef.current);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Handle Dark Mode Switch dynamically
  useEffect(() => {
    if (mapInstanceRef.current && tileLayerRef.current) {
      const newUrl = darkMode 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      tileLayerRef.current.setUrl(newUrl);
    }
  }, [darkMode]);

  // Update Center
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(center, 14, { duration: 1.5, easeLinearity: 0.25 });
    }
  }, [center]);

  // Update Markers and Route
  useEffect(() => {
    const L = (window as any).L;
    if (!mapInstanceRef.current || !L) return;

    // Clear existing
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    const allPlaces = [...places, ...itineraryItems];
    const uniquePlaces = Array.from(new Map(allPlaces.map(item => [item.id, item])).values());

    uniquePlaces.forEach((place, index) => {
      const isSelected = place.id === selectedPlaceId;
      const itineraryIndex = itineraryItems.findIndex(i => i.id === place.id);
      const isItinerary = itineraryIndex !== -1;

      const color = isSelected ? '#ef4444' : isItinerary ? '#10b981' : '#64748b';
      const zIndex = isSelected ? 1000 : isItinerary ? 500 : 100;
      
      const contentHtml = isItinerary 
        ? `<div class="flex items-center justify-center text-white font-bold text-[10px] w-full h-full">${itineraryIndex + 1}</div>`
        : '';

      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
          background-color: ${color};
          width: ${isSelected ? 36 : 28}px;
          height: ${isSelected ? 36 : 28}px;
          border-radius: 50%;
          border: 3px solid ${darkMode ? '#1e293b' : 'white'};
          box-shadow: 0 4px 10px rgba(0,0,0,0.4);
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          display: flex; 
          align-items: center; 
          justify-content: center;
          transform: ${isSelected ? 'scale(1.1)' : 'scale(1)'};
        ">${contentHtml}</div>`,
        iconSize: [isSelected ? 36 : 28, isSelected ? 36 : 28],
        iconAnchor: [isSelected ? 18 : 14, isSelected ? 18 : 14]
      });

      const marker = L.marker([place.lat, place.lng], { icon: customIcon, zIndexOffset: zIndex })
        .addTo(mapInstanceRef.current);

      marker.on('click', () => onMarkerClick(place));
      markersRef.current.push(marker);
    });

    if (showRoute && itineraryItems.length > 1) {
      const latlngs = itineraryItems.map(item => [item.lat, item.lng]);
      routeLineRef.current = L.polyline(latlngs, {
        color: darkMode ? '#34d399' : '#059669', // Emerald 400/600
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 10',
        lineCap: 'round',
        className: 'animate-dash' // If you added css animation
      }).addTo(mapInstanceRef.current);
      
      if (!selectedPlaceId) {
        const bounds = L.latLngBounds(latlngs);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }

  }, [places, itineraryItems, selectedPlaceId, onMarkerClick, showRoute, darkMode]);

  return <div ref={mapContainerRef} className={`w-full h-full z-0 transition-colors duration-500 ${darkMode ? 'bg-slate-900' : 'bg-slate-100'}`} />;
};

export default MapComponent;
