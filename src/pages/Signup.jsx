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
    <div className="flex items-center justify-center px-4 py-6 bg-cover bg-center bg-no-repeat"
         style={{ backgroundImage: `url('/images/login&signup.png')`, minHeight: 'calc(100vh - 200px)' }}>
      
      <div className="flex justify-center w-full">
        <div className="w-1/2 bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-2xl border border-white/20">
          <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Sign Up</h1>
          
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
          
          <Button onClick={handleSignup} className="w-1/2 mx-auto block mt-6 py-3 text-base bg-blue-600 hover:bg-blue-700">
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
    </div>
  );
}