"use client";
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import BoardColumn from '@/components/BoardColumn';
import TaskCard from '@/components/TaskCard';
import { Card, List } from '@/types/kanban';
import { 
  DndContext, 
  pointerWithin, 
  PointerSensor, 
  TouchSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent, 
  DragStartEvent, 
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { Plus, Loader2, Layout, User, Search, Filter } from 'lucide-react'; 

export default function Dashboard() {
  const [lists, setLists] = useState<List[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedColorFilter, setSelectedColorFilter] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  
  // Ref ini krusial untuk mencegah interupsi saat drag & drop
  const isDraggingRef = useRef(false);

  const boardColors = [
    { name: 'Red', value: '#fee2e2' },
    { name: 'Yellow', value: '#fef9c3' },
    { name: 'Green', value: '#dcfce7' },
    { name: 'Blue', value: '#dbeafe' },
    { name: 'Purple', value: '#f3e8ff' },
  ];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 10 } })
  );

  const fetchBoardData = useCallback(async (force = false) => {
    // Jangan refresh jika user sedang memegang kartu (mencegah flickering)
    if (isDraggingRef.current && !force) return;
    
    let { data: boardData } = await supabase.from('boards').select('id').limit(1).maybeSingle();
    
    if (boardData) {
      setCurrentBoardId(boardData.id);
      const { data } = await supabase
        .from('lists')
        .select(`
          id, 
          title, 
          position, 
          cards (
            id, 
            list_id, 
            content, 
            position, 
            label_color, 
            due_date,
            checklists (id, content, is_done)
          )
        `)
        .eq('board_id', boardData.id)
        .order('position', { ascending: true });

      if (data) {
        const sanitizedLists = data.map((list: any) => ({
          ...list,
          cards: (list.cards as Card[]).sort((a, b) => a.position - b.position)
        }));
        setLists(sanitizedLists);
      }
    }
    setLoading(false);
  }, []);

  // --- REALTIME SUBSCRIPTION UNTUK BOARD & CARDS ---
  useEffect(() => {
    fetchBoardData(true);

    const channel = supabase
      .channel('board-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, () => {
        fetchBoardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => {
        // Hanya sinkronisasi jika kita tidak sedang memindahkan kartu sendiri
        if (!isDraggingRef.current) fetchBoardData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchBoardData]);

  const filteredLists = useMemo(() => {
    return lists.map(list => ({
      ...list,
      cards: (list.cards || []).filter(card => {
        const matchesSearch = card.content.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesColor = selectedColorFilter ? card.label_color === selectedColorFilter : true;
        return matchesSearch && matchesColor;
      })
    }));
  }, [lists, searchQuery, selectedColorFilter]);

  const handleDragStart = (event: DragStartEvent) => {
    isDraggingRef.current = true; // Kunci realtime
    const { active } = event;
    const card = lists.flatMap(l => l.cards).find(c => c.id === active.id);
    if (card) setActiveCard(card);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    
    if (!over) {
      isDraggingRef.current = false;
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    
    const sourceList = lists.find(l => l.cards.some(c => c.id === activeId));
    const destList = lists.find(l => l.id === overId || l.cards.some(c => c.id === overId));

    if (!sourceList || !destList) {
      isDraggingRef.current = false;
      return;
    }

    // --- OPTIMISTIC UPDATE (UI Berubah Seketika) ---
    const activeCardObj = sourceList.cards.find(c => c.id === activeId)!;
    const newLists = [...lists];
    const sIdx = newLists.findIndex(l => l.id === sourceList.id);
    const dIdx = newLists.findIndex(l => l.id === destList.id);
    
    newLists[sIdx].cards = newLists[sIdx].cards.filter(c => c.id !== activeId);
    const overCardIdx = destList.cards.findIndex(c => c.id === overId);
    const insertIdx = overCardIdx >= 0 ? overCardIdx : destList.cards.length;
    
    newLists[dIdx].cards.splice(insertIdx, 0, { ...activeCardObj, list_id: destList.id });
    setLists(newLists); 

    // --- DATABASE UPDATE ---
    await supabase.from('cards').update({ list_id: destList.id }).eq('id', activeId);
    
    // Beri sedikit jeda sebelum membuka kunci realtime agar DB selesai memproses
    setTimeout(() => {
      isDraggingRef.current = false;
      fetchBoardData(true);
    }, 500);
  };

  const handleAddList = async () => {
    if (!newListTitle.trim() || !currentBoardId) return;
    const nextPosition = lists.length > 0 ? Math.max(...lists.map(l => l.position)) + 1 : 1;
    await supabase.from('lists').insert([{ title: newListTitle.toUpperCase(), board_id: currentBoardId, position: nextPosition }]);
    setNewListTitle("");
    setIsModalOpen(false);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
        <nav className="h-20 bg-white border-b border-slate-200 px-10 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg"><Layout size={20} className="text-white" /></div>
            <h1 className="text-xl font-black italic tracking-tighter text-slate-800">TASKFLOW.</h1>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 w-96">
            <Search size={16} className="text-slate-400" />
            <input type="text" placeholder="Search tasks..." className="bg-transparent outline-none text-xs font-bold w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center"><User size={20} className="text-slate-500" /></div>
        </nav>

        <main className="flex-1 p-10">
          <div className="max-w-[1400px] mx-auto">
            <div className="mb-10 flex items-center gap-4">
               <div className="bg-white p-2.5 px-5 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center gap-4">
                <Filter size={14} className="text-slate-400" />
                <button onClick={() => setSelectedColorFilter(null)} className={`text-[10px] font-black px-4 py-2 rounded-xl transition-all ${!selectedColorFilter ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>ALL</button>
                {boardColors.map(color => (
                  <button key={color.value} onClick={() => setSelectedColorFilter(selectedColorFilter === color.value ? null : color.value)} className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${selectedColorFilter === color.value ? 'border-slate-900 scale-125' : 'border-transparent'}`} style={{ backgroundColor: color.value }} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 items-start">
              {filteredLists.map((list) => (
                <BoardColumn key={list.id} list={list} onUpdate={() => fetchBoardData(true)} />
              ))}
              <button onClick={() => setIsModalOpen(true)} className="w-full h-56 border-4 border-dashed border-slate-200 rounded-[3.5rem] flex flex-col items-center justify-center gap-4 text-slate-300 hover:border-blue-400 hover:text-blue-500 transition-all bg-white/30 hover:bg-white/60">
                <Plus size={32} />
                <span className="font-black text-[11px] uppercase tracking-[0.3em]">New Section</span>
              </button>
            </div>
          </div>
        </main>
      </div>

      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
        {activeCard ? <div className="w-[320px] rotate-3 scale-105"><TaskCard card={activeCard} isOverlay /></div> : null}
      </DragOverlay>

      {/* Modal Create Section tetap sama seperti sebelumnya */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-[3.5rem] p-12 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-black text-slate-900 text-2xl uppercase italic mb-8 text-center tracking-tighter">Create Section</h3>
            <input autoFocus className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] mb-8 outline-none text-center font-bold text-lg" placeholder="e.g. TODO" value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddList()} />
            <button onClick={handleAddList} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors">Create Now</button>
          </div>
        </div>
      )}
    </DndContext>
  );
}