
export interface JournalEntry {
  text: string;
  photos: string[];
  date: string;
  rating?: number;
}

export interface Track {
  id: string;
  name: string;
  artist: string;
  albumArt: string;
  previewUrl: string | null;
  uri: string;
  isOffline?: boolean;
}

export interface Place {
  id: string;
  name: string;
  description: string;
  category: 'attraction' | 'food' | 'hotel' | 'landmark' | 'other';
  rating: number;
  lat: number;
  lng: number;
  address?: string;
  photos?: string[];
  openingHours?: string[];
  website?: string;
  phone?: string;
  reviews?: number;
  journal?: JournalEntry;
}

export interface ItineraryItem extends Place {
  notes?: string;
  startTime?: string; // e.g., "09:00"
  durationMinutes?: number; // e.g., 90
  travelTimeMinutes?: number; // Time to get to NEXT place
  cost?: number;
  isBooked?: boolean;
}

export interface DayPlan {
  id: string;
  title: string;
  date?: string;
  items: ItineraryItem[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  homeCity?: string;
  stats: {
    tripsPlanned: number;
    placesVisited: number;
    countriesVisited: number;
  }
}

export interface AppSettings {
  darkMode: boolean;
  currency: string;
  use24HourTime: boolean;
  offlineMode: boolean;
  mapStyle: 'voyager' | 'satellite';
  travelMode: 'solo' | 'team';
  teamSize: number;
}

export enum ViewMode {
  EXPLORE = 'explore',
  ITINERARY = 'itinerary',
  SAVED = 'saved',
  JOURNAL = 'journal',
  PROFILE = 'profile',
  MUSIC = 'music'
}
