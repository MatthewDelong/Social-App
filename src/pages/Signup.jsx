import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../components/ui/input';
import Button from '../components/ui/button';

export default function Signup() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSignup = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });
      navigate('/');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
         style={{ backgroundImage: `url('/images/login&signup.png')` }}>
      
      <div className="w-full max-w-md bg-white/90 backdrop-blur-sm p-6 md:p-8 rounded-xl shadow-2xl border border-white/20 mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center text-gray-800">Sign Up</h1>
        
        <div className="space-y-4">
          <Input
            placeholder="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-3 text-base"
          />
          
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 text-base"
          />
          
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 text-base"
          />
        </div>
        
        <Button onClick={handleSignup} className="w-full mt-6 py-3 text-base bg-blue-600 hover:bg-blue-700">
          Sign Up
        </Button>

        <p className="mt-6 text-sm text-center text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}