'use client';

import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { useRouter } from 'next/navigation';
import styles from "./loginstyle.module.css";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;
      
      let role = null;
      let redirectPath = '/dashboard';
      
      // 1. Check in Admin node (super_admin and admin roles)
      const adminSnapshot = await get(ref(db, `Admin/${uid}`));
      const adminData = adminSnapshot.val();
      if (adminData && adminData.role) {
        role = adminData.role;
        if (role === 'super_admin') {
          redirectPath = '/superadmin';
        } else {
          redirectPath = '/admin';
        }
      }
      
      // 2. If not found in Admin, check in Recyclers node
      if (!role) {
        const recyclerSnapshot = await get(ref(db, `Recyclers/${uid}`));
        const recyclerData = recyclerSnapshot.val();
        
        if (recyclerData) {
          console.log('Recycler data found:', recyclerData);
          
          // Check if user has role field
          if (recyclerData.role) {
            role = recyclerData.role;
            if (role === 'recycler') {
              redirectPath = '/recycler';
            } else if (role === 'aggregator') {
              redirectPath = '/aggregator';
            }
          }
          // Check WMSTYPE field
          else if (recyclerData.WMSTYPE === 'Recycle') {
            role = 'recycler';
            redirectPath = '/recycler';
          }
          // Check RecycleType in wasteManagementInfo
          else if (recyclerData.wasteManagementInfo?.RecycleType === 'Secondary') {
            role = 'aggregator';
            redirectPath = '/aggregator';
          }
          else if (recyclerData.wasteManagementInfo?.RecycleType === 'Primary') {
            role = 'recycler';
            redirectPath = '/recycler';
          }
          // Check WMSCATEGORY
          else if (recyclerData.WMSCATEGORY === 'Secondary') {
            role = 'aggregator';
            redirectPath = '/aggregator';
          }
          else if (recyclerData.WMSCATEGORY === 'Primary') {
            role = 'recycler';
            redirectPath = '/recycler';
          }
          // If just a general recycler
          else if (recyclerData.firstName) {
            role = 'recycler';
            redirectPath = '/recycler';
          }
        }
      }
      
      // 3. Check in Clients node
      if (!role) {
        const clientsSnapshot = await get(ref(db, 'Clients'));
        const allClients = clientsSnapshot.val();
        
        if (allClients) {
          let foundClientUid = null;
          for (const [clientUid, clientData] of Object.entries(allClients)) {
            if ((clientData as any).email === email) {
              foundClientUid = clientUid;
              role = 'client';
              redirectPath = '/client-dashboard';
              break;
            }
          }
        }
      }
      
      console.log('User role determined:', role);
      console.log('Redirecting to:', redirectPath);
      
      if (!role) {
        setError('User role not found. Please contact support.');
        console.error('No role found for uid:', uid);
        await auth.signOut();
        return;
      }
      
      router.push(redirectPath);
      
    } catch (error: any) {
      console.error("Login failed:", error);
      
      // Handle specific Firebase auth errors
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (error.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email format.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(error.message || "Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const goToSignup = () => {
    router.push('/signup');
  };
  
  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.formSection}>
          <div className={styles.heading}>
            <span className={styles.icon}>♻️</span>
            <h2>GreenGoHub</h2>
            <p>Please enter your details to login.</p>
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}

          <form onSubmit={handleLogin} className={styles.form}>
            <input
              type="email"
              placeholder="Email"
              required
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              disabled={loading}
              value={email}
            />
            <input
              type="password"
              placeholder="Password"
              required
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              disabled={loading}
              value={password}
            />

            <div className={styles.options}>
              <label>
                <input type="checkbox" /> Remember me
              </label>
              <a href="#">Forgot password?</a>
            </div>

            <button type="submit" className={styles.loginButton} disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            
            <div className={styles.newuser} onClick={goToSignup}>
              New User? Sign Up
            </div>
            
            <div className={styles.or}>or</div>

            <div className={styles.socialButtons}>
              <button type="button" className={styles.apple}></button>
              <button type="button" className={styles.social}>
                G
              </button>
              <button type="button" className={styles.social}>
                f
              </button>
            </div>
          </form>
        </div>

        <div className={styles.imageSection}>
          <div className={styles.placeholderImage}>
            <span>♻️</span>
            <p>GreenGo-Hub</p>
            <small>Waste Management Platform</small>
          </div>
        </div>
      </div>
    </div>
  );
}