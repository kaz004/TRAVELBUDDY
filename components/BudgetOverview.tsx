import * as React from 'react';
import { DayPlan } from '../types';
import { Wallet } from './Icons';

interface BudgetOverviewProps {
  itinerary: DayPlan[];
}

const BudgetOverview: React.FC<BudgetOverviewProps> = ({ itinerary }) => {
  const totalCost = itinerary.reduce((acc, day) => 
    acc + day.items.reduce((sum, item) => sum + (item.cost || 0), 0), 0
  );

  const dayCosts = itinerary.map(day => ({
    id: day.id,
    title: day.title,
    cost: day.items.reduce((sum, item) => sum + (item.cost || 0), 0)
  }));

  const maxDayCost = Math.max(...dayCosts.map(d => d.cost), 1); // Avoid div by 0

  if (totalCost === 0) return null;

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <Wallet size={16} className="text-emerald-500" /> 
          Trip Budget
        </h3>
        <span className="text-lg font-black text-emerald-600">${totalCost.toLocaleString()}</span>
      </div>
      
      <div className="space-y-2">
        {dayCosts.map(day => (
          day.cost > 0 && (
            <div key={day.id} className="text-xs">
              <div className="flex justify-between mb-1 text-slate-500">
                <span>{day.title}</span>
                <span>${day.cost}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
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