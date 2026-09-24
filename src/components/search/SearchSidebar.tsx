'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, MapPin, Star, CheckCircle2, Filter, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilterSectionConfig {
  id: string;
  title: string;
  icon?: ReactNode;
  options: {
    id: string;
    label: string;
    count?: number;
    checked?: boolean;
  }[];
}

export interface FilterState {
  categories: string[];
  types: string[];
  rating: number[];
  verification: string[];
  location: string;
  onlineOnly: boolean;
  premiumOnly: boolean;
}

interface SearchSidebarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  resultCount: number;
  isOpen?: boolean;
  onClose?: () => void;
}

const PENIS_TYPES = [
  { id: 'straight', label: 'Straight', count: 1240 },
  { id: 'upward-curve', label: 'Upward Curve', count: 856 },
  { id: 'downward-curve', label: 'Downward Curve', count: 643 },
  { id: 'left-curve', label: 'Left Curve', count: 432 },
  { id: 'right-curve', label: 'Right Curve', count: 389 },
  { id: 'banana', label: 'Banana', count: 567 },
  { id: 'hook', label: 'Hook', count: 234 },
  { id: 'corkscrew', label: 'Corkscrew', count: 123 },
  { id: 'cone', label: 'Cone', count: 445 },
  { id: 'mushroom', label: 'Mushroom', count: 678 },
  { id: 'pencil', label: 'Pencil', count: 890 },
  { id: 'hammer', label: 'Hammer', count: 345 },
  { id: 'veiny', label: 'Veiny', count: 1567 },
  { id: 'smooth', label: 'Smooth', count: 1234 },
  { id: 'uncircumcised', label: 'Uncircumcised', count: 789 },
  { id: 'circumcised-tight', label: 'Circumcised (Tight)', count: 567 },
  { id: 'circumcised-loose', label: 'Circumcised (Loose)', count: 432 },
  { id: 'shower', label: 'Shower', count: 890 },
  { id: 'grower', label: 'Grower', count: 1234 },
  { id: 'micro', label: 'Micro', count: 234 },
  { id: 'small', label: 'Small', count: 567 },
  { id: 'average', label: 'Average', count: 3456 },
  { id: 'above-average', label: 'Above Average', count: 2345 },
  { id: 'large', label: 'Large', count: 1234 },
  { id: 'huge', label: 'Huge', count: 567 },
  { id: 'monster', label: 'Monster', count: 234 },
];

const VERIFICATION_LEVELS = [
  { id: 'email', label: 'Email Verified', icon: <CheckCircle2 size={14} /> },
  { id: 'photo', label: 'Photo Verified', icon: <CheckCircle2 size={14} /> },
  { id: 'video', label: 'Video Verified', icon: <CheckCircle2 size={14} /> },
  { id: 'id', label: 'ID Verified', icon: <CheckCircle2 size={14} /> },
  { id: 'premium', label: 'Premium Creator', icon: <Star size={14} /> },
];

const LOCATION_PRESETS = ['Nearby', 'Same Country', 'International'] as const;

export function SearchSidebar({ filters, onChange, onReset, resultCount, isOpen, onClose }: SearchSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['types', 'rating', 'verification']);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: 'categories' | 'types' | 'verification', value: string) => {
    const current = filters[key];
    const updated = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    updateFilter(key, updated);
  };

  const FilterSection = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => {
    const isExpanded = expandedSections.includes(id);

    return (
      <div className="border-b border-zinc-800 last:border-0">
        <button type="button" onClick={() => toggleSection(id)} className="flex w-full items-center justify-between py-4 text-left">
          <span className="font-semibold text-white">{title}</span>
          {isExpanded ? <ChevronUp size={20} className="text-zinc-500" /> : <ChevronDown size={20} className="text-zinc-500" />}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pb-4">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 p-4">
        <div className="flex items-center gap-2">
          <Filter size={20} className="text-amber-500" />
          <h2 className="font-bold text-white">Filters</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">{resultCount} results</span>
          {onClose ? (
            <button type="button" onClick={onClose} className="text-zinc-500 lg:hidden" aria-label="Close filters">
              <X size={24} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateFilter('onlineOnly', !filters.onlineOnly)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              filters.onlineOnly
                ? 'border-green-500/50 bg-green-500/20 text-green-400'
                : 'border-zinc-700 bg-zinc-800 text-zinc-400',
            )}
          >
            Online Now
          </button>
          <button
            type="button"
            onClick={() => updateFilter('premiumOnly', !filters.premiumOnly)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              filters.premiumOnly
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                : 'border-zinc-700 bg-zinc-800 text-zinc-400',
            )}
          >
            Premium Only
          </button>
        </div>

        <FilterSection id="types" title="Type (26 Categories)">
          <div className="custom-scrollbar max-h-64 space-y-2 overflow-y-auto pr-2">
            {PENIS_TYPES.map((type) => (
              <label key={type.id} className="group flex cursor-pointer items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={filters.types.includes(type.id)}
                    onCheckedChange={() => toggleArrayFilter('types', type.id)}
                    className="border-zinc-600 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
                  />
                  <span className="text-zinc-300 transition-colors group-hover:text-white">{type.label}</span>
                </div>
                <span className="text-sm text-zinc-600">{type.count}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection id="rating" title="Minimum Rating">
          <div className="px-2">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-zinc-400">Min Rating</span>
              <span className="flex items-center gap-1 font-bold text-amber-400">
                {filters.rating[0] || 0}
                <Star size={14} fill="currentColor" />
              </span>
            </div>
            <Slider value={filters.rating} onValueChange={(value) => updateFilter('rating', value)} max={10} step={0.5} className="mb-6" />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Any</span>
              <span>5+</span>
              <span>7+</span>
              <span>9+</span>
              <span>10</span>
            </div>
          </div>
        </FilterSection>

        <FilterSection id="verification" title="Verification">
          <div className="space-y-3">
            {VERIFICATION_LEVELS.map((level) => (
              <label key={level.id} className="group flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={filters.verification.includes(level.id)}
                  onCheckedChange={() => toggleArrayFilter('verification', level.id)}
                  className="border-zinc-600 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
                />
                <span className="flex items-center gap-2 text-zinc-400 transition-colors group-hover:text-white">
                  {level.icon}
                  {level.label}
                </span>
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection id="location" title="Location">
          <div className="space-y-3">
            <div className="relative">
              <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Enter city or region..."
                value={filters.location}
                onChange={(event) => updateFilter('location', event.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-4 text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {LOCATION_PRESETS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateFilter('location', filters.location === option ? '' : option)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    filters.location === option
                      ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </FilterSection>
      </div>

      <div className="space-y-2 border-t border-zinc-800 p-4">
        <Button onClick={onReset} variant="outline" className="w-full border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white">
          Reset All Filters
        </Button>
      </div>
    </div>
  );

  if (isOpen !== undefined) {
    return (
      <AnimatePresence>
        {isOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 z-50 h-full w-80 bg-zinc-950 lg:hidden"
            >
              {sidebarContent}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    );
  }

  return <div className="sticky top-0 h-screen w-80 border-r border-zinc-800 bg-zinc-950">{sidebarContent}</div>;
}

export const defaultFilters: FilterState = {
  categories: [],
  types: [],
  rating: [0],
  verification: [],
  location: '',
  onlineOnly: false,
  premiumOnly: false,
};

export type { FilterSectionConfig as FilterSection };
