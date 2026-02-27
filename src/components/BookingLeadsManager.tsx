import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Users, Search, X, Trash2, Pencil, Eye, CreditCard, Plane,
  Phone, Mail, Calendar, MapPin, Tag, MessageSquare, Copy, ExternalLink, Filter,
} from 'lucide-react';

interface BookingLead {
  id: string;
  booking_number: string | null;
  full_name: string;
  email: string;
  phone: string;
  card_last_four: string | null;
  card_expiry: string | null;
  flight_details: any;
  status: string;
  admin_notes: any[];
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'completed', label: 'Completed', color: 'bg-primary/10 text-primary' },
];

const getStatusStyle = (status: string) =>
  STATUS_OPTIONS.find(s => s.value === status)?.color || 'bg-muted text-muted-foreground';

const getStatusLabel = (status: string) =>
  STATUS_OPTIONS.find(s => s.value === status)?.label || status;

interface BookingLeadsManagerProps {
  leads: BookingLead[];
  onRefresh: () => void;
}

export const BookingLeadsManager = ({ leads, onRefresh }: BookingLeadsManagerProps) => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<BookingLead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (statusFilter !== 'all') {
      result = result.filter(l => l.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.full_name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.booking_number || '').toLowerCase().includes(q) ||
        (l.flight_details?.origin || '').toLowerCase().includes(q) ||
        (l.flight_details?.destination || '').toLowerCase().includes(q) ||
        (l.flight_details?.airline || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, search, statusFilter]);

  const openDetail = (lead: BookingLead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
  };

  const openEdit = (lead: BookingLead) => {
    setSelectedLead(lead);
    setEditStatus(lead.status);
    setNoteText('');
    setEditOpen(true);
  };

  const handleStatusUpdate = async () => {
    if (!selectedLead) return;
    setSaving(true);
    const notes = Array.isArray(selectedLead.admin_notes) ? [...selectedLead.admin_notes] : [];
    if (noteText.trim()) {
      notes.push({
        text: noteText.trim(),
        timestamp: new Date().toISOString(),
        action: editStatus !== selectedLead.status ? `Status → ${getStatusLabel(editStatus)}` : 'Comment',
      });
    } else if (editStatus !== selectedLead.status) {
      notes.push({
        text: `Status changed to ${getStatusLabel(editStatus)}`,
        timestamp: new Date().toISOString(),
        action: 'Status change',
      });
    }

    const { error } = await supabase
      .from('booking_leads')
      .update({ status: editStatus, admin_notes: notes as any } as any)
      .eq('id', selectedLead.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Lead updated' });
      setEditOpen(false);
      onRefresh();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('booking_leads').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Lead deleted' });
      setDeleteConfirm(null);
      onRefresh();
    }
  };

  const copyBookingLink = (lead: BookingLead) => {
    const url = `${window.location.origin}/admin?booking=${lead.booking_number}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied!' });
  };

  const fd = (lead: BookingLead) => lead.flight_details || {};

  return (
    <div>
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Booking Leads
          <Badge variant="secondary" className="ml-2 text-xs">{filteredLeads.length}</Badge>
        </h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, booking..."
              className="pl-9 pr-8 h-9 w-64 bg-background"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lead Cards Grid */}
      {filteredLeads.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border/50">
          <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No leads found</h3>
          <p className="text-muted-foreground">
            {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Leads will appear here when customers book.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLeads.map(lead => (
            <div
              key={lead.id}
              className="bg-card rounded-xl border border-border/50 card-shadow hover:shadow-md transition-all cursor-pointer group"
              onClick={() => openDetail(lead)}
            >
              <div className="p-5">
                {/* Top row: booking number + status */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground">
                      {lead.booking_number || '—'}
                    </code>
                    <button
                      onClick={e => { e.stopPropagation(); copyBookingLink(lead); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy booking link"
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  <Badge className={`text-[10px] font-semibold ${getStatusStyle(lead.status)}`}>
                    {getStatusLabel(lead.status)}
                  </Badge>
                </div>

                {/* Customer info */}
                <h3 className="font-semibold text-foreground text-lg mb-1">{lead.full_name}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {lead.email}</span>
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {lead.phone}</span>
                </div>

                {/* Flight info */}
                <div className="bg-muted/30 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Plane className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-foreground truncate">
                      {fd(lead).origin || '—'} → {fd(lead).destination || '—'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {fd(lead).airline && <span>{fd(lead).airline}</span>}
                    <span className="font-semibold text-primary">{fd(lead).price || '—'}</span>
                    {fd(lead).deal && <span className="text-accent">🏷 {fd(lead).deal}</span>}
                  </div>
                </div>

                {/* Card + date */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {lead.card_last_four && (
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5" /> •••• {lead.card_last_four}
                      </span>
                    )}
                    {(lead.admin_notes?.length || 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" /> {lead.admin_notes.length}
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Action bar */}
              <div className="border-t border-border/30 px-5 py-2 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={e => { e.stopPropagation(); openEdit(lead); }}>
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteConfirm(lead.id); }}>
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETAIL DIALOG */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Booking {selectedLead.booking_number}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <Badge className={`${getStatusStyle(selectedLead.status)} text-sm px-3 py-1`}>
                    {getStatusLabel(selectedLead.status)}
                  </Badge>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => copyBookingLink(selectedLead)}>
                      <Copy className="h-3.5 w-3.5" /> Copy Link
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { setDetailOpen(false); openEdit(selectedLead); }}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                </div>

                {/* Customer */}
                <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-primary" /> Customer
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Name</span><p className="font-medium text-foreground">{selectedLead.full_name}</p></div>
                    <div><span className="text-muted-foreground">Email</span><p className="font-medium text-foreground">{selectedLead.email}</p></div>
                    <div><span className="text-muted-foreground">Phone</span><p className="font-medium text-foreground">{selectedLead.phone}</p></div>
                    <div><span className="text-muted-foreground">Submitted</span><p className="font-medium text-foreground">{new Date(selectedLead.created_at).toLocaleString()}</p></div>
                  </div>
                </div>

                {/* Payment */}
                <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-primary" /> Payment Card
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Card Number</span>
                      <p className="font-medium text-foreground font-mono">
                        •••• •••• •••• {selectedLead.card_last_four || '????'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expiry</span>
                      <p className="font-medium text-foreground font-mono">{selectedLead.card_expiry || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Flight */}
                <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Plane className="h-4 w-4 text-primary" /> Flight Details
                  </h4>
                  {(() => {
                    const f = fd(selectedLead);
                    return (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-muted-foreground">Route</span><p className="font-medium text-foreground">{f.origin} → {f.destination}</p></div>
                        <div><span className="text-muted-foreground">Airline</span><p className="font-medium text-foreground">{f.airline || '—'}</p></div>
                        <div><span className="text-muted-foreground">Price</span><p className="font-medium text-primary text-lg">{f.price || '—'}</p></div>
                        <div><span className="text-muted-foreground">Stops</span><p className="font-medium text-foreground">{f.stops != null ? f.stops : '—'}</p></div>
                        {f.departure && <div><span className="text-muted-foreground">Departure</span><p className="font-medium text-foreground">{f.departure}</p></div>}
                        {f.arrival && <div><span className="text-muted-foreground">Arrival</span><p className="font-medium text-foreground">{f.arrival}</p></div>}
                        {f.originalPrice && f.originalPrice !== f.price && (
                          <div><span className="text-muted-foreground">Original Price</span><p className="font-medium text-muted-foreground line-through">{f.originalPrice}</p></div>
                        )}
                        {f.deal && <div><span className="text-muted-foreground">Deal</span><p className="font-medium text-accent">{f.deal}</p></div>}
                        {f.returnLeg && (
                          <div className="col-span-2 pt-2 border-t border-border/30">
                            <span className="text-muted-foreground">Return</span>
                            <p className="font-medium text-foreground">{f.returnLeg.origin} → {f.returnLeg.destination} · {f.returnLeg.departure}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-primary" /> Activity Log
                    <Badge variant="secondary" className="text-[10px]">{selectedLead.admin_notes?.length || 0}</Badge>
                  </h4>
                  {(selectedLead.admin_notes || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No notes yet</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(selectedLead.admin_notes || []).slice().reverse().map((note: any, i: number) => (
                        <div key={i} className="bg-muted/40 rounded-lg p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-[10px]">{note.action || 'Note'}</Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(note.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-foreground">{note.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Lead — {selectedLead.booking_number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Add Comment</Label>
                  <Textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add a note about this booking..."
                    maxLength={500}
                    rows={3}
                  />
                </div>
                <Button variant="sky" className="w-full" onClick={handleStatusUpdate} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM DIALOG */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Booking Lead?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone. The lead and all its notes will be permanently removed.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
