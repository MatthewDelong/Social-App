import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const nav = useNavigate();

  const doLogin = async () => {
    await login(email, pwd);
    nav('/');
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Login</h1>
      <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <Input type="password" placeholder="Password" value={pwd} onChange={e => setPwd(e.target.value)} className="mt-2" />
      <Button onClick={doLogin} className="mt-4 w-full">Login</Button>
    </div>
  );
}