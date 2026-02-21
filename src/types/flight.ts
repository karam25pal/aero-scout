export interface Airport {
  entityId: string;
  skyId: string;
  name: string;
  city: string;
  country: string;
  iata: string;
}

export interface FlightLeg {
  origin: {
    name: string;
    displayCode: string;
    city: string;
  };
  destination: {
    name: string;
    displayCode: string;
    city: string;
  };
  departure: string;
  arrival: string;
  durationInMinutes: number;
  carriers: {
    marketing: {
      name: string;
      logoUrl: string;
    }[];
  };
  stopCount: number;
}

export interface FlightResult {
  id: string;
  price: {
    raw: number;
    formatted: string;
  };
  legs: FlightLeg[];
  isSelfTransfer: boolean;
  tags?: string[];
}

export interface SearchParams {
  originSkyId: string;
  destinationSkyId: string;
  originEntityId: string;
  destinationEntityId: string;
  date: string;
  returnDate?: string;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
  adults: number;
  children: number;
  infants: number;
  directOnly?: boolean;
}
