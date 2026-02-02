export interface ChecklistItem {
  id: string;
  card_id: string;
  content: string;
  is_done: boolean;
  created_at?: string;
}

export interface Card {
  id: string;
  list_id: string;
  content: string;
  position: number;
  label_color?: string; // Tambahkan ini (tanda tanya berarti opsional)
  due_date?: string;    // Tambahkan ini juga agar aman
  checklists?: ChecklistItem[]; // Tambahkan ini untuk data pre-fetched
}

export interface List {
  id: string;
  title: string;
  position: number;
  cards: Card[];
}