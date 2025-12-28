
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useTripStore } from './store';
import { Place, ViewMode, ItineraryItem } from './types';
import { searchPlacesWithGemini, suggestCityCenter, optimizeItineraryOrder, createTravelChat } from './services/geminiService';
import { getTilesForArea, fetchAndCacheTile } from './services/offlineMapService';
import MapComponent from './components/MapComponent';
import PlaceCard from './components/PlaceCard';
import PlaceDetailView from './components/PlaceDetailView';
import BudgetOverview from './components/BudgetOverview';
import JournalEntryModal from './components/JournalEntryModal';
import { 
  Search, MapPin, Calendar, Menu, Plus, X, 
  Bookmark, MapIcon, Sparkles, WifiOff, MessageCircle, Send,
  DownloadCloud, CheckCircle, BookOpen, Edit2, Share2, Moon, Sun, Trash2, Globe,
  Utensils, ShoppingBag, TreePine, Camera, Landmark, Music, Beer, Bed, Palmtree,
  Coffee, Wallet, Star
} from './components/Icons';
import type { Chat, GenerateContentResponse } from "@google/genai";

// Category Configuration
const CATEGORIES = [
  { id: 'attraction', label: 'Sights', icon: Camera, prompt: 'top tourist attractions and must-see sights' },
  { id: 'food', label: 'Food', icon: Utensils, prompt: 'best local restaurants and street food' },
  { id: 'cafe', label: 'Cafes', icon: Coffee, prompt: 'cozy cafes and coffee shops' },
  { id: 'nightlife', label: 'Nightlife', icon: Music, prompt: 'bars, clubs, and nightlife spots' },
  { id: 'nature', label: 'Nature', icon: TreePine, prompt: 'parks, gardens, and nature spots' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, prompt: 'shopping malls and local markets' },
];

function App() {
  const { 
    currentCity, center, searchResults, itinerary, bookmarks, isLoading, error, isOffline, mapDownloadProgress, totalTripBudget, settings,
    setCity, setSearchResults, addToItinerary, removeFromItinerary, updateItineraryItem, 
    setDayItems, moveItem, resetTrip, toggleBookmark, setLoading, setError, setOffline, setMapDownloadProgress, setTotalBudget,
    updateJournalEntry, toggleDarkMode, addDay, removeDay
  } = useTripStore();

  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.EXPLORE);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>(undefined);
  const [draggingItem, setDraggingItem] = useState<{ dayId: string, index: number } | null>(null);
  const [activeDayId, setActiveDayId] = useState<string>('day-1');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  // Modals & Chat
  const [editingBudget, setEditingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState('');
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [journalTargetPlace, setJournalTargetPlace] = useState<Place | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatInstance, setChatInstance] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Apply Dark Mode Class to HTML Element
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Network Listeners
  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOffline]);

  // Chat Init
  useEffect(() => {
    if (!isOffline && currentCity) {
       setChatInstance(createTravelChat(currentCity));
       setChatMessages([{ role: 'model', text: `Yo! I'm your local buddy in ${currentCity}. What's the plan?` }]);
    }
  }, [currentCity, isOffline]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, showChat]);

  // --- Handlers ---

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityInput.trim() || isOffline) return;
    setLoading(true);
    try {
      const coords = await suggestCityCenter(cityInput);
      setCity(cityInput, coords);
      setCityInput('');
    } catch (e) {
      setError("Could not locate city.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || isOffline) return;
    setLoading(true);
    setError(null);
    try {
      const places = await searchPlacesWithGemini(searchQuery, currentCity || '');
      setSearchResults(places);
      if (places.length > 0) {
        useTripStore.setState({ center: [places[0].lat, places[0].lng] });
      }
    } catch (err) {
      setError("Failed to find places.");
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = async (category: any) => {
    if (isOffline) return;
    setActiveCategory(category.id);
    setSearchQuery(category.label); // Visual feedback
    setLoading(true);
    setError(null);
    try {
      const places = await searchPlacesWithGemini(category.prompt, currentCity || '');
      setSearchResults(places);
      if (places.length > 0) {
         useTripStore.setState({ center: [places[0].lat, places[0].lng] });
      }
    } catch (err) {
      setError("Failed to fetch category items.");
    } finally {
      setLoading(false);
    }
  };

  const handleShareItinerary = () => {
    const text = itinerary.map(day => {
      const items = day.items.map(i => `  • ${i.startTime} - ${i.name} (${i.durationMinutes}m)`).join('\n');
      return `${day.title}:\n${items || '  No plans yet'}`;
    }).join('\n\n');
    
    navigator.clipboard.writeText(`Trip to ${currentCity}:\n\n${text}`);
    alert("Itinerary copied to clipboard!");
  };

  const handleDownloadMap = async () => {
    if (isOffline) return;
    if (!confirm(`Download offline map for ${currentCity}?`)) return;
    setMapDownloadProgress(0);
    try {
      const tilesToFetch = getTilesForArea(center[0], center[1], [12, 13]);
      let completed = 0;
      const total = tilesToFetch.length;
      const BATCH_SIZE = 5;
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = tilesToFetch.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(tile => fetchAndCacheTile(tile.url, tile.key)));
        completed += batch.length;
        setMapDownloadProgress(Math.min(100, Math.round((completed / total) * 100)));
      }
      setMapDownloadProgress(100);
      setTimeout(() => setMapDownloadProgress(null), 2000);
    } catch (e) {
      setError("Failed to download map.");
      setMapDownloadProgress(null);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !chatInstance || isChatLoading) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const result: GenerateContentResponse = await chatInstance.sendMessage({ message: userMsg });
      setChatMessages(prev => [...prev, { role: 'model', text: result.text || "No response." }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'model', text: "Connection error." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // DnD
  const handleDragStart = (e: React.DragEvent, dayId: string, index: number) => {
    setDraggingItem({ dayId, index });
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDrop = (e: React.DragEvent, targetDayId: string, targetIndex: number) => {
    e.preventDefault();
    if (draggingItem) {
      moveItem(draggingItem.dayId, draggingItem.index, targetDayId, targetIndex);
      setDraggingItem(null);
    }
  };

  const selectedPlace = selectedPlaceId 
    ? [...searchResults, ...bookmarks, ...itinerary.flatMap(d => d.items)].find(p => p.id === selectedPlaceId)
    : null;

  // --- RENDER: Landing Page ---
  if (!currentCity) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center relative overflow-hidden font-sans">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021')] bg-cover bg-center opacity-40 scale-105 animate-[pulse_20s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-slate-900/60 to-slate-900" />
        
        {/* Content */}
        <div className="z-10 bg-white/5 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-3xl max-w-lg w-full shadow-2xl text-center animate-[fade-in-up_1s_ease-out]">
          <div className="inline-block p-4 bg-emerald-500/20 rounded-full mb-6 animate-[bounce_3s_infinite]">
            <Globe className="text-emerald-400" size={56} />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">
            Travel<span className="text-emerald-400">Buddy</span>
          </h1>
          <p className="text-lg text-slate-300 mb-8 font-medium">
            Your AI-powered guide to the world.<br/>Discover, Plan, and Explore.
          </p>
          
          <form onSubmit={handleCitySearch} className="relative group">
            <input 
              type="text" 
              placeholder="Where is your next adventure?"
              className="w-full pl-5 pr-14 py-4 bg-white/10 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white/20 text-white font-medium placeholder-slate-400 transition-all shadow-lg"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
            />
            <button 
              type="submit" 
              className="absolute right-2 top-2 p-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-all shadow-lg group-hover:scale-105"
              disabled={isLoading}
            >
              {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Search size={22} />}
            </button>
          </form>
          
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 justify-center text-red-200 text-sm animate-shake">
              <X size={14} /> {error}
            </div>
          )}

          <div className="mt-8 flex justify-center gap-4 text-slate-400 text-sm">
             <span className="flex items-center gap-1"><Sparkles size={12}/> AI Itineraries</span>
             <span className="flex items-center gap-1"><WifiOff size={12}/> Offline Maps</span>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: Main App ---
  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300">
      
      {/* Sidebar */}
      <div className={`
        fixed md:relative z-20 h-full bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col border-r border-slate-200 dark:border-slate-800
        ${isSidebarOpen ? 'w-[100vw] md:w-[450px] translate-x-0' : 'w-[100vw] md:w-[450px] -translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden'}
      `}>
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10 sticky top-0">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-3 cursor-pointer group select-none" onClick={() => useTripStore.setState({ currentCity: null })}>
               <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg">
                  <Globe className="text-emerald-600 dark:text-emerald-400" size={20} />
               </div>
               <div>
                 <h1 className="text-lg font-bold leading-none dark:text-white">TravelBuddy</h1>
                 <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                   <MapPin size={10} /> {currentCity}
                 </div>
               </div>
             </div>
             
             <div className="flex items-center gap-2">
                <button 
                  onClick={toggleDarkMode} 
                  className="p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  title="Toggle Dark Mode"
                >
                  {settings.darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
               {!isOffline && (
                 <button 
                  onClick={handleDownloadMap} 
                  disabled={mapDownloadProgress !== null}
                  className="p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl relative transition-colors"
                  title="Download Offline Map"
                 >
                   {mapDownloadProgress === 100 ? (
                     <CheckCircle size={18} className="text-emerald-500" />
                   ) : mapDownloadProgress !== null ? (
                     <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                   ) : (
                     <DownloadCloud size={18} />
                   )}
                 </button>
               )}
               <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-500">
                 <X />
               </button>
             </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl">
            {[
              { id: ViewMode.EXPLORE, icon: Search, label: 'Explore' },
              { id: ViewMode.ITINERARY, icon: Calendar, label: 'Plan' },
              { id: ViewMode.JOURNAL, icon: BookOpen, label: 'Journal' },
              { id: ViewMode.SAVED, icon: Bookmark, label: 'Saved' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setViewMode(tab.id as ViewMode); setShowChat(false); setSelectedPlaceId(undefined); }}
                className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2 text-[10px] md:text-sm font-bold rounded-xl transition-all duration-200 ${!showChat && viewMode === tab.id ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
              >
                <tab.icon size={16} strokeWidth={2.5} />
                <span>{tab.label}</span>
              </button>
            ))}
             <button
                onClick={() => setShowChat(true)}
                className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2 text-[10px] md:text-sm font-bold rounded-xl transition-all duration-200 ${showChat ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
              >
                <MessageCircle size={16} strokeWidth={2.5} />
                <span>AI Chat</span>
              </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth pb-24 bg-slate-50/50 dark:bg-slate-900">
          
          {selectedPlace ? (
             <PlaceDetailView 
                place={selectedPlace} 
                onBack={() => setSelectedPlaceId(undefined)}
                onAdd={(p) => { addToItinerary(p, 'day-1'); setViewMode(ViewMode.ITINERARY); setSelectedPlaceId(undefined); }}
                onBookmark={toggleBookmark}
                isBookmarked={bookmarks.some(b => b.id === selectedPlace.id)}
             />
          ) : (
            <div className="p-5">
              {/* VIEW: CHAT */}
              {showChat && (
                <div className="flex flex-col h-[calc(100vh-180px)]">
                   <div className="flex-1 space-y-4 mb-4 overflow-y-auto pr-2">
                     {chatMessages.map((msg, idx) => (
                       <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                          <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
                            {msg.text}
                          </div>
                       </div>
                     ))}
                     {isChatLoading && (
                       <div className="flex justify-start">
                         <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-none p-4 flex gap-1.5 items-center shadow-sm">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"/>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"/>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"/>
                         </div>
                       </div>
                     )}
                     <div ref={chatEndRef} />
                   </div>
                   <form onSubmit={handleChatSubmit} className="relative shrink-0">
                     <input 
                        type="text" 
                        placeholder="Ask for tips, food, or plans..." 
                        className="w-full pl-5 pr-12 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white shadow-sm"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        disabled={isChatLoading}
                     />
                     <button type="submit" className="absolute right-2 top-2 p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors">
                       <Send size={18} />
                     </button>
                   </form>
                </div>
              )}

              {/* VIEW: EXPLORE */}
              {!showChat && viewMode === ViewMode.EXPLORE && (
                <div className="space-y-6">
                  {/* Search Bar */}
                  <div className="sticky top-0 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 pb-2">
                    <form onSubmit={handlePlaceSearch} className="relative group">
                      <input
                        type="text"
                        placeholder={`Search ${currentCity}...`}
                        className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white shadow-sm transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                    </form>

                    {/* Categories Pills */}
                    <div className="flex gap-3 overflow-x-auto pb-2 pt-4 scrollbar-hide -mx-5 px-5">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => handleCategoryClick(cat)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap text-sm font-bold border transition-all duration-200 ${activeCategory === cat.id ? 'bg-emerald-600 text-white border-emerald-600 shadow-md transform scale-105' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500'}`}
                        >
                          <cat.icon size={16} />
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {isLoading && (
                    <div className="space-y-4">
                       {[1,2,3].map(i => (
                         <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 h-32 animate-pulse flex gap-4 border border-slate-100 dark:border-slate-700">
                           <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-lg h-full" />
                           <div className="flex-1 space-y-3 py-2">
                              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full mt-auto" />
                           </div>
                         </div>
                       ))}
                    </div>
                  )}

                  <div className="grid gap-4">
                    {searchResults.map((place, idx) => (
                      <div key={place.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                        <PlaceCard 
                          place={place} 
                          onAdd={() => addToItinerary(place, activeDayId)} 
                          onBookmark={toggleBookmark}
                          isBookmarked={bookmarks.some(b => b.id === place.id)}
                          onClick={() => { setSelectedPlaceId(place.id); useTripStore.setState({ center: [place.lat, place.lng] }); }}
                        />
                      </div>
                    ))}
                    {!isLoading && searchResults.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 opacity-60 text-center">
                        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-4">
                           <MapIcon size={48} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-slate-800 dark:text-white font-bold text-lg">Let's explore!</h3>
                        <p className="text-slate-500 max-w-xs mt-1">Tap a category above or search for hidden gems.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW: ITINERARY */}
              {!showChat && viewMode === ViewMode.ITINERARY && (
                <div className="space-y-5">
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {itinerary.map(day => (
                      <button 
                        key={day.id}
                        onClick={() => setActiveDayId(day.id)}
                        className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${activeDayId === day.id ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                      >
                        {day.title}
                      </button>
                    ))}
                    <button onClick={addDay} className="px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-500 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:text-emerald-500 transition-colors">
                      <Plus size={18} />
                    </button>
                  </div>

                  <BudgetOverview itinerary={itinerary} totalBudget={totalTripBudget} />
                  
                  <div className="flex justify-between items-center text-xs font-medium text-slate-500 dark:text-slate-400 px-1">
                    <button onClick={handleShareItinerary} className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Share2 size={14}/> Share Plan
                    </button>
                    <button onClick={() => { setEditingBudget(true); setNewBudget(totalTripBudget.toString()); }} className="hover:text-emerald-500 transition-colors bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      Edit Budget
                    </button>
                  </div>

                  {editingBudget && (
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in">
                          <Wallet size={16} className="text-emerald-500" />
                          <input 
                            type="number" 
                            value={newBudget} 
                            onChange={(e) => setNewBudget(e.target.value)}
                            className="flex-1 text-sm p-1 bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-none focus:border-emerald-500 dark:text-white"
                            placeholder="Set amount..."
                            autoFocus
                          />
                          <button onClick={() => { setTotalBudget(parseFloat(newBudget) || 0); setEditingBudget(false); }} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold">Save</button>
                      </div>
                  )}

                  {itinerary.map(day => (
                    day.id === activeDayId && (
                    <div 
                      key={day.id} 
                      className="min-h-[400px] animate-in slide-in-from-right-4 duration-300"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { if (draggingItem && draggingItem.dayId !== day.id && day.items.length === 0) handleDrop(e, day.id, 0); }}
                    >
                        <div className="flex justify-between items-center mb-4 px-1">
                           <h3 className="font-bold text-slate-700 dark:text-slate-200 text-lg">{day.title} Schedule</h3>
                           <button onClick={() => removeDay(day.id)} disabled={itinerary.length === 1} className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16}/></button>
                        </div>

                        <div className="space-y-3 pb-10">
                          {day.items.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50">
                              <Calendar size={32} className="mb-2 opacity-50" />
                              <p className="font-medium text-sm">Your day is empty.</p>
                              <button onClick={() => setViewMode(ViewMode.EXPLORE)} className="mt-3 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:underline">
                                Browse Places to Add
                              </button>
                            </div>
                          )}
                          {day.items.map((item, idx) => (
                              <div key={`${item.id}-${idx}`} className="relative group">
                                {/* Connector Line */}
                                {idx !== day.items.length - 1 && (
                                  <div className="absolute left-6 top-10 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 -z-10 h-[calc(100%+12px)]" />
                                )}
                                <PlaceCard 
                                  place={item} 
                                  compact 
                                  isItineraryMode 
                                  onRemove={(id) => removeFromItinerary(day.id, id)}
                                  onUpdateCost={(id, cost) => updateItineraryItem(day.id, id, { cost })}
                                  onUpdateNotes={(id, notes) => updateItineraryItem(day.id, id, { notes })}
                                  onUpdateTime={(id, updates) => updateItineraryItem(day.id, id, updates)}
                                  onClick={() => { setSelectedPlaceId(item.id); useTripStore.setState({ center: [item.lat, item.lng] }); }}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, day.id, idx)}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => handleDrop(e, day.id, idx)}
                                />
                              </div>
                          ))}
                        </div>
                    </div>
                    )
                  ))}
                </div>
              )}

              {/* VIEW: JOURNAL (Redesigned Timeline) */}
              {!showChat && viewMode === ViewMode.JOURNAL && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 bg-white/10 w-32 h-32 rounded-full blur-2xl" />
                    <div className="relative z-10">
                      <h2 className="text-2xl font-black flex items-center gap-2"><BookOpen size={28} /> Travel Journal</h2>
                      <p className="text-white/80 text-sm mt-1">Your personal timeline of memories.</p>
                    </div>
                  </div>

                  <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 space-y-10 pl-8 py-2">
                    {itinerary.flatMap(d => d.items).map((item, index) => (
                      <div key={item.id} className="relative animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                        {/* Timeline Dot */}
                        <span className={`absolute -left-[41px] top-6 w-5 h-5 rounded-full border-4 border-white dark:border-slate-900 shadow-sm ${item.journal ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                        
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-0 shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow">
                           {/* Item Header */}
                           <div className="p-4 flex gap-4 items-start">
                             <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-xl shrink-0 overflow-hidden">
                                <img src={item.photos?.[0] || "https://via.placeholder.com/100"} className="w-full h-full object-cover" loading="lazy" />
                             </div>
                             <div className="flex-1 min-w-0">
                               <div className="flex justify-between items-start">
                                 <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate text-lg">{item.name}</h3>
                                 <button onClick={() => { setJournalTargetPlace(item); setJournalModalOpen(true); }} className="text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-2 rounded-lg transition-colors">
                                   <Edit2 size={16} />
                                 </button>
                               </div>
                               
                               {item.journal ? (
                                 <div className="mt-2">
                                   <div className="flex items-center gap-1 mb-1">
                                     {Array.from({ length: item.journal.rating || 0 }).map((_, i) => (
                                       <Star key={i} size={12} className="text-yellow-400 fill-yellow-400" />
                                     ))}
                                   </div>
                                   <p className="text-sm text-slate-600 dark:text-slate-300 italic line-clamp-3">"{item.journal.text}"</p>
                                   {item.journal.photos && item.journal.photos.length > 0 && (
                                     <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
                                       {item.journal.photos.map((p, i) => (
                                         <img key={i} src={p} className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-600" />
                                       ))}
                                     </div>
                                   )}
                                   <p className="text-[10px] text-slate-400 mt-2">{new Date(item.journal.date).toLocaleDateString()}</p>
                                 </div>
                               ) : (
                                 <div className="mt-2 text-sm text-slate-400 flex items-center gap-2 cursor-pointer hover:text-indigo-500 transition-colors" onClick={() => { setJournalTargetPlace(item); setJournalModalOpen(true); }}>
                                   <Plus size={14} /> Add a memory
                                 </div>
                               )}
                             </div>
                           </div>
                        </div>
                      </div>
                    ))}
                    {itinerary.flatMap(d => d.items).length === 0 && (
                      <div className="text-slate-400 text-sm italic py-4">
                        Add places to your itinerary to start journaling!
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW: SAVED */}
              {!showChat && viewMode === ViewMode.SAVED && (
                <div className="space-y-4">
                    <h2 className="text-xl font-black dark:text-white px-1">Your Bookmarks</h2>
                    <div className="grid gap-4">
                      {bookmarks.map(place => (
                        <PlaceCard 
                          key={place.id} 
                          place={place} 
                          onAdd={() => addToItinerary(place, activeDayId)} 
                          onBookmark={toggleBookmark}
                          isBookmarked={true}
                          onClick={() => { setSelectedPlaceId(place.id); useTripStore.setState({ center: [place.lat, place.lng] }); }}
                        />
                      ))}
                      {bookmarks.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                          <Bookmark size={40} className="mx-auto mb-2 opacity-50" />
                          <p>No saved places yet.</p>
                        </div>
                      )}
                    </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative h-full bg-slate-100 dark:bg-slate-900 transition-colors duration-300">
         <MapComponent 
            center={center} 
            places={viewMode === ViewMode.EXPLORE ? searchResults : viewMode === ViewMode.SAVED ? bookmarks : []}
            itineraryItems={viewMode === ViewMode.ITINERARY || viewMode === ViewMode.JOURNAL ? itinerary.flatMap(d => d.items) : []}
            selectedPlaceId={selectedPlaceId}
            onMarkerClick={(p) => setSelectedPlaceId(p.id)}
            showRoute={viewMode === ViewMode.ITINERARY}
            darkMode={settings.darkMode}
         />
         {!isSidebarOpen && (
           <button 
             onClick={() => setIsSidebarOpen(true)}
             className="absolute top-4 left-4 z-[1000] bg-white dark:bg-slate-800 p-3 rounded-full shadow-lg text-slate-700 dark:text-slate-200 hover:scale-110 transition-transform"
           >
             <Menu />
           </button>
         )}
      </div>

      {/* Modals */}
      {journalModalOpen && journalTargetPlace && (
        <JournalEntryModal 
          place={journalTargetPlace}
          initialEntry={journalTargetPlace.journal}
          onSave={(entry) => updateJournalEntry(journalTargetPlace.id, entry)}
          onClose={() => setJournalModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
