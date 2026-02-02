"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/types/kanban';
import { supabase } from '@/lib/supabase';
import { 
  X, Calendar, AlertCircle, AlignLeft, CheckSquare, Clock, ChevronRight, Palette, ListTodo, Plus, Trash2
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  content: string;
  is_done: boolean;
}

export default function TaskCard({ card, isOverlay, onUpdate }: { card: Card; isOverlay?: boolean; onUpdate?: () => void }) {
  // --- KONFIGURASI WARNA ---
  const colors = [
    { name: 'White', value: '#ffffff' },
    { name: 'Red', value: '#fee2e2' },
    { name: 'Yellow', value: '#fef9c3' },
    { name: 'Green', value: '#dcfce7' },
    { name: 'Blue', value: '#dbeafe' },
    { name: 'Purple', value: '#f3e8ff' },
  ];

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const [newContent, setNewContent] = useState(card?.content || "");
  const [newColor, setNewColor] = useState(card?.label_color || '#ffffff');
  const [newDate, setNewDate] = useState(card?.due_date || '');

  const [checklists, setChecklists] = useState<ChecklistItem[]>(card.checklists || []);
  const [newChecklistText, setNewChecklistText] = useState("");

  // Sinkronisasi jika data props dari page.tsx berubah
  useEffect(() => {
    if (card.checklists) {
      setChecklists(card.checklists);
    }
  }, [card.checklists]);

  const fetchChecklists = useCallback(async () => {
    const { data } = await supabase
      .from('checklists')
      .select('*')
      .eq('card_id', card.id)
      .order('created_at', { ascending: true });
    if (data) setChecklists(data);
  }, [card.id]);

  // Realtime Listener
  useEffect(() => {
    const channel = supabase
      .channel(`card-realtime-${card.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklists', filter: `card_id=eq.${card.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setChecklists((prev) => [...prev, payload.new as ChecklistItem]);
          } else if (payload.eventType === 'UPDATE') {
            setChecklists((prev) =>
              prev.map((item) => (item.id === payload.new.id ? (payload.new as ChecklistItem) : item))
            );
          } else if (payload.eventType === 'DELETE') {
            setChecklists((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
          onUpdate?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [card.id, onUpdate]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card?.id || 'temp',
    disabled: showDeleteModal || showDetailModal,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    backgroundColor: card.label_color || '#ffffff',
    touchAction: 'none'
  };

  const handleUpdate = async (overrides = {}) => {
    const payload = { content: newContent, label_color: newColor, due_date: newDate || null, ...overrides };
    await supabase.from('cards').update(payload).eq('id', card.id);
    onUpdate?.();
  };

  const addChecklistItem = async () => {
    if (!newChecklistText.trim()) return;
    const { error } = await supabase
      .from('checklists')
      .insert([{ card_id: card.id, content: newChecklistText.toUpperCase(), is_done: false }]);
    if (!error) setNewChecklistText("");
  };

  const toggleChecklist = async (id: string, currentStatus: boolean) => {
    setChecklists(prev => prev.map(item => item.id === id ? { ...item, is_done: !currentStatus } : item));
    await supabase.from('checklists').update({ is_done: !currentStatus }).eq('id', id);
  };

  const deleteChecklistItem = async (id: string) => {
    await supabase.from('checklists').delete().eq('id', id);
  };

  const completedCount = checklists.filter(i => i.is_done).length;
  const progress = checklists.length > 0 ? (completedCount / checklists.length) * 100 : 0;
  const isOverdue = card.due_date ? new Date(card.due_date) < new Date(new Date().setHours(0,0,0,0)) : false;

  return (
    <>
      <div
        ref={setNodeRef} style={style} {...attributes} {...listeners}
        onClick={() => { fetchChecklists(); setShowDetailModal(true); }}
        className={`group p-6 rounded-[2.5rem] border border-slate-200/60 relative w-full cursor-pointer hover:shadow-2xl transition-all duration-300 ${
          isOverlay ? 'scale-105 rotate-2 shadow-2xl z-[100]' : 'shadow-sm'
        }`}
      >
        <div className="flex flex-col gap-5">
          <p className="text-[14px] text-slate-800 font-black uppercase italic leading-snug">{card.content}</p>
          {checklists.length > 0 && (
            <div className="w-full h-1 bg-black/5 rounded-full overflow-hidden">
               <div className="h-full bg-slate-900 transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {card.due_date && (
                <div className={`flex items-center gap-1.5 text-[9px] font-black px-3 py-1.5 rounded-full border border-black/5 uppercase ${isOverdue ? 'bg-red-500 text-white shadow-lg' : 'bg-white/80 text-slate-600'}`}>
                  <Clock size={10} /> {new Date(card.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </div>
              )}
              {checklists.length > 0 && (
                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 bg-white/40 px-2 py-1 rounded-lg">
                  <CheckSquare size={10} /> {completedCount}/{checklists.length}
                </div>
              )}
            </div>
            <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
          </div>
        </div>
      </div>

      {showDetailModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[4rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
            <div className="h-28 shrink-0 relative" style={{ backgroundColor: newColor }}>
                <button onClick={() => setShowDetailModal(false)} className="absolute top-8 right-10 p-4 bg-white/20 hover:bg-white/40 rounded-full transition-all shadow-lg"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 md:p-16 -mt-12 bg-white rounded-t-[4rem]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                    <div className="lg:col-span-8 space-y-12">
                        <div className="space-y-4">
                          <label className="text-[11px] font-black uppercase text-slate-400 flex items-center gap-3">
                            <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center"><AlignLeft size={12}/></div> Task Title
                          </label>
                          <textarea className="w-full text-3xl font-black text-slate-900 uppercase bg-slate-50 p-8 rounded-[2.5rem] outline-none border-none resize-none focus:bg-slate-100 transition-all" rows={2} value={newContent} onChange={(e) => setNewContent(e.target.value)} onBlur={() => handleUpdate()} />
                        </div>

                        <div className="space-y-8">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-black uppercase text-slate-400 flex items-center gap-3">
                              <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center"><ListTodo size={12} className="text-white"/></div> Progress
                            </label>
                            <span className="text-[10px] font-black text-slate-900 bg-slate-100 px-4 py-1.5 rounded-full italic">
                              {completedCount} of {checklists.length} Done
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden -mt-4">
                            <div className="h-full bg-slate-900 transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
                          </div>

                          <div className="space-y-3">
                            {checklists.map(item => (
                              <div key={item.id} className={`group flex items-center gap-5 p-5 rounded-[2.2rem] transition-all duration-300 ${item.is_done ? 'bg-slate-50 opacity-60' : 'bg-white border border-slate-100 hover:shadow-xl'}`}>
                                <button onClick={() => toggleChecklist(item.id, item.is_done)} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${item.is_done ? 'bg-green-500 border-green-500 scale-110' : 'border-slate-200 hover:border-slate-400'}`}>
                                  {item.is_done && <CheckSquare size={14} className="text-white" />}
                                </button>
                                <span className={`flex-1 text-sm font-bold uppercase ${item.is_done ? 'line-through text-slate-400 italic' : 'text-slate-800'}`}>{item.content}</span>
                                <button onClick={() => deleteChecklistItem(item.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                              </div>
                            ))}
                            <div className="relative mt-8">
                              <input className="w-full p-6 pl-8 pr-20 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-[2.5rem] text-sm font-bold uppercase outline-none transition-all" placeholder="New step..." value={newChecklistText} onChange={(e) => setNewChecklistText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()} />
                              <button onClick={addChecklistItem} className="absolute right-3 top-1/2 -translate-y-1/2 p-4 bg-slate-900 text-white rounded-[1.8rem] shadow-xl hover:scale-105 active:scale-95 transition-all"><Plus size={20}/></button>
                            </div>
                          </div>
                        </div>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                        <div className="bg-slate-50/80 rounded-[3rem] p-10 border border-slate-100 space-y-10">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase block mb-6 flex items-center gap-2"><Palette size={14}/> Appearance</span>
                                <div className="flex flex-wrap gap-3">
                                    {colors.map(c => (
                                        <button key={c.value} onClick={() => { setNewColor(c.value); handleUpdate({ label_color: c.value }); }} className={`w-9 h-9 rounded-full border-2 transition-all ${newColor === c.value ? 'border-slate-900 scale-110 shadow-xl' : 'border-transparent shadow-sm hover:scale-105'}`} style={{ backgroundColor: c.value }} />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase block mb-6 flex items-center gap-2"><Calendar size={14}/> Deadline</span>
                                <input type="date" value={newDate} onChange={(e) => { setNewDate(e.target.value); handleUpdate({ due_date: e.target.value }); }} className="w-full bg-white px-6 py-4 rounded-[1.5rem] text-xs font-black border border-slate-200 outline-none focus:border-slate-900 transition-all" />
                            </div>
                            <hr className="border-slate-200" />
                            <button onClick={() => { setShowDetailModal(false); setShowDeleteModal(true); }} className="w-full py-5 text-red-500 hover:bg-red-50 rounded-[1.8rem] text-[11px] font-black uppercase tracking-widest transition-all">Delete Card</button>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white w-full max-w-xs rounded-[4rem] p-12 shadow-2xl text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8 text-red-500"><AlertCircle size={40} /></div>
            <h3 className="text-2xl font-black mb-8 uppercase italic">Delete?</h3>
            <div className="flex flex-col gap-4">
              <button onClick={async () => { await supabase.from('cards').delete().eq('id', card.id); onUpdate?.(); }} className="w-full py-5 bg-red-500 text-white rounded-[1.8rem] font-black text-xs uppercase shadow-xl shadow-red-200">Yes, Delete</button>
              <button onClick={() => setShowDeleteModal(false)} className="w-full py-5 bg-slate-100 text-slate-500 rounded-[1.8rem] font-black text-xs uppercase">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}