import { MapPin, Clock } from 'lucide-react';
import { LayoverInfo } from '@/types/flight';

interface LayoverMapProps {
  originCode: string;
  destinationCode: string;
  layovers: LayoverInfo[];
}

const formatLayoverDuration = (minutes: number): string => {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const LayoverMap = ({ originCode, destinationCode, layovers }: LayoverMapProps) => {
  if (!layovers || layovers.length === 0) return null;

  const allPoints = [
    { code: originCode, isLayover: false },
    ...layovers.map(l => ({ code: l.airportCode, isLayover: true, ...l })),
    { code: destinationCode, isLayover: false },
  ];

  return (
    <div className="mt-4 pt-4 border-t border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Route & Layovers</span>
      </div>

      <div className="relative flex items-center w-full">
        {/* Connecting line */}
        <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-border -translate-y-1/2 z-0" />

        <div className="relative z-10 flex items-center justify-between w-full">
          {allPoints.map((point, i) => (
            <div key={i} className="flex flex-col items-center">
              {/* Dot */}
              <div
                className={`rounded-full border-2 border-card ${
                  point.isLayover
                    ? 'w-4 h-4 bg-orange-400 dark:bg-orange-500'
                    : 'w-5 h-5 bg-primary'
                }`}
              />
              {/* Airport code */}
              <span className={`text-xs font-bold mt-1.5 ${point.isLayover ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
                {point.code}
              </span>
              {/* Layover duration */}
              {point.isLayover && 'durationMinutes' in point && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground mt-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {formatLayoverDuration((point as LayoverInfo).durationMinutes)}
                </span>
              )}
              {/* Layover airport name */}
              {point.isLayover && 'airportName' in point && (point as LayoverInfo).airportName && (
                <span className="text-[10px] text-muted-foreground max-w-[80px] text-center truncate">
                  {(point as LayoverInfo).airportName}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
