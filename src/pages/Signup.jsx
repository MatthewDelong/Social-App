import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export default function Signup() {
  const { signup } = useApp();
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const nav = useNavigate();

  const doSignup = async () => {
    await signup(email, pwd);
    nav('/');
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Sign Up</h1>
      <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <Input type="password" placeholder="Password" value={pwd} onChange={e => setPwd(e.target.value)} className="mt-2" />
      <Button onClick={doSignup} className="mt-4 w-full">Sign Up</Button>
    </div>
  );
}