
import * as React from 'react';
import { DayPlan } from '../types';
import { Wallet, User, UserPlus } from './Icons';
import { useTripStore } from '../store';

interface BudgetOverviewProps {
  itinerary: DayPlan[];
}

const BudgetOverview: React.FC<BudgetOverviewProps> = ({ itinerary }) => {
  const { settings } = useTripStore();
  const totalCost = itinerary.reduce((acc, day) => 
    acc + day.items.reduce((sum, item) => sum + (item.cost || 0), 0), 0
  );

  const dayCosts = itinerary.map(day => ({
    id: day.id,
    title: day.title,
    cost: day.items.reduce((sum, item) => sum + (item.cost || 0), 0)
  }));

  const maxDayCost = Math.max(...dayCosts.map(d => d.cost), 1);
  const isTeam = settings.travelMode === 'team';
  const teamSize = settings.teamSize || 1;
  const perPersonCost = totalCost / teamSize;

  if (totalCost === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Wallet size={16} className="text-emerald-500" /> 
          Budget Breakdown
        </h3>
        <div className="text-right">
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹{totalCost.toLocaleString()}</div>
          {isTeam && teamSize > 1 && (
             <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
               ₹{perPersonCost.toLocaleString()} per person
             </div>
          )}
        </div>
      </div>
      
      <div className="space-y-2.5">
        {dayCosts.map(day => (
          day.cost > 0 && (
            <div key={day.id} className="text-xs">
              <div className="flex justify-between mb-1 text-slate-500 dark:text-slate-400">
                <span className="font-medium">{day.title}</span>
                <span className="font-bold">₹{day.cost}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-1.5 rounded-full" 
                  style={{ width: `${(day.cost / maxDayCost) * 100}%` }}
                />
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default BudgetOverview;
