import { Plane, Cloud } from 'lucide-react';

export const Hero = () => {
  return (
    <div className="relative overflow-hidden pt-8 pb-16">
      {/* Background gradient */}
      <div className="absolute inset-0 sky-gradient-soft" />
      
      {/* Floating clouds decoration */}
      <div className="absolute top-10 left-10 opacity-20">
        <Cloud className="h-24 w-24 text-primary animate-float" style={{ animationDelay: '0s' }} />
      </div>
      <div className="absolute top-20 right-20 opacity-15">
        <Cloud className="h-16 w-16 text-primary animate-float" style={{ animationDelay: '1s' }} />
      </div>
      <div className="absolute bottom-20 left-1/4 opacity-10">
        <Cloud className="h-20 w-20 text-primary animate-float" style={{ animationDelay: '2s' }} />
      </div>
      
      {/* Flying plane animation */}
      <div className="absolute top-1/3 opacity-20">
        <Plane className="h-8 w-8 text-primary animate-plane-fly" />
      </div>

      <div className="relative container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
            <Plane className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Find Your Perfect Flight</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 leading-tight">
            Discover the World,{' '}
            <span className="text-gradient">One Flight at a Time</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Search hundreds of airlines and compare prices to find the best deals on flights worldwide.
          </p>
        </div>
      </div>
    </div>
  );
};
