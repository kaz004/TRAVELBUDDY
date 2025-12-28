
import * as React from 'react';
import { useState } from 'react';
import { Place, ItineraryItem } from '../types';
import { Star, Plus, Trash2, MapPin, GripVertical, Bookmark, CornerDownRight, Wallet, Edit2, Clock } from './Icons';
import { useTripStore } from '../store';

interface PlaceCardProps {
  place: Place | ItineraryItem;
  onAdd?: (place: Place) => void;
  onRemove?: (id: string) => void;
  onBookmark?: (place: Place) => void;
  onUpdateCost?: (id: string, cost: number) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onUpdateTime?: (id: string, updates: { startTime?: string, durationMinutes?: number }) => void;
  isBookmarked?: boolean;
  isItineraryMode?: boolean;
  compact?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const PlaceCard: React.FC<PlaceCardProps> = ({ 
  place, onAdd, onRemove, onBookmark, onUpdateCost, onUpdateNotes, onUpdateTime,
  isBookmarked, isItineraryMode, compact, onClick,
  draggable, onDragStart, onDragOver, onDrop
}) => {
  const { settings } = useTripStore();
  const seed = place.name.replace(/[^a-zA-Z0-9]/g, '');
  const imageUrl = place.photos?.[0] || `https://picsum.photos/seed/${seed}/400/300`;
  const [showNotes, setShowNotes] = useState(!!(place as ItineraryItem).notes);
  const [showTimeEdit, setShowTimeEdit] = useState(false);

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`, '_blank');
  };

  const item = place as ItineraryItem;

  return (
    <div 
      className={`group bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all duration-200 overflow-hidden flex ${compact ? 'flex-row min-h-[5rem]' : 'flex-col'}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className={`relative ${compact ? 'w-24 shrink-0' : 'h-32 w-full'}`}>
        <img 
          src={imageUrl} 
          alt={place.name} 
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {!compact && (
          <div className="absolute top-2 right-2">
             <span className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm text-xs font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
              <Star size={10} className="text-yellow-500 fill-yellow-500" />
              {place.rating}
            </span>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-grow min-w-0">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight select-none">{place.name}</h3>
          {isItineraryMode && (
             <div className="text-slate-400 cursor-grab active:cursor-grabbing p-1" title="Drag to reorder">
               <GripVertical size={16} />
             </div>
          )}
        </div>
        
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1 flex items-center gap-1 select-none">
          <MapPin size={12} /> {place.category}
        </p>

        {!compact && <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2 select-none">{place.description}</p>}
        
        {/* Itinerary Logic */}
        {isItineraryMode && (
          <div className="mt-2 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-2">
             {/* Time & Duration Display */}
             <div 
               className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 p-1 rounded"
               onClick={(e) => { e.stopPropagation(); setShowTimeEdit(!showTimeEdit); }}
             >
                <Clock size={12} className="text-emerald-500" />
                <span className="font-medium">{item.startTime}</span>
                <span className="text-slate-400">•</span>
                <span>{item.durationMinutes} min</span>
             </div>

             {showTimeEdit && (
               <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg" onClick={e => e.stopPropagation()}>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold">Start</label>
                    <input 
                      type="time" 
                      className="w-full text-xs p-1 rounded border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      value={item.startTime}
                      onChange={(e) => onUpdateTime?.(place.id, { startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold">Duration (m)</label>
                    <input 
                      type="number" 
                      className="w-full text-xs p-1 rounded border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      value={item.durationMinutes}
                      onChange={(e) => onUpdateTime?.(place.id, { durationMinutes: parseInt(e.target.value) })}
                    />
                  </div>
               </div>
             )}

             <div className="flex items-center gap-2">
                <div className="relative flex-1 flex items-center">
                  <Wallet size={12} className="absolute left-2 text-slate-400" />
                  <input 
                    type="number" 
                    placeholder="Cost"
                    className="w-full pl-6 pr-2 py-1 text-xs border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-md focus:outline-none focus:border-blue-500"
                    value={item.cost || ''}
                    onChange={(e) => onUpdateCost?.(place.id, parseFloat(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                <button 
                   onClick={(e) => { e.stopPropagation(); setShowNotes(!showNotes); }}
                   className={`p-1.5 rounded-md transition-colors ${showNotes ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                   <Edit2 size={14} />
                </button>

                <button 
                   onClick={handleNavigate}
                   className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1.5 rounded-md transition-colors"
                 >
                   <CornerDownRight size={16} />
                </button>
             </div>

             {showNotes && (
               <textarea
                 placeholder="Add notes..."
                 className="w-full text-xs p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-none focus:border-blue-500 resize-none bg-slate-50 dark:bg-slate-800 dark:text-slate-200"
                 rows={2}
                 value={item.notes || ''}
                 onChange={(e) => onUpdateNotes?.(place.id, e.target.value)}
                 onClick={(e) => e.stopPropagation()}
               />
             )}
          </div>
        )}

        {/* Action Buttons */}
        <div className={`mt-auto pt-2 flex justify-between items-center gap-2 ${isItineraryMode ? 'mt-2' : ''}`}>
          {onAdd && (
            <button 
              onClick={(e) => { e.stopPropagation(); onAdd(place); }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors shadow-sm"
            >
              <Plus size={14} /> Add
            </button>
          )}
          
          {onBookmark && (
            <button 
              onClick={(e) => { e.stopPropagation(); onBookmark(place); }}
              className={`p-1.5 rounded-lg border transition-colors ${isBookmarked ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'}`}
            >
              <Bookmark size={14} className={isBookmarked ? 'fill-current' : ''} />
            </button>
          )}

          {onRemove && (
             <button 
             onClick={(e) => { e.stopPropagation(); onRemove(place.id); }}
             className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors ml-auto"
           >
             <Trash2 size={16} />
           </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaceCard;
