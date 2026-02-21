import { useState, useEffect } from 'react';
import { Calendar, Plane, Users, ArrowRightLeft, Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Airport, SearchParams } from '@/types/flight';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FlightSearchFormProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

export const FlightSearchForm = ({ onSearch, isLoading }: FlightSearchFormProps) => {
  const [tripType, setTripType] = useState<'one-way' | 'round-trip'>('round-trip');
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
  const [directOnly, setDirectOnly] = useState(false);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);

  const searchAirports = async (query: string, type: 'origin' | 'destination') => {
    if (query.length < 2) {
      if (type === 'origin') setOriginAirports([]);
      else setDestinationAirports([]);
      return;
    }

    if (type === 'origin') setIsSearchingOrigin(true);
    else setIsSearchingDestination(true);

    try {
      const { data, error } = await supabase.functions.invoke('search-airports', {
        body: { query }
      });

      // Handle rate limiting gracefully - don't throw, just ignore
      if (error) {
        console.warn('Airport search error:', error);
        return;
      }

      // Check for API rate limit response
      if (data?.error === 'Too many requests') {
        console.warn('Rate limited, please wait a moment');
        return;
      }

      const airports = data?.data || [];
      if (type === 'origin') {
        setOriginAirports(airports);
        setShowOriginDropdown(airports.length > 0);
      } else {
        setDestinationAirports(airports);
        setShowDestinationDropdown(airports.length > 0);
      }
    } catch (error) {
      // Silently handle errors to prevent UI crashes
      console.warn('Error searching airports:', error);
    } finally {
      if (type === 'origin') setIsSearchingOrigin(false);
      else setIsSearchingDestination(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (originQuery && originQuery.length >= 2 && !selectedOrigin) {
        searchAirports(originQuery, 'origin');
      }
    }, 500); // Increased debounce to avoid rate limiting
    return () => clearTimeout(timer);
  }, [originQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (destinationQuery && destinationQuery.length >= 2 && !selectedDestination) {
        searchAirports(destinationQuery, 'destination');
      }
    }, 500); // Increased debounce to avoid rate limiting
    return () => clearTimeout(timer);
  }, [destinationQuery]);

  const swapLocations = () => {
    const tempOrigin = selectedOrigin;
    const tempQuery = originQuery;
    setSelectedOrigin(selectedDestination);
    setOriginQuery(destinationQuery);
    setSelectedDestination(tempOrigin);
    setDestinationQuery(tempQuery);
  };

  const handleSearch = () => {
    if (!selectedOrigin || !selectedDestination || !departureDate) return;

    onSearch({
      originSkyId: selectedOrigin.skyId,
      destinationSkyId: selectedDestination.skyId,
      originEntityId: selectedOrigin.entityId,
      destinationEntityId: selectedDestination.entityId,
      date: format(departureDate, 'yyyy-MM-dd'),
      returnDate: tripType === 'round-trip' && returnDate ? format(returnDate, 'yyyy-MM-dd') : undefined,
      cabinClass,
      adults,
      children,
      infants,
      directOnly,
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="glass rounded-2xl p-6 md:p-8 card-shadow">
        {/* Trip Type Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTripType('round-trip')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              tripType === 'round-trip' 
                ? "bg-primary text-primary-foreground" 
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            Round Trip
          </button>
          <button
            onClick={() => setTripType('one-way')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              tripType === 'one-way' 
                ? "bg-primary text-primary-foreground" 
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            One Way
          </button>
        </div>

        {/* Search Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          {/* Origin */}
          <div className="lg:col-span-3 relative">
            <label className="block text-sm font-medium text-muted-foreground mb-2">From</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                value={originQuery}
                onChange={(e) => {
                  setOriginQuery(e.target.value);
                  setSelectedOrigin(null);
                }}
                onFocus={() => originAirports.length > 0 && setShowOriginDropdown(true)}
                onBlur={() => setTimeout(() => setShowOriginDropdown(false), 200)}
                placeholder="City or airport"
                className="pl-10 h-12 bg-background"
              />
              {isSearchingOrigin && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {showOriginDropdown && originAirports.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto">
                {originAirports.map((airport) => (
                  <button
                    key={airport.entityId}
                    onClick={() => {
                      setSelectedOrigin(airport);
                      setOriginQuery(`${airport.city} (${airport.iata})`);
                      setShowOriginDropdown(false);
                    }}
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

          {/* Swap Button */}
          <div className="lg:col-span-1 flex justify-center">
            <Button
              variant="outline"
              size="icon"
              onClick={swapLocations}
              className="rounded-full h-10 w-10 hover:bg-secondary"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Destination */}
          <div className="lg:col-span-3 relative">
            <label className="block text-sm font-medium text-muted-foreground mb-2">To</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                value={destinationQuery}
                onChange={(e) => {
                  setDestinationQuery(e.target.value);
                  setSelectedDestination(null);
                }}
                onFocus={() => destinationAirports.length > 0 && setShowDestinationDropdown(true)}
                onBlur={() => setTimeout(() => setShowDestinationDropdown(false), 200)}
                placeholder="City or airport"
                className="pl-10 h-12 bg-background"
              />
              {isSearchingDestination && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {showDestinationDropdown && destinationAirports.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto">
                {destinationAirports.map((airport) => (
                  <button
                    key={airport.entityId}
                    onClick={() => {
                      setSelectedDestination(airport);
                      setDestinationQuery(`${airport.city} (${airport.iata})`);
                      setShowDestinationDropdown(false);
                    }}
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
                <CalendarComponent
                  mode="single"
                  selected={departureDate}
                  onSelect={setDepartureDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
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
                  <CalendarComponent
                    mode="single"
                    selected={returnDate}
                    onSelect={setReturnDate}
                    disabled={(date) => date < (departureDate || new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Search Button */}
          <div className={cn("lg:col-span-1", tripType === 'one-way' && "lg:col-span-3")}>
            <Button
              onClick={handleSearch}
              disabled={isLoading || !selectedOrigin || !selectedDestination || !departureDate}
              variant="hero"
              size="lg"
              className="w-full h-12"
            >
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
                  <div>
                    <p className="font-medium">Adults</p>
                    <p className="text-sm text-muted-foreground">12+ years</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setAdults(Math.max(1, adults - 1))}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center">{adults}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setAdults(adults + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Children</p>
                    <p className="text-sm text-muted-foreground">2-11 years</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setChildren(Math.max(0, children - 1))}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center">{children}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setChildren(children + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Infants</p>
                    <p className="text-sm text-muted-foreground">Under 2</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setInfants(Math.max(0, infants - 1))}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center">{infants}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setInfants(infants + 1)}
                    >
                      +
                    </Button>
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

          <button
            onClick={() => setDirectOnly(!directOnly)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              directOnly
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            Direct only
          </button>
        </div>
      </div>
    </div>
  );
};
