import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    await login(email, password);
    navigate('/');
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Login</h1>
      <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2" />
      <Button onClick={handleLogin} className="mt-4 w-full">Login</Button>
    </div>
  );
}
