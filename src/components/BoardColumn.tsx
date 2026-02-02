"use client";
import React, { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCard from './TaskCard';
import { List, Card } from '@/types/kanban';
import { supabase } from '@/lib/supabase';
import { Plus, X, Trash2, AlertTriangle } from 'lucide-react';

export default function BoardColumn({ list, onUpdate }: { list: List; onUpdate: () => void }) {
  const { setNodeRef } = useDroppable({ id: list.id });
  const [isAdding, setIsAdding] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const [content, setContent] = useState("");
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [dueDate, setDueDate] = useState('');

  const colors = [
    { name: 'White', value: '#ffffff' },
    { name: 'Red', value: '#fee2e2' },
    { name: 'Yellow', value: '#fef9c3' },
    { name: 'Green', value: '#dcfce7' },
    { name: 'Blue', value: '#dbeafe' },
    { name: 'Purple', value: '#f3e8ff' },
  ];

  // --- PROTEKSI DUPLIKASI KEY ---
  // Kita menyaring list.cards agar hanya ID yang unik yang masuk ke proses Render
  const uniqueCards = useMemo(() => {
    const seen = new Set();
    return (list.cards || []).filter(card => {
      if (seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    });
  }, [list.cards]);

  const handleAddTask = async () => {
    if (!content.trim()) return setIsAdding(false);
    const { error } = await supabase.from('cards').insert([{
      list_id: list.id,
      content: content,
      position: list.cards.length + 1,
      label_color: selectedColor,
      due_date: dueDate || null
    }]);

    if (!error) {
      setContent("");
      setSelectedColor('#ffffff');
      setDueDate('');
      setIsAdding(false);
      onUpdate();
    }
  };

  const handleDeleteList = async () => {
    const { error } = await supabase.from('lists').delete().eq('id', list.id);
    if (!error) {
      setShowDeleteModal(false);
      onUpdate();
    }
  };

  return (
    <>
      <div className="flex flex-col w-full bg-slate-200/50 rounded-[2.5rem] p-4 min-h-[300px]">
        {/* Header Kolom */}
        <div className="flex justify-between items-center mb-5 px-3 pt-2">
          <h3 className="font-black text-slate-700 uppercase tracking-widest text-[11px]">
            {list.title} <span className="ml-1 text-slate-400">({uniqueCards.length})</span>
          </h3>
          <button 
            onClick={() => setShowDeleteModal(true)}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* List Kartu dengan SortableContext */}
        <div ref={setNodeRef} className="flex flex-col gap-3 min-h-[150px]">
          <SortableContext 
            items={uniqueCards.map(c => c.id)} 
            strategy={verticalListSortingStrategy}
          >
            {uniqueCards.map((card) => (
              <TaskCard 
                key={`card-${card.id}`} // Prefix agar key benar-benar unik di DOM
                card={card} 
                onUpdate={onUpdate} 
              />
            ))}
          </SortableContext>
          
          {uniqueCards.length === 0 && !isAdding && (
            <div className="h-24 border-2 border-dashed border-slate-300 rounded-[2rem] flex items-center justify-center text-slate-400 text-[10px] font-bold uppercase tracking-tighter">
              Kosong
            </div>
          )}
        </div>

        {/* Input Inline Tambah Tugas */}
        <div className="mt-4">
          {isAdding ? (
            <div style={{ backgroundColor: selectedColor }} className="p-5 rounded-[2rem] shadow-lg border border-slate-200 space-y-4 animate-in zoom-in-95">
              <textarea
                autoFocus
                className="w-full text-sm outline-none bg-white/40 p-2 rounded-xl resize-none min-h-[70px] font-medium"
                placeholder="Tulis tugas..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className="flex flex-col gap-3 border-t border-black/5 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-500 uppercase">Warna</span>
                  <div className="flex gap-1.5">
                    {colors.map(c => (
                      <button 
                        key={c.value} 
                        onClick={() => setSelectedColor(c.value)} 
                        className={`w-5 h-5 rounded-full border ${selectedColor === c.value ? 'ring-2 ring-blue-500 scale-110' : 'border-black/5'}`} 
                        style={{ backgroundColor: c.value }} 
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-500 uppercase">Deadline</span>
                  <input 
                    type="date" 
                    className="text-[10px] font-bold bg-white/40 p-1 rounded-md outline-none border border-black/5" 
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setIsAdding(false)} className="p-2 text-slate-500"><X size={16} /></button>
                <button onClick={handleAddTask} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm">Simpan</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsAdding(true)} 
              className="w-full py-4 flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 hover:bg-white/80 rounded-2xl transition-all font-black text-[10px] uppercase tracking-[0.2em]"
            >
              <Plus size={14} /> Tambah Kartu
            </button>
          )}
        </div>
      </div>

      {/* MODAL KONFIRMASI HAPUS KOLOM */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 text-center">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 italic">Hapus Kolom?</h3>
            <p className="text-slate-500 text-[10px] mb-8 leading-relaxed font-bold uppercase tracking-tight">
              Seluruh kartu di dalam kolom <span className="text-slate-800 underline">"{list.title}"</span> akan ikut terhapus permanen.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleDeleteList} className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase shadow-lg shadow-red-100 transition-all">Ya, Hapus Kolom</button>
              <button onClick={() => setShowDeleteModal(false)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase transition-all">Batal</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}