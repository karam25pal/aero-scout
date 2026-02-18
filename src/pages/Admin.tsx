import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDeals } from '@/hooks/useDeals';
import { Deal } from '@/types/deal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plane, Plus, Pencil, Trash2, LogOut, Tag } from 'lucide-react';
import { AirportAutocomplete } from '@/components/AirportAutocomplete';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type DealForm = {
  title: string;
  description: string;
  airline_name: string;
  origin_airport: string;
  destination_airport: string;
  valid_from: string;
  valid_until: string;
  discount_type: 'fixed' | 'percentage';
  discount_value: string;
  special_price: string;
  is_active: boolean;
};

const emptyForm: DealForm = {
  title: '', description: '', airline_name: '', origin_airport: '', destination_airport: '',
  valid_from: '', valid_until: '', discount_type: 'percentage', discount_value: '', special_price: '', is_active: true,
};

const Admin = () => {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const { deals, loading: dealsLoading, createDeal, updateDeal, deleteDeal } = useDeals();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<DealForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/admin/login');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && user && !isAdmin) {
      toast({ title: 'Access denied', description: 'You do not have admin privileges.', variant: 'destructive' });
      navigate('/');
    }
  }, [authLoading, user, isAdmin, navigate, toast]);

  if (authLoading || !user || !isAdmin) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (deal: Deal) => {
    setForm({
      title: deal.title,
      description: deal.description || '',
      airline_name: deal.airline_name || '',
      origin_airport: deal.origin_airport || '',
      destination_airport: deal.destination_airport || '',
      valid_from: deal.valid_from,
      valid_until: deal.valid_until,
      discount_type: deal.discount_type,
      discount_value: String(deal.discount_value),
      special_price: deal.special_price != null ? String(deal.special_price) : '',
      is_active: deal.is_active,
    });
    setEditingId(deal.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      airline_name: form.airline_name.trim() || null,
      origin_airport: form.origin_airport.trim().toUpperCase() || null,
      destination_airport: form.destination_airport.trim().toUpperCase() || null,
      valid_from: form.valid_from,
      valid_until: form.valid_until,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      special_price: form.special_price.trim() ? parseFloat(form.special_price) : null,
      is_active: form.is_active,
    };

    const { error } = editingId
      ? await updateDeal(editingId, payload)
      : await createDeal(payload);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editingId ? 'Deal updated' : 'Deal created' });
      setDialogOpen(false);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteDeal(id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Deal deleted' });
  };

  const handleToggle = async (deal: Deal) => {
    await updateDeal(deal.id, { is_active: !deal.is_active });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg"><Plane className="h-5 w-5 text-primary-foreground" /></div>
            <span className="text-xl font-bold text-foreground">SkySearch Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to site</a>
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate('/admin/login'))}>
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" /> Manage Deals
          </h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="sky" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Deal</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Deal' : 'Create Deal'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required maxLength={100} /></div>
                <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={500} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Airline Name</Label><Input value={form.airline_name} onChange={e => setForm({ ...form, airline_name: e.target.value })} placeholder="e.g. British Airways" maxLength={100} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>From Airport</Label><AirportAutocomplete value={form.origin_airport} onChange={(val) => setForm({ ...form, origin_airport: val })} placeholder="Search airport..." iataOnly /></div>
                  <div><Label>To Airport</Label><AirportAutocomplete value={form.destination_airport} onChange={(val) => setForm({ ...form, destination_airport: val })} placeholder="Search airport..." iataOnly /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Valid From *</Label><Input type="date" value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} required /></div>
                  <div><Label>Valid Until *</Label><Input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} required /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Discount Type *</Label>
                    <Select value={form.discount_type} onValueChange={v => setForm({ ...form, discount_type: v as 'fixed' | 'percentage' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Amount (£)</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Discount Value *</Label><Input type="number" min="0.01" step="0.01" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} required placeholder={form.discount_type === 'fixed' ? '50' : '15'} /></div>
                </div>
                <div>
                  <Label>Special Price (£) — overrides discount if set</Label>
                  <Input type="number" min="0" step="0.01" value={form.special_price} onChange={e => setForm({ ...form, special_price: e.target.value })} placeholder="Leave empty to use discount" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                  <Label>Active</Label>
                </div>
                <Button type="submit" disabled={submitting} variant="sky" className="w-full">
                  {submitting ? 'Saving...' : editingId ? 'Update Deal' : 'Create Deal'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {dealsLoading ? (
          <p className="text-muted-foreground text-center py-16">Loading deals...</p>
        ) : deals.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border/50">
            <Tag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No deals yet</h3>
            <p className="text-muted-foreground">Create your first deal to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deals.map(deal => (
              <div key={deal.id} className="bg-card rounded-xl p-6 border border-border/50 card-shadow flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{deal.title}</h3>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${deal.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-muted text-muted-foreground'}`}>
                      {deal.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {deal.airline_name && `${deal.airline_name} · `}
                    {deal.origin_airport && deal.destination_airport ? `${deal.origin_airport} → ${deal.destination_airport} · ` : ''}
                    {deal.special_price != null ? `Special: £${deal.special_price}` : deal.discount_type === 'fixed' ? `£${deal.discount_value} off` : `${deal.discount_value}% off`}
                    {` · ${deal.valid_from} to ${deal.valid_until}`}
                  </p>
                  {deal.description && <p className="text-sm text-muted-foreground mt-1">{deal.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={deal.is_active} onCheckedChange={() => handleToggle(deal)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(deal)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(deal.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;
