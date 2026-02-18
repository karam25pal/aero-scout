import { FlightResult } from '@/types/flight';
import { Deal } from '@/types/deal';

export interface FlightWithDeal extends FlightResult {
  deal?: {
    title: string;
    discount_type: 'fixed' | 'percentage';
    discount_value: number;
    special_price: number | null;
    dealPrice: number;
    dealPriceFormatted: string;
  };
  effectivePrice: number;
}

export function applyDealsToFlights(flights: FlightResult[], deals: Deal[]): FlightWithDeal[] {
  const today = new Date().toISOString().split('T')[0];
  const activeDeals = deals.filter(d => d.is_active && d.valid_from <= today && d.valid_until >= today);

  const results: FlightWithDeal[] = flights.map(flight => {
    const leg = flight.legs[0];
    if (!leg || activeDeals.length === 0) return { ...flight, effectivePrice: flight.price.raw };

    const carrierName = leg.carriers.marketing[0]?.name?.toLowerCase() || '';
    const originCode = leg.origin.displayCode?.toUpperCase() || '';
    const destCode = leg.destination.displayCode?.toUpperCase() || '';

    let bestDeal: (Deal & { dealPrice: number }) | null = null;

    for (const deal of activeDeals) {
      if (deal.airline_name && !carrierName.includes(deal.airline_name.toLowerCase())) continue;
      if (deal.origin_airport && deal.origin_airport.toUpperCase() !== originCode) continue;
      if (deal.destination_airport && deal.destination_airport.toUpperCase() !== destCode) continue;

      let dealPrice: number;
      if (deal.special_price != null) {
        dealPrice = deal.special_price;
      } else if (deal.discount_type === 'fixed') {
        dealPrice = Math.max(0, flight.price.raw - deal.discount_value);
      } else {
        dealPrice = Math.max(0, flight.price.raw * (1 - deal.discount_value / 100));
      }
      dealPrice = Math.round(dealPrice * 100) / 100;

      if (!bestDeal || dealPrice < bestDeal.dealPrice) {
        bestDeal = { ...deal, dealPrice };
      }
    }

    if (!bestDeal) return { ...flight, effectivePrice: flight.price.raw };

    const currMatch = flight.price.formatted.match(/^([A-Z£€$]+)/);
    const currency = currMatch ? currMatch[1] : '£';

    return {
      ...flight,
      effectivePrice: bestDeal.dealPrice,
      deal: {
        title: bestDeal.title,
        discount_type: bestDeal.discount_type,
        discount_value: bestDeal.discount_value,
        special_price: bestDeal.special_price,
        dealPrice: bestDeal.dealPrice,
        dealPriceFormatted: `${currency}${Math.round(bestDeal.dealPrice)}`,
      },
    };
  });

  // Recalculate cheapest/fastest tags based on effective prices
  if (results.length > 0) {
    const cheapestPrice = Math.min(...results.map(f => f.effectivePrice));
    const fastestDuration = Math.min(...results.map(f => f.legs[0]?.durationInMinutes ?? Infinity));

    for (const f of results) {
      const newTags: string[] = [];
      if (f.effectivePrice === cheapestPrice) newTags.push('cheapest');
      if (f.legs[0]?.durationInMinutes === fastestDuration) newTags.push('fastest');
      f.tags = newTags.length > 0 ? newTags : undefined;
    }
  }

  return results;
}
