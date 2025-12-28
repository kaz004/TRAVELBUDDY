
import { Track } from '../types';

const CLIENT_ID = '74e5525bd66c4aaaade1d837cbf9a506';
const CLIENT_SECRET = '543d00ac777942e89c52847fd1910676';

let accessToken: string | null = null;
let tokenExpiry: number = 0;

// High-quality, reliable audio fallbacks for a varied "Travel Radio" experience
const FALLBACK_TRACKS: Track[] = [
  { id: 'f1', name: 'Midnight in Paris', artist: 'TravelBuddy Jazz', albumArt: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2073', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', uri: 'spotify:track:f1' },
  { id: 'f2', name: 'Tokyo Neon', artist: 'Lofi Explorer', albumArt: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=2094', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', uri: 'spotify:track:f2' },
  { id: 'f3', name: 'Amalfi Breeze', artist: 'Mediterranean Chill', albumArt: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1974', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', uri: 'spotify:track:f3' },
  { id: 'f4', name: 'New York Groove', artist: 'City Vibes', albumArt: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=2070', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', uri: 'spotify:track:f4' },
  { id: 'f5', name: 'Sahara Sands', artist: 'Desert Echo', albumArt: 'https://images.unsplash.com/photo-1509059852496-f3822ae057bf?q=80&w=2040', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', uri: 'spotify:track:f5' },
  { id: 'f6', name: 'Nordic Light', artist: 'Ambient North', albumArt: 'https://images.unsplash.com/photo-1531366930491-81747a781bb8?q=80&w=2070', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', uri: 'spotify:track:f6' },
  { id: 'f7', name: 'Tropical Soul', artist: 'Island Rhythms', albumArt: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', uri: 'spotify:track:f7' },
  { id: 'f8', name: 'London Rain', artist: 'Afternoon Jazz', albumArt: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=2070', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', uri: 'spotify:track:f8' },
  { id: 'f9', name: 'Andes Height', artist: 'Mountain Flute', albumArt: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', uri: 'spotify:track:f9' },
  { id: 'f10', name: 'Seoul Pop', artist: 'K-Travel', albumArt: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=2130', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3', uri: 'spotify:track:f10' },
  { id: 'f11', name: 'Berlin Techno', artist: 'Underground Beats', albumArt: 'https://images.unsplash.com/photo-1571330735066-03add4753f80?q=80&w=2070', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', uri: 'spotify:track:f11' },
  { id: 'f12', name: 'Ipanema Sun', artist: 'Bossa Nova', albumArt: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?q=80&w=2076', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3', uri: 'spotify:track:f12' },
];

export const getSpotifyToken = async () => {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET) },
      body: 'grant_type=client_credentials'
    });
    const data = await response.json();
    if (!data.access_token) throw new Error("Token error");
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);
    return accessToken;
  } catch (error) {
    return null;
  }
};

export const searchTracks = async (query: string): Promise<Track[]> => {
  const token = await getSpotifyToken();
  if (!token) {
    const matches = FALLBACK_TRACKS.filter(t => 
      t.name.toLowerCase().includes(query.toLowerCase()) || 
      t.artist.toLowerCase().includes(query.toLowerCase())
    );
    return matches.length > 0 ? matches : FALLBACK_TRACKS;
  }

  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=25`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    const results = data.tracks.items
      .filter((item: any) => !!item.preview_url)
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        artist: item.artists[0].name,
        albumArt: item.album.images[0]?.url || '',
        previewUrl: item.preview_url,
        uri: item.uri
      }));
    
    if (results.length > 0) return results;
    return FALLBACK_TRACKS;
  } catch (error) {
    return FALLBACK_TRACKS;
  }
};

export const getRegionalPlaylist = async (genres: string[]): Promise<Track[]> => {
  const token = await getSpotifyToken();
  if (!token) return FALLBACK_TRACKS;

  try {
    const query = genres.length > 0 ? genres.slice(0, 3).map(g => `genre:"${g}"`).join(' OR ') : 'world music';
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    const results = data.tracks.items
      .filter((item: any) => !!item.preview_url)
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        artist: item.artists[0].name,
        albumArt: item.album.images[0]?.url || '',
        previewUrl: item.preview_url,
        uri: item.uri
      }));

    return results.length > 0 ? results : FALLBACK_TRACKS;
  } catch (error) {
    return FALLBACK_TRACKS;
  }
};
