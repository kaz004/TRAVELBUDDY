import * as React from 'react';
import { useState, useRef } from 'react';
import { Place, JournalEntry } from '../types';
import { X, Camera, ImageIcon, Star, Trash2 } from './Icons';

interface JournalEntryModalProps {
  place: Place;
  initialEntry?: JournalEntry;
  onSave: (entry: JournalEntry) => void;
  onClose: () => void;
}

const JournalEntryModal: React.FC<JournalEntryModalProps> = ({ place, initialEntry, onSave, onClose }) => {
  const [text, setText] = useState(initialEntry?.text || '');
  const [photos, setPhotos] = useState<string[]>(initialEntry?.photos || []);
  const [rating, setRating] = useState(initialEntry?.rating || 0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPhotos(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSave({
      text,
      photos,
      rating,
      date: initialEntry?.date || new Date().toISOString()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <div>
             <h2 className="text-lg font-bold text-slate-800">Journal: {place.name}</h2>
             <p className="text-xs text-slate-500">{new Date().toLocaleDateString()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Rating */}
          <div className="flex justify-center space-x-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`transition-transform hover:scale-110 ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`}
              >
                <Star size={32} />
              </button>
            ))}
          </div>

          {/* Text Area */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Memories</label>
            <textarea
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[150px] resize-none bg-slate-50"
              placeholder="What did you enjoy most? How was the food? Any funny moments?"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {/* Photos */}
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-2">Photos</label>
             <div className="grid grid-cols-4 gap-2">
               {photos.map((photo, idx) => (
                 <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group border border-slate-200">
                   <img src={photo} alt="Journal" className="w-full h-full object-cover" />
                   <button 
                     onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                     className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                   >
                     <Trash2 size={20} />
                   </button>
                 </div>
               ))}
               
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors bg-slate-50"
               >
                 <Camera size={24} />
                 <span className="text-[10px] mt-1 font-medium">Add Photo</span>
               </button>
             </div>
             <input 
               type="file" 
               ref={fileInputRef} 
               className="hidden" 
               accept="image/*" 
               onChange={handleFileChange}
             />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <button 
            onClick={handleSave}
            className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-transform active:scale-[0.98]"
          >
            Save Entry
          </button>
        </div>
      </div>
    </div>
  );
};

export default JournalEntryModal;