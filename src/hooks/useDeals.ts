import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Deal } from '@/types/deal';

export const useDeals = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });
    setDeals((data as Deal[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDeals(); }, []);

  const createDeal = async (deal: Omit<Deal, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    const { error } = await supabase.from('deals').insert(deal as any);
    if (!error) await fetchDeals();
    return { error };
  };

  const updateDeal = async (id: string, deal: Partial<Deal>) => {
    const { error } = await supabase.from('deals').update(deal as any).eq('id', id);
    if (!error) await fetchDeals();
    return { error };
  };

  const deleteDeal = async (id: string) => {
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (!error) await fetchDeals();
    return { error };
  };

  return { deals, loading, fetchDeals, createDeal, updateDeal, deleteDeal };
};

export const useActiveDeals = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('deals')
      .select('*')
      .eq('is_active', true)
      .lte('valid_from', today)
      .gte('valid_until', today)
      .then(({ data }) => {
        setDeals((data as Deal[]) || []);
        setLoading(false);
      });
  }, []);

  return { deals, loading };
};
