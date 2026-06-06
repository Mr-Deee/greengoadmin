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
      
      // First check in Admin node
      const adminSnapshot = await get(ref(db, `Admin/${uid}`));
      const adminData = adminSnapshot.val();
      if (adminData && adminData.role) {
        role = adminData.role;
        redirectPath = role === 'super_admin' ? '/superadmin' : '/admin';
      }
      
      // If not found in Admin, check in Recyclers node
      if (!role) {
        const recyclerSnapshot = await get(ref(db, `Recyclers/${uid}`));
        const recyclerData = recyclerSnapshot.val();
        if (recyclerData) {
          // Check WMSTYPE to determine role
          const wmsType = recyclerData.WMSTYPE || recyclerData.wmsType;
          const wmsCategory = recyclerData.WMSCATEGORY || recyclerData.wmsCategory;
          const recycleType = recyclerData.wasteManagementInfo?.RecycleType;
          
          console.log('Recycler data found:', { wmsType, wmsCategory, recycleType });
          
          // Determine role based on WMSTYPE
          if (wmsType === 'Recycle') {
            role = 'recycler';
            redirectPath = '/recycler';
          } else if (recycleType === 'Primary' || wmsCategory === 'Primary') {
            role = 'recycler';
            redirectPath = '/recycler';
          } else if (recycleType === 'Secondary' || wmsCategory === 'Secondary') {
            role = 'aggregator';
            redirectPath = '/aggregator';
          } else if (recyclerData.role) {
            role = recyclerData.role;
            // Set redirect based on role
            if (role === 'aggregator') redirectPath = '/aggregator';
            else if (role === 'recycler') redirectPath = '/recycler';
          }
        }
      }
      
      // If not found in Recyclers, check in Users node
      if (!role) {
        const userSnapshot = await get(ref(db, `users/${uid}`));
        const userData = userSnapshot.val();
        if (userData && userData.role) {
          role = userData.role;
          // Set redirect based on role
          switch(role) {
            case 'aggregator':
              redirectPath = '/aggregator';
              break;
            case 'field_operator':
              redirectPath = '/field-operator';
              break;
            case 'business':
              redirectPath = '/business';
              break;
            case 'government':
              redirectPath = '/government';
              break;
            case 'ngo':
              redirectPath = '/ngo';
              break;
            case 'sustainability_team':
              redirectPath = '/sustainability';
              break;
            case 'regulator':
              redirectPath = '/regulator';
              break;
            case 'civil_society':
              redirectPath = '/civil-society';
              break;
            case 'policy_maker':
              redirectPath = '/policy-maker';
              break;
            case 'investor':
              redirectPath = '/investor';
              break;
            case 'platform_leadership':
              redirectPath = '/platform-leadership';
              break;
            default:
              redirectPath = '/dashboard';
          }
        }
      }
      
      // If not found, check in Aggregators node
      if (!role) {
        const aggregatorSnapshot = await get(ref(db, `Aggregators/${uid}`));
        const aggregatorData = aggregatorSnapshot.val();
        if (aggregatorData && aggregatorData.role) {
          role = aggregatorData.role;
          redirectPath = '/aggregator';
        }
      }
      
      // If not found, check in FieldOperators node
      if (!role) {
        const operatorSnapshot = await get(ref(db, `FieldOperators/${uid}`));
        const operatorData = operatorSnapshot.val();
        if (operatorData && operatorData.role) {
          role = operatorData.role;
          redirectPath = '/field-operator';
        }
      }
      
      // If still no role, check if it's a client
      if (!role) {
        const clientSnapshot = await get(ref(db, `Clients/${uid}`));
        const clientData = clientSnapshot.val();
        if (clientData) {
          role = 'client';
          redirectPath = '/client-dashboard';
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
      setError(error.message || "Login failed. Please check your credentials.");
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
            />
            <input
              type="password"
              placeholder="Password"
              required
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              disabled={loading}
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