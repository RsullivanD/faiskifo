import React, { useState } from 'react';
import { supabase } from '../supabase/client';

export default function MagicLinkLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        console.error(error);
        alert('Error sending magic link: ' + error.message);
      } else {
        alert('Magic link sent — check your email.');
      }
    } catch (err) {
      console.error(err);
      alert('Unexpected error');
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
      />
      <button onClick={signIn} disabled={loading || !email}>
        {loading ? 'Sending…' : 'Sign in with magic link'}
      </button>
    </div>
  );
}
