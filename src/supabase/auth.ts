import { supabase } from './client';

// Helper auth utilities

// Retourne l'id user courant ou null
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('getCurrentUserId error', error);
      return null;
    }
    return (data as any)?.user?.id ?? null;
  } catch (err) {
    console.error('getCurrentUserId unexpected error', err);
    return null;
  }
}

// Ecoute les changements d'auth et exécute un callback. Retourne l'objet de subscription pour permettre l'unsubscribe.
export function onAuthChange(cb: (event: string, session: any) => void) {
  const subscription = supabase.auth.onAuthStateChange((event, session) => {
    cb(event, session);
  });
  // supabase.auth.onAuthStateChange retourne un objet qui contient la subscription dans .data (v2)
  // Normaliser et renvoyer la partie utile si présente
  // @ts-ignore
  return subscription?.data?.subscription ?? subscription;
}
