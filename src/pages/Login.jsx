import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../components/ui/input';
import Button from '../components/ui/button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      alert('Please enter your email address');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
      alert('Password reset email sent! Check your inbox.');
    } catch (err) {
      alert(`Error sending reset email: ${err.message}`);
    }
  };

  return (
    <div className="flex items-center justify-center px-4 py-6 bg-cover bg-center bg-no-repeat"
         style={{ backgroundImage: `url('/images/login&signup.png')`, minHeight: 'calc(100vh - 200px)' }}>
      
      <div className="flex justify-center w-full">
        <div className="w-1/2 bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-2xl border border-white/20">
          <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Log In</h1>
          
          <div className="space-y-4">
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
          
          <Button onClick={handleLogin} className="w-1/2 mx-auto block mt-6 py-3 text-base bg-blue-600 hover:bg-blue-700">
            Log In
          </Button>

          <p className="mt-4 text-sm text-center">
            <button
              onClick={() => setIsResetting(!isResetting)}
              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              Forgot your password?
            </button>
          </p>

          {isResetting && (
            <div className="mt-4 p-4 bg-gray-50/80 rounded-lg backdrop-blur-sm">
              <h2 className="text-lg font-semibold mb-3 text-gray-800">Reset Password</h2>
              <p className="text-sm text-gray-600 mb-3">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              
              <Input
                placeholder="Enter your email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-4 py-3 text-base mb-3"
              />
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={handlePasswordReset}
                  disabled={resetSent}
                  className="flex-1 py-2 text-sm"
                >
                  {resetSent ? 'Email Sent' : 'Send Reset Link'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsResetting(false);
                    setResetSent(false);
                    setResetEmail('');
                  }}
                  className="flex-1 py-2 text-sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <p className="mt-6 text-sm text-center text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}