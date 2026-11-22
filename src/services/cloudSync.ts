import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { CardSummary, Deck } from '../domain/types';
import { firebaseAuth, firestore } from './firebase';

// Only serializable card metadata is stored in Firestore.  Images stay remote;
// these fields contain their URL/path and never image bytes or a Storage upload.
const cardForCloud = (card: CardSummary) => ({
  id: card.id,
  deckId: card.deckId,
  front: card.front,
  back: card.back,
  content: card.content,
  cardType: card.cardType,
  objective: card.objective,
  createdAt: card.createdAt,
  updatedAt: card.updatedAt,
  archivedAt: card.archivedAt,
  trashedAt: card.trashedAt,
  isPinned: card.isPinned,
  reviewReverse: card.reviewReverse,
  ipaUs: card.ipaUs || null,
  ipaUk: card.ipaUk || null,
  imageUrl: card.imageUrl || null,
  thumbnailUrl: card.thumbnailUrl || null,
  tags: card.tags,
  cloudUpdatedAt: serverTimestamp()
});

export async function syncCard(card: CardSummary): Promise<void> {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) return;
  await setDoc(doc(firestore, 'users', uid, 'cards', card.id), cardForCloud(card), { merge: true });
}

export async function removeCloudCard(cardId: string): Promise<void> {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) return;
  await deleteDoc(doc(firestore, 'users', uid, 'cards', cardId));
}

export async function syncDeck(deck: Deck): Promise<void> {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) return;
  await setDoc(doc(firestore, 'users', uid, 'decks', deck.id), {
    ...deck,
    cloudUpdatedAt: serverTimestamp()
  }, { merge: true });
}

export async function removeCloudDeck(deckId: string): Promise<void> {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) return;
  await deleteDoc(doc(firestore, 'users', uid, 'decks', deckId));
}
