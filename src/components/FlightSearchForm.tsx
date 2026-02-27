import { useState, useEffect, useCallback } from 'react';
import { Calendar, Plane, Users, ArrowRightLeft, Search, MapPin, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Airport, SearchParams, MultiCityLeg } from '@/types/flight';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FlightSearchFormProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

interface MultiCityRow {
  originQuery: string;
  destinationQuery: string;
  selectedOrigin: Airport | null;
  selectedDestination: Airport | null;
  date: Date | undefined;
}

const AirportInput = ({
  value,
  onChange,
  onSelect,
  placeholder,
  airports,
  isSearching,
  showDropdown,
  setShowDropdown,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (a: Airport) => void;
  placeholder: string;
  airports: Airport[];
  isSearching: boolean;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
}) => (
  <div className="relative flex-1">
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => airports.length > 0 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder={placeholder}
        className="pl-10 h-12 bg-background"
      />
      {isSearching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
    {showDropdown && airports.length > 0 && (
      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto">
        {airports.map((airport) => (
          <button
            key={airport.entityId}
            onClick={() => onSelect(airport)}
            className="w-full px-4 py-3 text-left hover:bg-accent/10 flex items-center gap-3"
          >
            <Plane className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{airport.city} ({airport.iata})</p>
              <p className="text-sm text-muted-foreground">{airport.name}</p>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
);

export const FlightSearchForm = ({ onSearch, isLoading }: FlightSearchFormProps) => {
  const [tripType, setTripType] = useState<'one-way' | 'round-trip' | 'multi-city'>('round-trip');
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [originAirports, setOriginAirports] = useState<Airport[]>([]);
  const [destinationAirports, setDestinationAirports] = useState<Airport[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<Airport | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Airport | null>(null);
  const [departureDate, setDepartureDate] = useState<Date | undefined>(new Date());
  const [returnDate, setReturnDate] = useState<Date | undefined>();
  const [cabinClass, setCabinClass] = useState<'economy' | 'premium_economy' | 'business' | 'first'>('economy');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [stops, setStops] = useState<string>('');
  
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);

  // Multi-city state
  const [multiCityRows, setMultiCityRows] = useState<MultiCityRow[]>([
    { originQuery: '', destinationQuery: '', selectedOrigin: null, selectedDestination: null, date: new Date() },
    { originQuery: '', destinationQuery: '', selectedOrigin: null, selectedDestination: null, date: undefined },
  ]);
  const [multiCityAirports, setMultiCityAirports] = useState<Record<string, Airport[]>>({});
  const [multiCityDropdowns, setMultiCityDropdowns] = useState<Record<string, boolean>>({});
  const [multiCitySearching, setMultiCitySearching] = useState<Record<string, boolean>>({});

  const searchAirports = async (query: string, type: 'origin' | 'destination') => {
    if (query.length < 2) {
      if (type === 'origin') setOriginAirports([]);
      else setDestinationAirports([]);
      return;
    }
    if (type === 'origin') setIsSearchingOrigin(true);
    else setIsSearchingDestination(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-airports', { body: { query } });
      if (error || data?.error === 'Too many requests') return;
      const airports = data?.data || [];
      if (type === 'origin') { setOriginAirports(airports); setShowOriginDropdown(airports.length > 0); }
      else { setDestinationAirports(airports); setShowDestinationDropdown(airports.length > 0); }
    } catch (e) { console.warn('Error searching airports:', e); }
    finally {
      if (type === 'origin') setIsSearchingOrigin(false);
      else setIsSearchingDestination(false);
    }
  };

  const searchMultiCityAirports = useCallback(async (query: string, key: string) => {
    if (query.length < 2) { setMultiCityAirports(prev => ({ ...prev, [key]: [] })); return; }
    setMultiCitySearching(prev => ({ ...prev, [key]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('search-airports', { body: { query } });
      if (error || data?.error === 'Too many requests') return;
      const airports = data?.data || [];
      setMultiCityAirports(prev => ({ ...prev, [key]: airports }));
      setMultiCityDropdowns(prev => ({ ...prev, [key]: airports.length > 0 }));
    } catch (e) { console.warn(e); }
    finally { setMultiCitySearching(prev => ({ ...prev, [key]: false })); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (originQuery && originQuery.length >= 2 && !selectedOrigin) searchAirports(originQuery, 'origin');
    }, 500);
    return () => clearTimeout(timer);
  }, [originQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (destinationQuery && destinationQuery.length >= 2 && !selectedDestination) searchAirports(destinationQuery, 'destination');
    }, 500);
    return () => clearTimeout(timer);
  }, [destinationQuery]);

  // Debounced multi-city airport search
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    multiCityRows.forEach((row, i) => {
      const oKey = `mc-origin-${i}`;
      const dKey = `mc-dest-${i}`;
      if (row.originQuery.length >= 2 && !row.selectedOrigin) {
        timers.push(setTimeout(() => searchMultiCityAirports(row.originQuery, oKey), 500));
      }
      if (row.destinationQuery.length >= 2 && !row.selectedDestination) {
        timers.push(setTimeout(() => searchMultiCityAirports(row.destinationQuery, dKey), 500));
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [multiCityRows, searchMultiCityAirports]);

  const swapLocations = () => {
    const tempOrigin = selectedOrigin;
    const tempQuery = originQuery;
    setSelectedOrigin(selectedDestination);
    setOriginQuery(destinationQuery);
    setSelectedDestination(tempOrigin);
    setDestinationQuery(tempQuery);
  };

  const updateMultiCityRow = (index: number, updates: Partial<MultiCityRow>) => {
    setMultiCityRows(prev => {
      const next = prev.map((row, i) => i === index ? { ...row, ...updates } : row);
      // Auto-fill next leg's origin when destination is set
      if (updates.selectedDestination && index < next.length - 1) {
        const dest = updates.selectedDestination;
        next[index + 1] = {
          ...next[index + 1],
          selectedOrigin: dest,
          originQuery: `${dest.city} (${dest.iata})`,
        };
      }
      return next;
    });
  };

  const addMultiCityRow = () => {
    if (multiCityRows.length >= 5) return;
    setMultiCityRows(prev => {
      const lastRow = prev[prev.length - 1];
      const newRow: MultiCityRow = {
        originQuery: lastRow?.selectedDestination ? `${lastRow.selectedDestination.city} (${lastRow.selectedDestination.iata})` : '',
        destinationQuery: '',
        selectedOrigin: lastRow?.selectedDestination || null,
        selectedDestination: null,
        date: undefined,
      };
      return [...prev, newRow];
    });
  };

  const removeMultiCityRow = (index: number) => {
    if (multiCityRows.length <= 2) return;
    setMultiCityRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleSearch = () => {
    if (tripType === 'multi-city') {
      const validLegs = multiCityRows.filter(r => r.selectedOrigin && r.selectedDestination && r.date);
      if (validLegs.length < 2) return;
      const legs: MultiCityLeg[] = validLegs.map(r => ({
        departureId: r.selectedOrigin!.iata || r.selectedOrigin!.skyId,
        arrivalId: r.selectedDestination!.iata || r.selectedDestination!.skyId,
        date: format(r.date!, 'yyyy-MM-dd'),
        originLabel: `${r.selectedOrigin!.city} (${r.selectedOrigin!.iata})`,
        destinationLabel: `${r.selectedDestination!.city} (${r.selectedDestination!.iata})`,
      }));
      onSearch({
        originSkyId: legs[0].departureId,
        destinationSkyId: legs[legs.length - 1].arrivalId,
        originEntityId: legs[0].departureId,
        destinationEntityId: legs[legs.length - 1].arrivalId,
        date: legs[0].date,
        cabinClass,
        adults,
        children,
        infants,
        stops: stops || undefined,
        tripType: 'multi-city',
        multiCityLegs: legs,
      });
    } else {
      if (!selectedOrigin || !selectedDestination || !departureDate) return;
      onSearch({
        originSkyId: selectedOrigin.skyId || selectedOrigin.iata,
        destinationSkyId: selectedDestination.skyId || selectedDestination.iata,
        originEntityId: selectedOrigin.entityId || selectedOrigin.iata,
        destinationEntityId: selectedDestination.entityId || selectedDestination.iata,
        date: format(departureDate, 'yyyy-MM-dd'),
        returnDate: tripType === 'round-trip' && returnDate ? format(returnDate, 'yyyy-MM-dd') : undefined,
        cabinClass,
        adults,
        children,
        infants,
        stops: stops || undefined,
        tripType,
      });
    }
  };

  const isSearchDisabled = () => {
    if (isLoading) return true;
    if (tripType === 'multi-city') {
      const validLegs = multiCityRows.filter(r => r.selectedOrigin && r.selectedDestination && r.date);
      return validLegs.length < 2;
    }
    return !selectedOrigin || !selectedDestination || !departureDate;
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="glass rounded-2xl p-6 md:p-8 card-shadow">
        {/* Trip Type Toggle */}
        <div className="flex gap-2 mb-6">
          {(['round-trip', 'one-way', 'multi-city'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTripType(type)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                tripType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {type === 'round-trip' ? 'Round Trip' : type === 'one-way' ? 'One Way' : 'Multi-City'}
            </button>
          ))}
        </div>

        {/* Standard search (one-way / round-trip) */}
        {tripType !== 'multi-city' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
            {/* Origin */}
            <div className="lg:col-span-3 relative">
              <label className="block text-sm font-medium text-muted-foreground mb-2">From</label>
              <AirportInput
                value={originQuery}
                onChange={(v) => { setOriginQuery(v); setSelectedOrigin(null); }}
                onSelect={(a) => { setSelectedOrigin(a); setOriginQuery(`${a.city} (${a.iata})`); setShowOriginDropdown(false); }}
                placeholder="City or airport"
                airports={originAirports}
                isSearching={isSearchingOrigin}
                showDropdown={showOriginDropdown}
                setShowDropdown={setShowOriginDropdown}
              />
            </div>

            {/* Swap */}
            <div className="lg:col-span-1 flex justify-center">
              <Button variant="outline" size="icon" onClick={swapLocations} className="rounded-full h-10 w-10 hover:bg-secondary">
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            </div>

            {/* Destination */}
            <div className="lg:col-span-3 relative">
              <label className="block text-sm font-medium text-muted-foreground mb-2">To</label>
              <AirportInput
                value={destinationQuery}
                onChange={(v) => { setDestinationQuery(v); setSelectedDestination(null); }}
                onSelect={(a) => { setSelectedDestination(a); setDestinationQuery(`${a.city} (${a.iata})`); setShowDestinationDropdown(false); }}
                placeholder="City or airport"
                airports={destinationAirports}
                isSearching={isSearchingDestination}
                showDropdown={showDestinationDropdown}
                setShowDropdown={setShowDestinationDropdown}
              />
            </div>

            {/* Departure Date */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-2">Departure</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-12 justify-start text-left font-normal bg-background">
                    <Calendar className="mr-2 h-4 w-4" />
                    {departureDate ? format(departureDate, 'MMM dd') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={departureDate} onSelect={setDepartureDate} disabled={(date) => date < new Date()} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            {/* Return Date */}
            {tripType === 'round-trip' && (
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-2">Return</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-12 justify-start text-left font-normal bg-background">
                      <Calendar className="mr-2 h-4 w-4" />
                      {returnDate ? format(returnDate, 'MMM dd') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={returnDate} onSelect={setReturnDate} disabled={(date) => date < (departureDate || new Date())} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Search Button */}
            <div className={cn("lg:col-span-1", tripType === 'one-way' && "lg:col-span-3")}>
              <Button onClick={handleSearch} disabled={isSearchDisabled()} variant="hero" size="lg" className="w-full h-12">
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    <span className="hidden sm:inline">Search</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Multi-city search */}
        {tripType === 'multi-city' && (
          <div className="space-y-4">
            {multiCityRows.map((row, index) => {
              const oKey = `mc-origin-${index}`;
              const dKey = `mc-dest-${index}`;
              return (
                <div key={index} className="flex flex-col md:flex-row gap-3 items-end p-4 rounded-xl bg-muted/30 border border-border/30">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0 self-center md:self-end md:mb-1">
                    {index + 1}
                  </div>
                  <div className="flex-1 relative">
                    <label className="block text-sm font-medium text-muted-foreground mb-1">From</label>
                    <AirportInput
                      value={row.originQuery}
                      onChange={(v) => updateMultiCityRow(index, { originQuery: v, selectedOrigin: null })}
                      onSelect={(a) => {
                        updateMultiCityRow(index, { selectedOrigin: a, originQuery: `${a.city} (${a.iata})` });
                        setMultiCityDropdowns(prev => ({ ...prev, [oKey]: false }));
                      }}
                      placeholder="City or airport"
                      airports={multiCityAirports[oKey] || []}
                      isSearching={multiCitySearching[oKey] || false}
                      showDropdown={multiCityDropdowns[oKey] || false}
                      setShowDropdown={(v) => setMultiCityDropdowns(prev => ({ ...prev, [oKey]: v }))}
                    />
                  </div>
                  <div className="flex-1 relative">
                    <label className="block text-sm font-medium text-muted-foreground mb-1">To</label>
                    <AirportInput
                      value={row.destinationQuery}
                      onChange={(v) => updateMultiCityRow(index, { destinationQuery: v, selectedDestination: null })}
                      onSelect={(a) => {
                        updateMultiCityRow(index, { selectedDestination: a, destinationQuery: `${a.city} (${a.iata})` });
                        setMultiCityDropdowns(prev => ({ ...prev, [dKey]: false }));
                      }}
                      placeholder="City or airport"
                      airports={multiCityAirports[dKey] || []}
                      isSearching={multiCitySearching[dKey] || false}
                      showDropdown={multiCityDropdowns[dKey] || false}
                      setShowDropdown={(v) => setMultiCityDropdowns(prev => ({ ...prev, [dKey]: v }))}
                    />
                  </div>
                  <div className="w-full md:w-40">
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-12 justify-start text-left font-normal bg-background">
                          <Calendar className="mr-2 h-4 w-4" />
                          {row.date ? format(row.date, 'MMM dd') : 'Select'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={row.date}
                          onSelect={(d) => updateMultiCityRow(index, { date: d })}
                          disabled={(d) => d < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {multiCityRows.length > 2 && (
                    <Button variant="ghost" size="icon" onClick={() => removeMultiCityRow(index)} className="shrink-0 h-10 w-10 text-muted-foreground hover:text-destructive self-center md:self-end md:mb-1">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            
            <div className="flex gap-3">
              {multiCityRows.length < 5 && (
                <Button variant="outline" size="sm" onClick={addMultiCityRow} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Flight
                </Button>
              )}
              <div className="flex-1" />
              <Button onClick={handleSearch} disabled={isSearchDisabled()} variant="hero" size="lg" className="h-12 px-8">
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    Search Flights
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Passengers & Class Row */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border/50">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Users className="h-4 w-4" />
                {adults + children + infants} Traveler{adults + children + infants > 1 ? 's' : ''}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><p className="font-medium">Adults</p><p className="text-sm text-muted-foreground">12+ years</p></div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAdults(Math.max(1, adults - 1))}>-</Button>
                    <span className="w-8 text-center">{adults}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAdults(adults + 1)}>+</Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="font-medium">Children</p><p className="text-sm text-muted-foreground">2-11 years</p></div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setChildren(Math.max(0, children - 1))}>-</Button>
                    <span className="w-8 text-center">{children}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setChildren(children + 1)}>+</Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="font-medium">Infants</p><p className="text-sm text-muted-foreground">Under 2</p></div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setInfants(Math.max(0, infants - 1))}>-</Button>
                    <span className="w-8 text-center">{infants}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setInfants(infants + 1)}>+</Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Select value={cabinClass} onValueChange={(v) => setCabinClass(v as typeof cabinClass)}>
            <SelectTrigger className="w-auto border-0 bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="economy">Economy</SelectItem>
              <SelectItem value="premium_economy">Premium Economy</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="first">First Class</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stops} onValueChange={setStops}>
            <SelectTrigger className="w-auto border-0 bg-transparent">
              <SelectValue placeholder="Any stops" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any stops</SelectItem>
              <SelectItem value="0">Nonstop only</SelectItem>
              <SelectItem value="1">1 stop or fewer</SelectItem>
              <SelectItem value="2">2 stops or fewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
