
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useTripStore } from '../store';
import { Music, Play, Pause, SkipForward, SkipBack, Search, Plus, Trash2, Volume2, WifiOff, DownloadCloud, CheckCircle, Disc, Sparkles, X, ChevronRight } from './Icons';
import { searchTracks, getRegionalPlaylist } from '../services/spotifyService';
import { getLocalMusicVibes } from '../services/geminiService';
import { saveTile, getTile } from '../services/offlineMapService';

const MusicPlayer: React.FC = () => {
  const { currentCity, playlist, currentTrack, isPlaying, regionalTracks, 
          addToPlaylist, removeFromPlaylist, playTrack, setRegionalTracks, setPlaying } = useTripStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'playlist' | 'explore'>('explore');
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());

  // Check cache for offline availability
  useEffect(() => {
    const checkCache = async () => {
      const newCached = new Set<string>();
      const allPossibleTracks = [...playlist, ...regionalTracks, ...searchResults];
      for (const track of allPossibleTracks) {
        try {
          const cached = await getTile(`track_${track.id}`);
          if (cached) newCached.add(track.id);
        } catch (e) {}
      }
      setCachedIds(newCached);
    };
    checkCache();
  }, [playlist, regionalTracks, searchResults]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchTracks(searchQuery);
      setSearchResults(results);
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setIsSearching(false);
    }
  };

  const togglePlay = () => {
    if (currentTrack) {
      setPlaying(!isPlaying);
    } else {
      const list = activeTab === 'playlist' ? playlist : regionalTracks;
      if (list.length > 0) playTrack(list[0]);
    }
  };

  const handleSkip = (direction: 'next' | 'prev') => {
    const list = activeTab === 'playlist' ? playlist : (searchResults.length > 0 ? searchResults : regionalTracks);
    if (list.length === 0) return;
    
    const currentIndex = list.findIndex(t => t.id === currentTrack?.id);
    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    if (nextIndex >= list.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = list.length - 1;
    
    playTrack(list[nextIndex]);
  };

  const downloadTrack = async (track: any) => {
    if (!track.previewUrl || cachedIds.has(track.id)) return;
    
    setDownloadingIds(prev => new Set(prev).add(track.id));
    try {
      const response = await fetch(track.previewUrl);
      const blob = await response.blob();
      await saveTile(`track_${track.id}`, blob);
      setCachedIds(prev => new Set(prev).add(track.id));
      addToPlaylist({ ...track, isOffline: true });
    } catch (e) {
      console.error("Download failed", e);
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 overflow-hidden font-sans">
      {/* Immersive Audio Header */}
      <div className="bg-slate-900 p-8 flex flex-col items-center text-white relative overflow-hidden shrink-0 border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950" />
        <Disc className={`w-48 h-48 opacity-5 absolute -right-12 -top-12 transition-transform duration-[8000ms] linear infinite ${isPlaying ? 'animate-spin' : ''}`} size={240} />
        
        <div className="relative z-10 w-44 h-44 mb-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden ring-4 ring-white/5 group">
          <img 
            src={currentTrack?.albumArt || 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=2070'} 
            className={`w-full h-full object-cover transition-all duration-1000 ${isPlaying ? 'scale-110' : 'scale-100'}`}
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
             <button onClick={togglePlay} className="p-5 bg-white/20 rounded-full text-white ring-2 ring-white/50 hover:scale-110 transition-transform">
                {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" className="ml-1" />}
             </button>
          </div>
        </div>

        <div className="text-center relative z-10 max-w-full px-4">
          <h2 className="text-xl font-black truncate drop-shadow-lg">{currentTrack?.name || 'Vibing in ' + currentCity}</h2>
          <p className="text-emerald-400 font-black text-[10px] mt-2 uppercase tracking-[0.3em]">{currentTrack?.artist || 'Ready for adventure'}</p>
        </div>

        <div className="flex items-center gap-12 mt-8 relative z-10">
          <button onClick={() => handleSkip('prev')} className="p-2 text-white/40 hover:text-white transition-all"><SkipBack size={26} fill="currentColor" /></button>
          <button onClick={togglePlay} className="p-6 bg-emerald-500 text-white rounded-full shadow-[0_15px_35px_-10px_rgba(16,185,129,0.6)] hover:scale-110 transition-all active:scale-95">
             {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" className="ml-1" />}
          </button>
          <button onClick={() => handleSkip('next')} className="p-2 text-white/40 hover:text-white transition-all"><SkipForward size={26} fill="currentColor" /></button>
        </div>
      </div>

      {/* Discovery & Playlist Controls */}
      <div className="flex flex-col min-h-0 flex-1 bg-white dark:bg-slate-900 rounded-t-[40px] -mt-10 relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] overflow-hidden">
        <div className="flex p-5 gap-3 bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
           <button 
             onClick={() => setActiveTab('explore')}
             className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all ${activeTab === 'explore' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-400'}`}
           >
             <Search size={14} /> Explore
           </button>
           <button 
             onClick={() => setActiveTab('playlist')}
             className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all ${activeTab === 'playlist' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-400'}`}
           >
             <Music size={14} /> My Library
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-10 scrollbar-hide">
          {activeTab === 'explore' ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
              <form onSubmit={handleSearch} className="relative mb-8">
                <input 
                  type="text" 
                  placeholder="Artists, genres, podcasts..." 
                  className="w-full pl-12 pr-4 py-4.5 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 shadow-inner dark:text-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-4 top-4.5 text-slate-400" size={20} />
                {isSearching && <div className="absolute right-4 top-4.5 w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-4 mb-10">
                   <div className="flex items-center justify-between px-1">
                      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.25em]">Top Results</h3>
                      <button onClick={() => setSearchResults([])} className="text-[10px] font-bold text-emerald-500">Clear</button>
                   </div>
                   {searchResults.map(track => (
                     <TrackItem key={track.id} track={track} onPlay={() => playTrack(track)} onAdd={() => addToPlaylist(track)} onDownload={() => downloadTrack(track)} isDownloading={downloadingIds.has(track.id)} isCached={cachedIds.has(track.id)} />
                   ))}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2 px-1">
                   <h3 className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-[0.25em]">Vibes in {currentCity}</h3>
                   <Sparkles size={14} className="text-emerald-500 animate-pulse" />
                </div>
                {regionalTracks.map(track => (
                  <TrackItem key={track.id} track={track} onPlay={() => playTrack(track)} onAdd={() => addToPlaylist(track)} onDownload={() => downloadTrack(track)} isDownloading={downloadingIds.has(track.id)} isCached={cachedIds.has(track.id)} />
                ))}
                {regionalTracks.length === 0 && (
                  <div className="p-12 text-center text-slate-400 italic text-sm border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[32px] flex flex-col items-center gap-3">
                    <Disc size={32} className="animate-spin duration-[4000ms]" />
                    Finding local frequencies...
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-300">
               <div className="flex items-center gap-4 mb-8 bg-emerald-500/5 p-5 rounded-3xl border border-emerald-500/10">
                  <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <WifiOff size={28} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-white">Offline Music</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{playlist.length} tracks saved locally</p>
                  </div>
               </div>

               <div className="space-y-3">
                  {playlist.map(track => (
                    <TrackItem 
                      key={track.id} 
                      track={track} 
                      onPlay={() => playTrack(track)} 
                      onRemove={() => removeFromPlaylist(track.id)} 
                      isCached={cachedIds.has(track.id)}
                    />
                  ))}
                  {playlist.length === 0 && (
                    <div className="py-24 text-center text-slate-400 flex flex-col items-center">
                       <Music size={64} className="opacity-10 mb-6" />
                       <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Library Empty</p>
                       <p className="text-[11px] mt-2 max-w-[220px] leading-relaxed font-bold text-slate-400">Download songs from the Explore tab to build your perfect travel soundtrack.</p>
                       <button onClick={() => setActiveTab('explore')} className="mt-8 px-8 py-3.5 bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-xl hover:scale-105 transition-all">Start Listening</button>
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TrackItem: React.FC<{ 
  track: any, 
  onPlay: () => void, 
  onAdd?: () => void, 
  onRemove?: () => void,
  onDownload?: () => void,
  isDownloading?: boolean,
  isCached?: boolean
}> = ({ track, onPlay, onAdd, onRemove, onDownload, isDownloading, isCached }) => {
  const { currentTrack, isPlaying } = useTripStore();
  const isActive = currentTrack?.id === track.id;

  return (
    <div className={`flex items-center gap-4 p-3.5 rounded-3xl transition-all border border-transparent ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
       <div className="relative w-14 h-14 shrink-0 rounded-2xl overflow-hidden shadow-md group/art cursor-pointer" onClick={onPlay}>
          <img src={track.albumArt} className={`w-full h-full object-cover transition-transform ${isActive ? 'scale-110' : ''}`} />
          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover/art:opacity-100'}`}>
             {isActive && isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-0.5" />}
          </div>
       </div>
       <div className="flex-1 min-w-0 cursor-pointer" onClick={onPlay}>
          <h4 className={`text-sm font-black truncate ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>{track.name}</h4>
          <p className="text-[11px] text-slate-500 truncate font-black uppercase tracking-tight">{track.artist}</p>
       </div>
       <div className="flex items-center gap-1.5">
          {isCached ? (
            <div className="p-2 text-emerald-500" title="Offline Ready">
               <CheckCircle size={18} fill="currentColor" />
            </div>
          ) : (
            <>
              {onDownload && (
                <button 
                  onClick={onDownload} 
                  className={`p-2.5 rounded-xl transition-all ${isDownloading ? 'bg-emerald-100 text-emerald-500 animate-pulse' : 'text-slate-400 hover:text-emerald-500 hover:bg-white'}`}
                >
                  <DownloadCloud size={20} />
                </button>
              )}
              {onAdd && (
                <button 
                  onClick={onAdd} 
                  className="p-2.5 text-slate-400 hover:text-emerald-500 rounded-xl transition-all hover:bg-white"
                >
                  <Plus size={22} />
                </button>
              )}
            </>
          )}
          {onRemove && (
            <button onClick={onRemove} className="p-2.5 text-slate-400 hover:text-red-500 rounded-xl transition-all hover:bg-white"><Trash2 size={20} /></button>
          )}
       </div>
    </div>
  );
};

export default MusicPlayer;
