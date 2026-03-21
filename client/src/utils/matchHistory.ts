import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

export interface MatchRecord {
  id: string;
  date: number;
  myName: string;
  opponentName: string;
  isWin: boolean;
  winReason: 'ap' | 'deckout' | 'concede' | null;
  myAP: number;
  opponentAP: number;
  turns: number;
  myMissions: number;
  opponentMissions: number;
  myDamage: number;
  opponentDamage: number;
}

export async function getHistory(uid: string): Promise<MatchRecord[]> {
  try {
    const q = query(
      collection(db, 'users', uid, 'matches'),
      orderBy('date', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as MatchRecord));
  } catch {
    return [];
  }
}
