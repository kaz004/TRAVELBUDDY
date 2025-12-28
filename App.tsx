
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useTripStore } from './store';
import { Place, ViewMode, ItineraryItem, Track } from './types';
import { searchPlacesWithGemini, suggestCityCenter, getLocalMusicVibes } from './services/geminiService';
import { getTilesForArea, fetchAndCacheTile, getTile } from './services/offlineMapService';
import { getRegionalPlaylist } from './services/spotifyService';
import MapComponent from './components/MapComponent';
import PlaceCard from './components/PlaceCard';
import PlaceDetailView from './components/PlaceDetailView';
import BudgetOverview from './components/BudgetOverview';
import JournalEntryModal from './components/JournalEntryModal';
import MusicPlayer from './components/MusicPlayer';
import { 
  Search, MapPin, Calendar, Menu, Plus, X, 
  Bookmark, MapIcon, Sparkles, MessageCircle, Send,
  DownloadCloud, BookOpen, Edit2, Trash2, Globe,
  Utensils, ShoppingBag, TreePine, Camera, Coffee, 
  Layers, Volume2, Mic, User, UserPlus, CheckCircle, 
  Music as MusicIcon, Play, Pause, SkipForward, Disc, WifiOff,
  ChevronRight, RefreshCw
} from './components/Icons';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";

// --- Audio Utility Functions ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const CATEGORIES = [
  { id: 'attraction', label: 'Sights', icon: Camera, prompt: 'top tourist attractions and must-see sights' },
  { id: 'food', label: 'Food', icon: Utensils, prompt: 'best local restaurants and street food' },
  { id: 'nature', label: 'Nature', icon: TreePine, prompt: 'parks, gardens, and nature spots' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, prompt: 'shopping malls and local markets' },
  { id: 'cafe', label: 'Cafes', icon: Coffee, prompt: 'cozy cafes and coffee shops' },
];

const LOADING_STEPS = [
  "Negotiating with local guides...",
  "Consulting hidden gem experts...",
  "Checking the local weather vibes...",
  "Tuning into regional frequencies...",
  "Mapping out your adventure...",
  "Packing your virtual bags..."
];

function App() {
  const { 
    currentCity, center, searchResults, itinerary, bookmarks, isLoading, error, settings, mapDownloadProgress,
    setCity, setSearchResults, addToItinerary, removeFromItinerary, updateItineraryItem, 
    toggleBookmark, setLoading, setError, setOffline, setMapDownloadProgress,
    updateJournalEntry, setMapStyle, addDay, removeDay, setTravelMode, setTeamSize,
    currentTrack, isPlaying, playlist, regionalTracks, playTrack, setPlaying, setRegionalTracks, resetTrip
  } = useTripStore();

  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.EXPLORE);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>(undefined);
  const [activeDayId, setActiveDayId] = useState<string>('day-1');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [journalTargetPlace, setJournalTargetPlace] = useState<ItineraryItem | null>(null);
  const [audioStatus, setAudioStatus] = useState<string>('');
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);

  // --- Music Engine ---
  const globalAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (currentCity && regionalTracks.length === 0) {
      const fetchVibes = async () => {
        const vibes = await getLocalMusicVibes(currentCity);
        const tracks = await getRegionalPlaylist(vibes);
        setRegionalTracks(tracks);
      };
      fetchVibes();
    }
  }, [currentCity]);

  useEffect(() => {
    const updateSrc = async () => {
      if (currentTrack && globalAudioRef.current) {
        setAudioStatus('Syncing...');
        setPlaybackProgress(0);
        let url = currentTrack.previewUrl;
        
        try {
          const cached = await getTile(`track_${currentTrack.id}`);
          if (cached) {
            url = URL.createObjectURL(cached);
          }
        } catch (e) {
          console.warn("Cache check failed", e);
        }
        
        if (url) {
          globalAudioRef.current.src = url;
          globalAudioRef.current.load();
          if (isPlaying) {
            const playPromise = globalAudioRef.current.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => setAudioStatus(''))
                .catch((e) => {
                  console.error("Playback error:", e);
                  setAudioStatus('Tap to play');
                  setPlaying(false);
                });
            }
          } else {
            setAudioStatus('');
          }
        } else {
          setAudioStatus('Source error');
        }
      }
    };
    updateSrc();
  }, [currentTrack]);

  useEffect(() => {
    if (globalAudioRef.current) {
      if (isPlaying) {
        globalAudioRef.current.play().catch(() => {
          setAudioStatus('Tap to play');
          setPlaying(false);
        });
      } else {
        globalAudioRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = globalAudioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleError = () => {
      console.warn("Audio error encountered, skipping...");
      handleMusicSkip();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
    };
  }, [currentTrack]);

  // Loading Cycle Logic
  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
      }, 2000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleMusicSkip = () => {
    const list = playlist.length > 0 ? playlist : regionalTracks;
    if (list.length === 0) return;
    const currentIndex = list.findIndex(t => t.id === currentTrack?.id);
    let nextIndex = currentIndex + 1;
    if (nextIndex >= list.length) nextIndex = 0;
    playTrack(list[nextIndex]);
  };

  const forceStartAudio = () => {
    if (globalAudioRef.current) {
      globalAudioRef.current.play().then(() => {
        setPlaying(true);
        setAudioStatus('');
      }).catch(e => console.error(e));
    }
  };

  // --- Live Chat State ---
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [streamingModelText, setStreamingModelText] = useState('');
  const [streamingUserText, setStreamingUserText] = useState('');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<any>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef({ user: '', model: '' });

  useEffect(() => {
    if (settings.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [settings.darkMode]);

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

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, streamingModelText, streamingUserText, showChat]);

  // --- Area Download Logic ---
  const handleDownloadArea = async () => {
    if (!currentCity || mapDownloadProgress !== null) return;
    
    setMapDownloadProgress(0);
    const tiles = getTilesForArea(center[0], center[1]);
    let completed = 0;

    for (const tile of tiles) {
      await fetchAndCacheTile(tile.url, tile.key);
      completed++;
      setMapDownloadProgress(Math.round((completed / tiles.length) * 100));
    }

    setTimeout(() => setMapDownloadProgress(null), 2000);
  };

  // --- Live API Logic ---
  const stopAllPlayback = () => {
    activeSourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
  };

  const connectLiveChat = async () => {
    if (sessionRef.current || isConnecting) return;
    
    setIsConnecting(true);
    setChatMessages([]);
    setStreamingModelText('');
    setStreamingUserText('');

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    }
    const outputCtx = audioContextRef.current;
    if (outputCtx.state === 'suspended') {
      await outputCtx.resume();
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const travelContext = settings.travelMode === 'team' 
      ? `traveling with a group of ${settings.teamSize} people` 
      : 'traveling solo';

    const sessionPromise = ai.live.connect({
      model: 'gemini-native-audio-latest',
      callbacks: {
        onopen: () => {
          setIsLiveConnected(true);
          setIsConnecting(false);
          sessionPromise.then(s => {
            s.sendRealtimeInput({ text: `Hey! I'm TravelBuddy, your high-energy local guide here in ${currentCity}. I know you're ${travelContext}. Start talking immediately and give me a super enthusiastic, short greeting that fits my travel style!` });
          });
        },
        onmessage: async (message: LiveServerMessage) => {
          const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioData) {
            setIsSpeaking(true);
            if (outputCtx.state === 'suspended') await outputCtx.resume();
            const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
            const source = outputCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputCtx.destination);
            const now = outputCtx.currentTime;
            if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            activeSourcesRef.current.add(source);
            source.onended = () => {
              activeSourcesRef.current.delete(source);
              if (activeSourcesRef.current.size === 0) setIsSpeaking(false);
            };
          }
          if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            transcriptRef.current.user += text;
            setStreamingUserText(prev => prev + text);
          }
          if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            transcriptRef.current.model += text;
            setStreamingModelText(prev => prev + text);
          }
          if (message.serverContent?.turnComplete) {
            const finalUserText = transcriptRef.current.user.trim();
            const finalModelText = transcriptRef.current.model.trim();
            setChatMessages(prev => {
              const updated = [...prev];
              if (finalUserText && isMicOn) updated.push({ role: 'user', text: finalUserText });
              if (finalModelText) updated.push({ role: 'model', text: finalModelText });
              return updated;
            });
            setStreamingModelText('');
            setStreamingUserText('');
            transcriptRef.current.user = '';
            transcriptRef.current.model = '';
          }
          if (message.serverContent?.interrupted) {
            stopAllPlayback();
            setStreamingModelText('');
            setStreamingUserText('');
            transcriptRef.current.user = '';
            transcriptRef.current.model = '';
          }
        },
        onclose: () => {
          setIsLiveConnected(false);
          setIsConnecting(false);
          sessionRef.current = null;
          sessionPromiseRef.current = null;
        },
        onerror: (e) => {
          console.error("Live API Error:", e);
          setIsConnecting(false);
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
        },
        systemInstruction: `You are TravelBuddy, a joyful, high-energy local guide for ${currentCity}. The user is ${travelContext}. Talk like a real friend—spontaneous, witty, and opinionated. Keep responses snappy and fun!`,
        outputAudioTranscription: {},
        inputAudioTranscription: {}
      }
    });
    sessionPromiseRef.current = sessionPromise;
    sessionRef.current = await sessionPromise;
  };

  const disconnectLiveChat = () => {
    stopAllPlayback();
    if (sessionRef.current) { sessionRef.current.close(); sessionRef.current = null; }
    sessionPromiseRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setIsMicOn(false);
    setIsLiveConnected(false);
    setIsConnecting(false);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !sessionPromiseRef.current) return;
    const userMsg = chatInput;
    setChatInput('');
    transcriptRef.current.user = '';
    setStreamingUserText('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
    nextStartTimeRef.current = 0;
    sessionPromiseRef.current.then(session => {
      session.sendRealtimeInput({ text: userMsg });
    });
  };

  const toggleMic = async () => {
    if (!isMicOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        if (isSpeaking) stopAllPlayback();
        const inputCtx = new AudioContext({ sampleRate: 16000 });
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then((session) => {
              session.sendRealtimeInput({ media: createBlob(inputData) });
            });
          }
        };
        source.connect(processor);
        processor.connect(inputCtx.destination);
        setIsMicOn(true);
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
      } catch (err) {
        alert("Microphone access is required!");
      }
    } else {
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      setIsMicOn(false);
      setStreamingUserText('');
      transcriptRef.current.user = '';
    }
  };

  useEffect(() => {
    if (showChat) connectLiveChat();
    else disconnectLiveChat();
    return () => disconnectLiveChat();
  }, [showChat, currentCity, settings.travelMode, settings.teamSize]);

  // --- Handlers ---
  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityInput.trim() || settings.offlineMode) return;
    setLoading(true);
    try {
      const coords = await suggestCityCenter(cityInput);
      setCity(cityInput, coords);
      setCityInput('');
    } catch (e) { setError("City not found."); }
    finally { setLoading(false); }
  };

  const handlePlaceSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || settings.offlineMode) return;
    setLoading(true);
    setError(null);
    try {
      const places = await searchPlacesWithGemini(searchQuery, currentCity || '');
      setSearchResults(places);
      if (places.length > 0) useTripStore.setState({ center: [places[0].lat, places[0].lng] });
    } catch (err) { setError("Search failed."); }
    finally { setLoading(false); }
  };

  const handleCategoryClick = async (category: any) => {
    if (settings.offlineMode) return;
    setActiveCategory(category.id);
    setSearchQuery(category.label);
    setLoading(true);
    setError(null);
    try {
      const places = await searchPlacesWithGemini(category.prompt, currentCity || '');
      setSearchResults(places);
      if (places.length > 0) useTripStore.setState({ center: [places[0].lat, places[0].lng] });
    } catch (err) { setError("Category fetch failed."); }
    finally { setLoading(false); }
  };

  const selectedPlace = selectedPlaceId 
    ? [...searchResults, ...bookmarks, ...itinerary.flatMap(d => d.items)].find(p => p.id === selectedPlaceId)
    : null;

  if (!currentCity) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021')] bg-cover bg-center opacity-40 animate-[pulse_15s_infinite]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-slate-900/60 to-slate-900" />
        <div className="z-10 bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-3xl max-w-lg w-full shadow-2xl text-center">
          <Globe className="text-emerald-400 mx-auto mb-6" size={64} />
          <h1 className="text-5xl font-black text-white mb-3">Travel<span className="text-emerald-400">Buddy</span></h1>
          <p className="text-lg text-slate-300 mb-8">AI-powered guide to the world.</p>
          <form onSubmit={handleCitySearch} className="relative mb-4">
            <input type="text" placeholder="Where to next?" className="w-full pl-6 pr-14 py-5 bg-white/10 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white font-medium" value={cityInput} onChange={(e) => setCityInput(e.target.value)} />
            <button type="submit" className="absolute right-3 top-3 p-2.5 bg-emerald-500 text-white rounded-xl shadow-lg hover:scale-105 transition-transform" disabled={isLoading}>{isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Search size={24} />}</button>
          </form>
          <button onClick={() => { setCity('Paris', [48.8566, 2.3522]); }} className="text-xs font-bold text-slate-400 hover:text-emerald-400 flex items-center gap-1 mx-auto transition-colors"><RefreshCw size={12}/> Stuck? Try Paris</button>
          {error && <div className="mt-4 text-red-400 font-bold">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-800 dark:text-slate-200">
      <audio ref={globalAudioRef} onEnded={handleMusicSkip} />
      
      <div className={`fixed md:relative z-20 h-full bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 flex flex-col border-r dark:border-slate-800 ${isSidebarOpen ? 'w-[100vw] md:w-[450px]' : 'w-0 overflow-hidden'}`}>
        <div className="px-5 py-4 border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-3 cursor-pointer group" onClick={() => resetTrip()}>
               <Globe className="text-emerald-500 group-hover:rotate-12 transition-transform" size={24} />
               <div>
                 <h1 className="text-lg font-bold dark:text-white">TravelBuddy</h1>
                 <div className="text-xs text-slate-500 font-medium flex items-center gap-1"><MapPin size={10} /> {currentCity}</div>
               </div>
             </div>
             <div className="flex gap-2">
                <button onClick={handleDownloadArea} title="Download Area for Offline Use" className={`p-2 rounded-lg transition-all ${mapDownloadProgress !== null ? 'bg-emerald-50 text-emerald-600 animate-pulse' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  {mapDownloadProgress === 100 ? <CheckCircle size={20} className="text-emerald-500" /> : <DownloadCloud size={20} />}
                </button>
                <button onClick={() => setMapStyle(settings.mapStyle === 'voyager' ? 'satellite' : 'voyager')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><Layers size={20} /></button>
                <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2"><X /></button>
             </div>
          </div>
          
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
            {[{ id: ViewMode.EXPLORE, icon: Search, label: 'Explore' }, { id: ViewMode.ITINERARY, icon: Calendar, label: 'Plan' }, { id: ViewMode.MUSIC, icon: MusicIcon, label: 'Music' }, { id: ViewMode.SAVED, icon: Bookmark, label: 'Saved' }].map(tab => (
              <button key={tab.id} onClick={() => { setViewMode(tab.id as ViewMode); setShowChat(false); }} className={`flex-1 flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase rounded-xl transition-all ${!showChat && viewMode === tab.id ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400'}`}>
                <tab.icon size={16} /><span className="mt-1">{tab.label}</span>
              </button>
            ))}
             <button onClick={() => { setShowChat(true); if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume(); }} className={`flex-1 flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase rounded-xl transition-all ${showChat ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400'}`}>
                <MessageCircle size={16} /><span className="mt-1">Live</span>
              </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-4 bg-slate-50/50 dark:bg-slate-900">
          {selectedPlace ? (
             <PlaceDetailView place={selectedPlace} onBack={() => setSelectedPlaceId(undefined)} onAdd={(p) => addToItinerary(p, activeDayId)} onBookmark={toggleBookmark} isBookmarked={bookmarks.some(b => b.id === selectedPlace.id)} />
          ) : (
            <div className="p-5 h-full flex flex-col min-h-0 animate-in fade-in slide-in-from-left-2 duration-300">
              {showChat ? (
                <div className="flex flex-col flex-1 h-full min-h-0">
                   <div className="flex-1 space-y-4 mb-4 overflow-y-auto pr-2 scrollbar-hide">
                     {isConnecting && (
                        <div className="flex justify-start animate-pulse">
                          <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                            <Sparkles className="text-emerald-500" size={18} />
                            <span className="text-sm font-bold text-slate-500">Connecting...</span>
                          </div>
                        </div>
                     )}
                     {chatMessages.map((msg, idx) => (
                       <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                          <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-md ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 dark:text-slate-200 rounded-bl-none border dark:border-slate-700'}`}>{msg.text}</div>
                       </div>
                     ))}
                     {streamingModelText && (
                        <div className="flex justify-start animate-in slide-in-from-bottom-2">
                           <div className="max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-md bg-white dark:bg-slate-800 dark:text-slate-200 rounded-bl-none border dark:border-slate-700">
                              {streamingModelText}
                              <span className="inline-block w-1.5 h-4 ml-1 bg-emerald-500 animate-pulse align-middle" />
                           </div>
                        </div>
                     )}
                     <div ref={chatEndRef} />
                   </div>
                   <form onSubmit={handleChatSubmit} className="relative flex gap-2">
                     <input type="text" placeholder="Ask your local buddy..." className="flex-1 pl-5 pr-12 py-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none shadow-lg transition-all" value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
                     <div className="absolute right-2 top-2 flex gap-1">
                        <button type="button" onClick={toggleMic} className={`p-2.5 rounded-xl transition-all ${isMicOn ? 'text-red-500 bg-red-50' : 'text-slate-400'}`}><Mic size={22} /></button>
                        <button type="submit" className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md hover:bg-emerald-700 transition-colors"><Send size={22} /></button>
                     </div>
                   </form>
                </div>
              ) : viewMode === ViewMode.EXPLORE ? (
                <div className="space-y-6">
                   <form onSubmit={handlePlaceSearch} className="relative">
                      <input type="text" placeholder={`What are we looking for in ${currentCity}?`} className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 dark:text-white shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                      <Search className="absolute left-4 top-4 text-slate-400" size={20} />
                    </form>
                    
                    {/* Settings Quick Access - Restore Solo/Team */}
                    <div className="flex gap-4 items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700 shadow-sm">
                       <button onClick={() => setTravelMode(settings.travelMode === 'solo' ? 'team' : 'solo')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase transition-all ${settings.travelMode === 'solo' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          {settings.travelMode === 'solo' ? <User size={14}/> : <UserPlus size={14}/>} {settings.travelMode}
                       </button>
                       {settings.travelMode === 'team' && (
                         <div className="flex items-center gap-2">
                           <button onClick={() => setTeamSize(settings.teamSize - 1)} className="p-1 hover:bg-slate-100 rounded">-</button>
                           <span className="text-xs font-bold w-4 text-center">{settings.teamSize}</span>
                           <button onClick={() => setTeamSize(settings.teamSize + 1)} className="p-1 hover:bg-slate-100 rounded">+</button>
                         </div>
                       )}
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5">
                      {CATEGORIES.map(cat => (
                        <button key={cat.id} onClick={() => handleCategoryClick(cat)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap text-sm font-bold border ${activeCategory === cat.id ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white dark:bg-slate-800 dark:border-slate-700 hover:border-emerald-500'}`}>
                          <cat.icon size={16} />{cat.label}
                        </button>
                      ))}
                    </div>
                    
                    <div className="grid gap-4">
                      {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center animate-in fade-in duration-500">
                          <div className="relative mb-10 group">
                            <div className="w-24 h-24 border-4 border-emerald-100 dark:border-emerald-900/50 rounded-full" />
                            <div className="absolute inset-0 w-24 h-24 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            <Sparkles className="absolute inset-0 m-auto text-emerald-500 animate-pulse" size={32} />
                          </div>
                          
                          <div className="max-w-[280px] w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-6 shadow-inner">
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                              style={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
                            />
                          </div>
                          
                          <div className="h-6 overflow-hidden">
                            <p className="text-sm font-black text-slate-600 dark:text-emerald-400 uppercase tracking-widest animate-in slide-in-from-bottom-2 duration-300">
                              {LOADING_STEPS[loadingStep]}
                            </p>
                          </div>
                          
                          <div className="mt-12 w-full space-y-4 px-2">
                             {[1,2,3].map(i => (
                               <div key={i} className="bg-white/40 dark:bg-slate-800/40 rounded-3xl h-24 w-full flex items-center p-4 gap-4 animate-pulse border border-slate-100 dark:border-slate-700/50">
                                 <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
                                 <div className="flex-1 space-y-2">
                                   <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-3/4" />
                                   <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-1/2" />
                                 </div>
                               </div>
                             ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          {searchResults.map(place => (
                            <PlaceCard key={place.id} place={place} onAdd={() => addToItinerary(place, activeDayId)} onBookmark={toggleBookmark} isBookmarked={bookmarks.some(b => b.id === selectedPlace?.id)} onClick={() => { setSelectedPlaceId(place.id); useTripStore.setState({ center: [place.lat, place.lng] }); }} />
                          ))}
                          {searchResults.length === 0 && (
                            <div className="text-center py-20 opacity-40">
                              <Sparkles size={48} className="mx-auto mb-4 text-emerald-400" />
                              <p className="font-bold">Search above to start exploring!</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                </div>
              ) : viewMode === ViewMode.ITINERARY ? (
                <div className="space-y-4">
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {itinerary.map(day => (
                      <button key={day.id} onClick={() => setActiveDayId(day.id)} className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border ${activeDayId === day.id ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-800'}`}>{day.title}</button>
                    ))}
                    <button onClick={addDay} className="px-3 rounded-xl border border-dashed border-slate-300"><Plus size={18} /></button>
                  </div>
                  
                  {/* Restore Budget Breakdown */}
                  <BudgetOverview itinerary={itinerary} />
                  
                  {itinerary.find(d => d.id === activeDayId)?.items.map(item => (
                    <PlaceCard key={item.id} place={item} compact isItineraryMode onRemove={(id) => removeFromItinerary(activeDayId, id)} onUpdateCost={(id, cost) => updateItineraryItem(activeDayId, id, { cost })} onUpdateTime={(id, upd) => updateItineraryItem(activeDayId, id, upd)} />
                  ))}
                  {itinerary.find(d => d.id === activeDayId)?.items.length === 0 && <p className="text-center text-slate-400 italic py-12 bg-white/50 rounded-2xl border-2 border-dashed">No plans for this day yet.</p>}
                </div>
              ) : viewMode === ViewMode.MUSIC ? (
                <MusicPlayer />
              ) : (
                <div className="space-y-4">
                   <h2 className="text-lg font-black uppercase tracking-widest text-slate-400 mb-4 px-1">Your Saved Spots</h2>
                   <div className="grid gap-4">
                    {bookmarks.map(place => (
                        <PlaceCard key={place.id} place={place} onBookmark={toggleBookmark} isBookmarked={true} onAdd={() => addToItinerary(place, activeDayId)} />
                    ))}
                    {bookmarks.length === 0 && <p className="text-center text-slate-400 py-24">Nothing saved yet. Explore and hit the bookmark icon!</p>}
                   </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 relative h-full">
         <MapComponent center={center} places={searchResults} itineraryItems={itinerary.flatMap(d => d.items)} selectedPlaceId={selectedPlaceId} onMarkerClick={(p) => setSelectedPlaceId(p.id)} showRoute={viewMode === ViewMode.ITINERARY} darkMode={settings.darkMode} mapStyle={settings.mapStyle} />
         {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="absolute top-4 left-4 z-[1000] bg-white dark:bg-slate-800 p-3 rounded-full shadow-2xl hover:scale-110 transition-transform"><Menu /></button>}
         
         {/* Persistent Player */}
         {currentTrack && (
           <div 
             onClick={() => setViewMode(ViewMode.MUSIC)}
             className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1001] w-[90%] md:w-[420px] bg-slate-900/98 backdrop-blur-2xl border border-white/10 rounded-3xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4 cursor-pointer hover:bg-slate-800 transition-all group"
           >
              {audioStatus === 'Tap to play' && (
                <div className="absolute inset-0 bg-emerald-600/90 backdrop-blur-md rounded-3xl z-50 flex items-center justify-center gap-3 animate-in fade-in zoom-in" onClick={(e) => { e.stopPropagation(); forceStartAudio(); }}>
                  <Play size={20} fill="white" className="text-white" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">Resume Radio</span>
                </div>
              )}

              <div className="relative w-14 h-14 shrink-0 rounded-2xl overflow-hidden shadow-lg bg-slate-800">
                <img src={currentTrack.albumArt} className={`w-full h-full object-cover transition-transform ${isPlaying ? 'scale-110' : ''}`} />
                {isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="flex gap-1 items-end h-4">
                       {[0.4, 0.7, 0.5, 0.9, 0.6].map((h, i) => (
                         <div key={i} className="w-1 bg-emerald-400 animate-[bounce_1s_infinite]" style={{ height: `${h * 100}%`, animationDelay: `${i * 0.1}s` }} />
                       ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="overflow-hidden whitespace-nowrap">
                  <div className={`text-sm font-black text-white ${currentTrack.name.length > 20 ? 'group-hover:animate-[scroll_12s_linear_infinite]' : ''}`}>{currentTrack.name}</div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-slate-400 truncate font-bold uppercase tracking-tight">{currentTrack.artist}</p>
                  {audioStatus && audioStatus !== 'Tap to play' && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 rounded text-emerald-400 font-black uppercase tracking-tighter animate-pulse">{audioStatus}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 pr-1" onClick={e => e.stopPropagation()}>
                <button 
                  onClick={() => setPlaying(!isPlaying)}
                  className="p-3 bg-emerald-500 text-white rounded-full hover:scale-110 transition-all shadow-lg active:scale-90"
                >
                  {isPlaying ? <Pause size={22} fill="white" /> : <Play size={22} fill="white" className="ml-0.5" />}
                </button>
                <button onClick={handleMusicSkip} className="p-2 text-slate-400 hover:text-white transition-colors"><SkipForward size={22} /></button>
              </div>
              <div className="absolute bottom-0 left-0 h-1 bg-emerald-500/30 w-full overflow-hidden rounded-b-3xl">
                <div className="h-full bg-emerald-500 transition-all duration-[300ms] ease-linear" style={{ width: `${playbackProgress}%` }} />
              </div>
           </div>
         )}
      </div>

      {journalModalOpen && journalTargetPlace && (
        <JournalEntryModal place={journalTargetPlace} initialEntry={journalTargetPlace.journal} onSave={(entry) => updateJournalEntry(journalTargetPlace.id, entry)} onClose={() => setJournalModalOpen(false)} />
      )}
      
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(5%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}

export default App;
