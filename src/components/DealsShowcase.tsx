import { useActiveDeals } from '@/hooks/useDeals';
import { Tag, Plane, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const DealsShowcase = () => {
  const { deals, loading } = useActiveDeals();

  if (loading || deals.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Tag className="h-5 w-5 text-accent" />
          <h2 className="text-xl font-bold text-foreground">Hot Deals</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.slice(0, 6).map(deal => (
            <div key={deal.id} className="bg-card rounded-xl p-5 border border-border/50 card-shadow hover:card-shadow-hover transition-all duration-300 group">
              <div className="flex items-start justify-between mb-3">
                <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                  {deal.special_price != null ? `£${deal.special_price}` : deal.discount_type === 'fixed' ? `£${deal.discount_value} OFF` : `${deal.discount_value}% OFF`}
                </Badge>
                {deal.airline_name && (
                  <span className="text-xs text-muted-foreground">{deal.airline_name}</span>
                )}
              </div>
              <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{deal.title}</h3>
              {deal.description && <p className="text-sm text-muted-foreground mb-3">{deal.description}</p>}
              {deal.origin_airport && deal.destination_airport && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Plane className="h-3 w-3" />
                  <span>{deal.origin_airport}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>{deal.destination_airport}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Valid: {deal.valid_from} — {deal.valid_until}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
