
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Place, ItineraryItem, DayPlan, AppSettings, UserProfile, JournalEntry, Track } from './types';

interface GlobalState {
  // Core Data
  currentCity: string | null; 
  center: [number, number];
  searchResults: Place[];
  itinerary: DayPlan[];
  bookmarks: Place[];
  user: UserProfile;
  settings: AppSettings;
  
  // Music State
  playlist: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  regionalTracks: Track[];

  // UI State
  isLoading: boolean;
  error: string | null;
  mapDownloadProgress: number | null;
  totalTripBudget: number;

  // Actions
  setCity: (city: string, center: [number, number]) => void;
  setSearchResults: (results: Place[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setMapDownloadProgress: (progress: number | null) => void;
  setTotalBudget: (amount: number) => void;
  toggleDarkMode: () => void;
  setMapStyle: (style: 'voyager' | 'satellite') => void;
  setOffline: (offline: boolean) => void;
  setTravelMode: (mode: 'solo' | 'team') => void;
  setTeamSize: (size: number) => void;
  
  // Music Actions
  addToPlaylist: (track: Track) => void;
  removeFromPlaylist: (id: string) => void;
  playTrack: (track: Track | null) => void;
  setRegionalTracks: (tracks: Track[]) => void;
  setPlaying: (playing: boolean) => void;

  // Advanced Itinerary Actions
  addToItinerary: (place: Place, dayId: string) => void;
  removeFromItinerary: (dayId: string, placeId: string) => void;
  updateItineraryItem: (dayId: string, placeId: string, updates: Partial<ItineraryItem>) => void;
  setDayItems: (dayId: string, items: ItineraryItem[]) => void;
  moveItem: (sourceDayId: string, sourceIndex: number, targetDayId: string, targetIndex: number) => void;
  addDay: () => void;
  removeDay: (dayId: string) => void;
  resetTrip: () => void;
  
  // Bookmarks & Journal
  toggleBookmark: (place: Place) => void;
  updateJournalEntry: (placeId: string, entry: JournalEntry) => void;
}

const INITIAL_DAYS: DayPlan[] = [
  { id: 'day-1', title: 'Day 1', items: [] },
];

const INITIAL_USER: UserProfile = {
  id: 'guest',
  name: 'Traveler',
  email: 'guest@example.com',
  stats: { tripsPlanned: 0, placesVisited: 0, countriesVisited: 0 }
};

export const useTripStore = create<GlobalState>()(
  persist(
    (set, get) => ({
      // Initial State
      currentCity: null, 
      center: [20, 0], 
      searchResults: [],
      itinerary: INITIAL_DAYS,
      bookmarks: [],
      user: INITIAL_USER,
      playlist: [],
      currentTrack: null,
      isPlaying: false,
      regionalTracks: [],
      settings: {
        darkMode: false,
        currency: 'INR',
        use24HourTime: true,
        offlineMode: false,
        mapStyle: 'voyager',
        travelMode: 'solo',
        teamSize: 2,
      },
      isLoading: false,
      error: null,
      mapDownloadProgress: null,
      totalTripBudget: 0,

      // --- Music Actions ---
      addToPlaylist: (track) => set((state) => {
        if (state.playlist.some(t => t.id === track.id)) return state;
        return { playlist: [...state.playlist, track] };
      }),
      removeFromPlaylist: (id) => set((state) => ({
        playlist: state.playlist.filter(t => t.id !== id)
      })),
      playTrack: (track) => set({ currentTrack: track, isPlaying: !!track }),
      setRegionalTracks: (regionalTracks) => set({ regionalTracks }),
      setPlaying: (isPlaying) => set({ isPlaying }),

      // --- Actions ---
      setCity: (city, center) => set({ 
        currentCity: city, 
        center, 
        searchResults: [],
        regionalTracks: []
      }),

      setSearchResults: (results) => set({ searchResults: results }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setMapDownloadProgress: (progress) => set({ mapDownloadProgress: progress }),
      setTotalBudget: (amount) => set({ totalTripBudget: amount }),
      setOffline: (offline) => set((state) => ({ settings: { ...state.settings, offlineMode: offline } })),
      setTravelMode: (mode) => set((state) => ({ settings: { ...state.settings, travelMode: mode } })),
      setTeamSize: (size) => set((state) => ({ settings: { ...state.settings, teamSize: Math.max(1, size) } })),

      toggleDarkMode: () => set((state) => ({ 
        settings: { ...state.settings, darkMode: !state.settings.darkMode } 
      })),

      setMapStyle: (style) => set((state) => ({
        settings: { ...state.settings, mapStyle: style }
      })),

      // Itinerary Logic
      addToItinerary: (place, dayId) => set((state) => {
        const newItinerary = state.itinerary.map(day => {
          if (day.id === dayId) {
            if (day.items.some(i => i.id === place.id)) return day;
            return { 
              ...day, 
              items: [...day.items, { 
                ...place, 
                cost: 0, 
                notes: '', 
                startTime: '09:00', 
                durationMinutes: 60,
                travelTimeMinutes: 15
              }] 
            };
          }
          return day;
        });
        return { itinerary: newItinerary };
      }),

      removeFromItinerary: (dayId, placeId) => set((state) => ({
        itinerary: state.itinerary.map(day => {
          if (day.id === dayId) {
            return { ...day, items: day.items.filter(i => i.id !== placeId) };
          }
          return day;
        })
      })),

      updateItineraryItem: (dayId, placeId, updates) => set((state) => ({
        itinerary: state.itinerary.map(day => {
          if (day.id === dayId) {
            return {
              ...day,
              items: day.items.map(item => item.id === placeId ? { ...item, ...updates } : item)
            };
          }
          return day;
        })
      })),

      setDayItems: (dayId, items) => set((state) => ({
        itinerary: state.itinerary.map(day => 
          day.id === dayId ? { ...day, items } : day
        )
      })),

      moveItem: (sourceDayId, sourceIndex, targetDayId, targetIndex) => set((state) => {
        const newItinerary = state.itinerary.map(day => ({ ...day, items: [...day.items] }));
        const sourceDayIdx = newItinerary.findIndex(d => d.id === sourceDayId);
        const targetDayIdx = newItinerary.findIndex(d => d.id === targetDayId);

        if (sourceDayIdx === -1 || targetDayIdx === -1) return {};

        const [movedItem] = newItinerary[sourceDayIdx].items.splice(sourceIndex, 1);
        newItinerary[targetDayIdx].items.splice(targetIndex, 0, movedItem);

        return { itinerary: newItinerary };
      }),

      addDay: () => set((state) => ({
        itinerary: [...state.itinerary, { 
          id: `day-${state.itinerary.length + 1}`, 
          title: `Day ${state.itinerary.length + 1}`, 
          items: [] 
        }]
      })),

      removeDay: (dayId) => set((state) => ({
        itinerary: state.itinerary.filter(d => d.id !== dayId)
      })),

      resetTrip: () => set({ itinerary: INITIAL_DAYS, totalTripBudget: 0, currentCity: null }),

      toggleBookmark: (place) => set((state) => {
        const exists = state.bookmarks.some(b => b.id === place.id);
        if (exists) {
          return { bookmarks: state.bookmarks.filter(b => b.id !== place.id) };
        }
        return { bookmarks: [...state.bookmarks, place] };
      }),

      updateJournalEntry: (placeId, entry) => set((state) => {
        const newItinerary = state.itinerary.map(day => ({
          ...day,
          items: day.items.map(item => 
            item.id === placeId ? { ...item, journal: entry } : item
          )
        }));
        const newBookmarks = state.bookmarks.map(b => 
          b.id === placeId ? { ...b, journal: entry } : b
        );
        return { itinerary: newItinerary, bookmarks: newBookmarks };
      }),
    }),
    {
      name: 'travel-buddy-pro-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentCity: state.currentCity,
        center: state.center,
        itinerary: state.itinerary,
        bookmarks: state.bookmarks,
        totalTripBudget: state.totalTripBudget,
        user: state.user,
        settings: state.settings,
        playlist: state.playlist
      }),
    }
  )
);
