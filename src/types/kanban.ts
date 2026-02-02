export interface Card {
  id: string;
  list_id: string;
  content: string;
  position: number;
}

export interface List {
  id: string;
  title: string;
  position: number;
  cards: Card[];
}