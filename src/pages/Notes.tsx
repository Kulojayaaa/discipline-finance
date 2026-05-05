import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Search, Pin, Trash2, Edit2, Tag, X } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

const NOTE_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

const TAG_COLORS = [
  'bg-violet-500/20 text-violet-700 dark:text-violet-300',
  'bg-pink-500/20 text-pink-700 dark:text-pink-300',
  'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  'bg-blue-500/20 text-blue-700 dark:text-blue-300',
];

const emptyForm = { title: '', content: '', color: '#6366F1', tags: '' };

export default function Notes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Tables<'notes'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<Tables<'notes'> | null>(null);
  const [deletingNote, setDeletingNote] = useState<Tables<'notes'> | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (user) fetchNotes();
  }, [user]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setNotes(data || []);
    } catch {
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!user || !formData.title) return;
    try {
      const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
      const { error } = await supabase.from('notes').insert({
        user_id: user.id,
        title: formData.title,
        content: formData.content,
        color: formData.color,
        tags: tags.length > 0 ? tags : null,
      });
      if (error) throw error;
      toast.success('Note added!');
      setFormData(emptyForm);
      setShowAddDialog(false);
      fetchNotes();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add note');
    }
  };

  const saveEditNote = async () => {
    if (!editingNote || !formData.title) return;
    try {
      const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
      const { error } = await supabase
        .from('notes')
        .update({
          title: formData.title,
          content: formData.content,
          color: formData.color,
          tags: tags.length > 0 ? tags : null,
        })
        .eq('id', editingNote.id);
      if (error) throw error;
      toast.success('Note updated!');
      setEditingNote(null);
      setFormData(emptyForm);
      fetchNotes();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update note');
    }
  };

  const togglePin = async (id: string, currentPinned: boolean) => {
    try {
      const { error } = await supabase.from('notes').update({ is_pinned: !currentPinned }).eq('id', id);
      if (error) throw error;
      fetchNotes();
    } catch {
      toast.error('Failed to update note');
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
      toast.success('Note deleted');
      setDeletingNote(null);
      fetchNotes();
    } catch {
      toast.error('Failed to delete note');
    }
  };

  const openEditDialog = (note: Tables<'notes'>) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content || '',
      color: note.color || '#6366F1',
      tags: (note.tags || []).join(', '),
    });
  };

  // All unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(n => (n.tags || []).forEach(t => tags.add(t)));
    return [...tags];
  }, [notes]);

  const filteredNotes = useMemo(() => notes.filter(note => {
    const matchesSearch =
      note.title.toLowerCase().includes(search.toLowerCase()) ||
      (note.content?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesTag = activeTag ? (note.tags || []).includes(activeTag) : true;
    return matchesSearch && matchesTag;
  }), [notes, search, activeTag]);

  const NoteForm = ({ onSave, saveLabel }: { onSave: () => void; saveLabel: string }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Note title"
        />
      </div>
      <div className="space-y-2">
        <Label>Content</Label>
        <Textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="Write your note..."
          rows={5}
        />
      </div>
      <div className="space-y-2">
        <Label>Tags (comma-separated)</Label>
        <Input
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          placeholder="e.g., work, ideas, personal"
        />
      </div>
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData({ ...formData, color })}
              className={cn('w-8 h-8 rounded-full transition-all', formData.color === color && 'ring-2 ring-offset-2 ring-primary')}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <Button onClick={onSave} className="w-full" disabled={!formData.title}>
        {saveLabel}
      </Button>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Notes</h1>
            <p className="text-muted-foreground">Capture your thoughts and ideas</p>
          </div>
          <Button className="gradient-warm" onClick={() => { setFormData(emptyForm); setShowAddDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Note
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="pl-10"
          />
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <button
              onClick={() => setActiveTag(null)}
              className={cn('text-xs px-2 py-1 rounded-full transition-colors', !activeTag ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
            >
              All
            </button>
            {allTags.map((tag, idx) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={cn('text-xs px-2 py-1 rounded-full transition-colors', activeTag === tag ? 'bg-primary text-white' : TAG_COLORS[idx % TAG_COLORS.length])}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Notes Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonCard count={3} />
          </div>
        ) : filteredNotes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {search || activeTag ? 'No notes found matching your filters' : 'No notes yet. Create your first note!'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.map((note) => (
              <Card
                key={note.id}
                className="group relative overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                style={{ borderTopColor: note.color || '#6366F1', borderTopWidth: '4px' }}
                onClick={() => openEditDialog(note)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-foreground line-clamp-1">{note.title}</h3>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => togglePin(note.id, note.is_pinned || false)}
                        className="h-7 w-7"
                      >
                        <Pin className={cn('w-3.5 h-3.5', note.is_pinned && 'fill-current text-primary')} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingNote(note)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-4 mb-3">
                    {note.content || 'No content'}
                  </p>
                  {(note.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(note.tags || []).map((tag, idx) => (
                        <span key={tag} className={cn('text-xs px-1.5 py-0.5 rounded-full', TAG_COLORS[idx % TAG_COLORS.length])}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(note.updated_at), 'dd MMM yyyy')}
                  </p>
                  {note.is_pinned && (
                    <div className="absolute top-2 right-2">
                      <Pin className="w-4 h-4 fill-current text-primary" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Note</DialogTitle>
          </DialogHeader>
          <NoteForm onSave={addNote} saveLabel="Add Note" />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingNote} onOpenChange={(open) => { if (!open) { setEditingNote(null); setFormData(emptyForm); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit2 className="w-4 h-4" /> Edit Note</DialogTitle>
          </DialogHeader>
          <NoteForm onSave={saveEditNote} saveLabel="Save Changes" />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingNote} onOpenChange={(open) => { if (!open) setDeletingNote(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingNote?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingNote && deleteNote(deletingNote.id)} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
