import * as React from 'react';
import { useState } from 'react';
import { Place } from '../types';
import { 
  X, MapPin, Star, Phone, Globe, Clock, Navigation, 
  Plus, Bookmark, Share2, ChevronLeft, ChevronRight 
} from './Icons';

interface PlaceDetailViewProps {
  place: Place;
  onBack: () => void;
  onAdd: (place: Place) => void;
  onBookmark: (place: Place) => void;
  isBookmarked: boolean;
}

const PlaceDetailView: React.FC<PlaceDetailViewProps> = ({ place, onBack, onAdd, onBookmark, isBookmarked }) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Generate mock photos if none exist
  const photos = place.photos && place.photos.length > 0 ? place.photos : [
    `https://picsum.photos/seed/${place.name.replace(/[^a-zA-Z0-9]/g, '')}/800/600`,
    `https://picsum.photos/seed/${place.name}2/800/600`,
    `https://picsum.photos/seed/${place.name}3/800/600`,
  ];

  const nextPhoto = () => setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  const prevPhoto = () => setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: place.name,
        text: `Check out ${place.name}!`,
        url: window.location.href
      }).catch(console.error);
    } else {
      alert("Sharing not supported on this device.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Top Image Carousel */}
      <div className="relative h-64 w-full shrink-0 group">
        <img 
          src={photos[currentPhotoIndex]} 
          alt={place.name} 
          className="w-full h-full object-cover"
        />
        
        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />

        {/* Navigation Buttons */}
        <button onClick={onBack} className="absolute top-4 left-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors z-10">
          <ChevronLeft size={24} />
        </button>

        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button onClick={handleShare} className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors">
            <Share2 size={20} />
          </button>
        </div>

        {/* Carousel Controls */}
        <button onClick={prevPhoto} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronLeft size={32} />
        </button>
        <button onClick={nextPhoto} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight size={32} />
        </button>

        {/* Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {photos.map((_, idx) => (
            <div 
              key={idx} 
              className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentPhotoIndex ? 'bg-white w-3' : 'bg-white/50'}`} 
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 pb-24">
        <div className="flex justify-between items-start mb-2">
           <h1 className="text-2xl font-black text-slate-800 leading-tight">{place.name}</h1>
           <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-1 rounded-md border border-emerald-100 uppercase tracking-wider shrink-0 ml-2">
             {place.category}
           </span>
        </div>

        <div className="flex items-center gap-1 text-yellow-500 mb-4">
           {Array.from({ length: 5 }).map((_, i) => (
             <Star key={i} size={16} className={i < Math.floor(place.rating) ? "fill-current" : "text-slate-300"} />
           ))}
           <span className="text-slate-400 text-sm ml-1 font-medium">({place.reviews || '100+'} reviews)</span>
        </div>

        <div className="space-y-4">
           {/* Description */}
           <p className="text-slate-600 leading-relaxed text-sm">
             {place.description || `Experience the best of ${place.name}. A top-rated destination for travelers seeking unique experiences in the city.`}
           </p>

           <hr className="border-slate-100" />

           {/* Info Grid */}
           <div className="grid gap-3">
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <MapPin className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                <span>{place.address || `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`}</span>
              </div>
              
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <Clock className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">Open Today</span>
                  {place.openingHours ? (
                    <ul className="text-xs space-y-0.5">
                      {place.openingHours.slice(0, 3).map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  ) : (
                    <span>09:00 AM - 09:00 PM</span>
                  )}
                </div>
              </div>

              {place.phone && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Phone className="text-emerald-500 shrink-0" size={18} />
                  <span>{place.phone}</span>
                </div>
              )}

              {place.website && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Globe className="text-emerald-500 shrink-0" size={18} />
                  <a href={place.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                    Visit Website
                  </a>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => onBookmark(place)}
          className={`p-3 rounded-xl border flex items-center justify-center transition-colors ${isBookmarked ? 'bg-amber-50 border-amber-200 text-amber-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
        >
          <Bookmark className={isBookmarked ? 'fill-current' : ''} size={20} />
        </button>
        
        <button 
          onClick={() => onAdd(place)}
          className="flex-1 bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-200"
        >
          <Plus size={20} />
          Add to Trip
        </button>

        <button 
           onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`, '_blank')}
           className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"
        >
          <Navigation size={20} />
        </button>
      </div>

    </div>
  );
};

export default PlaceDetailView;