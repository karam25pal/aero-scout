import { FlightResult } from '@/types/flight';
import { Deal } from '@/types/deal';

export interface FlightWithDeal extends FlightResult {
  deal?: {
    title: string;
    discount_type: 'fixed' | 'percentage';
    discount_value: number;
    dealPrice: number;
    dealPriceFormatted: string;
  };
}

export function applyDealsToFlights(flights: FlightResult[], deals: Deal[]): FlightWithDeal[] {
  const today = new Date().toISOString().split('T')[0];
  const activeDeals = deals.filter(d => d.is_active && d.valid_from <= today && d.valid_until >= today);

  if (activeDeals.length === 0) return flights;

  return flights.map(flight => {
    const leg = flight.legs[0];
    if (!leg) return flight;

    const carrierName = leg.carriers.marketing[0]?.name?.toLowerCase() || '';
    const originCode = leg.origin.displayCode?.toUpperCase() || '';
    const destCode = leg.destination.displayCode?.toUpperCase() || '';

    let bestDeal: (Deal & { dealPrice: number }) | null = null;

    for (const deal of activeDeals) {
      // Check airline match (if specified)
      if (deal.airline_name && !carrierName.includes(deal.airline_name.toLowerCase())) continue;

      // Check origin match (if specified)
      if (deal.origin_airport && deal.origin_airport.toUpperCase() !== originCode) continue;

      // Check destination match (if specified)
      if (deal.destination_airport && deal.destination_airport.toUpperCase() !== destCode) continue;

      // Calculate deal price
      let dealPrice: number;
      if (deal.discount_type === 'fixed') {
        dealPrice = Math.max(0, flight.price.raw - deal.discount_value);
      } else {
        dealPrice = Math.max(0, flight.price.raw * (1 - deal.discount_value / 100));
      }
      dealPrice = Math.round(dealPrice * 100) / 100;

      if (!bestDeal || dealPrice < bestDeal.dealPrice) {
        bestDeal = { ...deal, dealPrice };
      }
    }

    if (!bestDeal) return flight;

    // Extract currency from formatted price
    const currMatch = flight.price.formatted.match(/^([A-Z£€$]+)/);
    const currency = currMatch ? currMatch[1] : '£';

    return {
      ...flight,
      deal: {
        title: bestDeal.title,
        discount_type: bestDeal.discount_type,
        discount_value: bestDeal.discount_value,
        dealPrice: bestDeal.dealPrice,
        dealPriceFormatted: `${currency}${Math.round(bestDeal.dealPrice)}`,
      },
    };
  });
}
