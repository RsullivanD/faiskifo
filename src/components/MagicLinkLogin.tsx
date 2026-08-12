import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { onAuthChange } from '../supabase/auth';

export default function MagicLinkLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const subscription = onAuthChange((event, session) => {
      if (session?.user) {
        setMessage('Authentifié — redirection en cours...');
        // TODO: rediriger ou mettre à jour le state global
      }
    }) as any;

    return () => {
      try {
        subscription?.unsubscribe?.();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  async function signIn() {
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        console.error(error);
        setMessage('Erreur envoi du magic link : ' + error.message);
      } else {
        setSent(true);
        setMessage('Magic link envoyé — vérifie ta boîte mail.');
      }
    } catch (err) {
      console.error(err);
      setMessage('Erreur inattendue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={{ width: '100%', padding: 8, marginTop: 8, marginBottom: 12 }}
        disabled={sent}
      />
      <button onClick={signIn} disabled={loading || !email || sent}>
        {loading ? 'Envoi…' : sent ? 'Lien envoyé' : 'Se connecter (magic link)'}
      </button>
      {message && <div style={{ marginTop: 12 }}>{message}</div>}
    </div>
  );
}
