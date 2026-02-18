import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Plane, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AirportOption {
  entityId: string;
  skyId: string;
  name: string;
  city: string;
  country: string;
  iata: string;
}

interface AirportAutocompleteProps {
  value: string;
  onChange: (value: string, airport?: AirportOption) => void;
  placeholder?: string;
  className?: string;
  /** When true, only emits the IATA code as value */
  iataOnly?: boolean;
}

export const AirportAutocomplete = ({ value, onChange, placeholder = 'Search airport...', className, iataOnly }: AirportAutocompleteProps) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AirportOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const { data } = await supabase.functions.invoke('search-airports', { body: { query } });
        const airports = data?.data || [];
        setResults(airports);
        setShowDropdown(airports.length > 0);
      } catch {
        // silently fail
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (airport: AirportOption) => {
    const display = iataOnly ? airport.iata : `${airport.city} (${airport.iata})`;
    setQuery(display);
    setShowDropdown(false);
    onChange(iataOnly ? airport.iata : display, airport);
  };

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute z-[100] w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-auto">
          {results.map((airport, idx) => (
            <button
              key={`${airport.entityId}-${idx}`}
              type="button"
              onClick={() => handleSelect(airport)}
              className="w-full px-3 py-2 text-left hover:bg-accent/10 flex items-center gap-2 text-sm"
            >
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate">{airport.city} ({airport.iata})</p>
                <p className="text-xs text-muted-foreground truncate">{airport.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
