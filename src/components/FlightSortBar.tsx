import { cn } from '@/lib/utils';
import { ArrowDownNarrowWide, Clock, Sparkles } from 'lucide-react';

export type SortOption = 'cheapest' | 'fastest' | 'best';

interface FlightSortBarProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export const FlightSortBar = ({ value, onChange }: FlightSortBarProps) => (
  <div className="flex gap-2">
    {([
      { key: 'cheapest' as SortOption, label: 'Cheapest', icon: ArrowDownNarrowWide },
      { key: 'fastest' as SortOption, label: 'Fastest', icon: Clock },
      { key: 'best' as SortOption, label: 'Best', icon: Sparkles },
    ]).map(({ key, label, icon: Icon }) => (
      <button
        key={key}
        onClick={() => onChange(key)}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
          value === key
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </button>
    ))}
  </div>
);

import { FlightWithDeal } from '@/lib/applyDeals';

export const sortFlights = (flights: FlightWithDeal[], sort: SortOption): FlightWithDeal[] => {
  const sorted = [...flights];
  switch (sort) {
    case 'cheapest':
      return sorted.sort((a, b) => (a.deal?.dealPrice ?? a.price.raw) - (b.deal?.dealPrice ?? b.price.raw));
    case 'fastest':
      return sorted.sort((a, b) => {
        const aDur = a.legs.reduce((s, l) => s + l.durationInMinutes, 0);
        const bDur = b.legs.reduce((s, l) => s + l.durationInMinutes, 0);
        return aDur - bDur;
      });
    case 'best':
      return sorted.sort((a, b) => {
        const aPrice = a.deal?.dealPrice ?? a.price.raw;
        const bPrice = b.deal?.dealPrice ?? b.price.raw;
        const aDur = a.legs.reduce((s, l) => s + l.durationInMinutes, 0);
        const bDur = b.legs.reduce((s, l) => s + l.durationInMinutes, 0);
        const aStops = a.legs.reduce((s, l) => s + l.stopCount, 0);
        const bStops = b.legs.reduce((s, l) => s + l.stopCount, 0);
        // Weighted score: price (normalized) + duration (normalized) + stops
        const maxPrice = Math.max(aPrice, bPrice) || 1;
        const maxDur = Math.max(aDur, bDur) || 1;
        const aScore = (aPrice / maxPrice) * 0.5 + (aDur / maxDur) * 0.3 + aStops * 0.2;
        const bScore = (bPrice / maxPrice) * 0.5 + (bDur / maxDur) * 0.3 + bStops * 0.2;
        return aScore - bScore;
      });
    default:
      return sorted;
  }
};
