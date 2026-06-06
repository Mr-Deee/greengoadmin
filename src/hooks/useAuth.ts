import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useRouter } from 'next/navigation';

interface User {
  uid: string;
  email: string | null;
  name: string;
  role: string;
  organization?: string;
  phone?: string;
  district?: string;
  wmsType?: string;
  wmsCategory?: string;
}

export function useAuth(requiredRole?: string | string[]) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        // Only redirect to login if we're not already on the login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          router.push('/login');
        }
        return;
      }

      try {
        const uid = firebaseUser.uid;
        let role = null;
        let name = '';
        let organization = '';
        let phone = '';
        let district = '';
        let wmsType = '';
        let wmsCategory = '';
        
        // First, check in Admin node (for super_admin)
        const adminRef = ref(db, `Admin/${uid}`);
        const adminSnapshot = await get(adminRef);
        const adminData = adminSnapshot.val();
        
        if (adminData && adminData.role === 'super_admin') {
          role = 'super_admin';
          name = adminData.name || firebaseUser.email?.split('@')[0] || 'Super Admin';
          organization = adminData.organization || '';
          phone = adminData.phone || '';
          district = adminData.district || '';
        }
        
        // If not super_admin, check in Recyclers node
        if (!role) {
          const recyclerRef = ref(db, `Recyclers/${uid}`);
          const recyclerSnapshot = await get(recyclerRef);
          const recyclerData = recyclerSnapshot.val();
          
          if (recyclerData) {
            // Get WMSTYPE and WMSCATEGORY
            wmsType = recyclerData.WMSTYPE || recyclerData.wmsType || '';
            wmsCategory = recyclerData.WMSCATEGORY || recyclerData.wmsCategory || '';
            const recycleType = recyclerData.wasteManagementInfo?.RecycleType || '';
            
            // Determine role based on WMSTYPE and WMSCATEGORY
            if (wmsType === 'Recycle') {
              if (wmsCategory === 'Primary' || recycleType === 'Primary') {
                role = 'recycler';
              } else if (wmsCategory === 'Secondary' || recycleType === 'Secondary') {
                role = 'aggregator';
              } else if (wmsCategory === 'Tertiary' || recycleType === 'Tertiary') {
                role = 'recycler';
              } else {
                role = 'recycler';
              }
            } else if (recyclerData.role) {
              role = recyclerData.role;
            } else {
              role = 'recycler';
            }
            
            name = recyclerData.firstName || recyclerData.name || recyclerData.FirstName || firebaseUser.email?.split('@')[0] || 'User';
            organization = recyclerData.wasteManagementInfo?.CompanyName || recyclerData.organization || '';
            phone = recyclerData.phone || recyclerData.phoneNumber || '';
            district = recyclerData.district || '';
          }
        }
        
        // If not found in Recyclers, check in Users node
        if (!role) {
          const userRef = ref(db, `users/${uid}`);
          const userSnapshot = await get(userRef);
          const userData = userSnapshot.val();
          
          if (userData && userData.role) {
            role = userData.role;
            name = userData.name || userData.firstName || firebaseUser.email?.split('@')[0] || 'User';
            organization = userData.organization || '';
            phone = userData.phone || userData.phoneNumber || '';
            district = userData.district || '';
          }
        }
        
        // If not found, check in Aggregators node
        if (!role) {
          const aggregatorRef = ref(db, `Aggregators/${uid}`);
          const aggregatorSnapshot = await get(aggregatorRef);
          const aggregatorData = aggregatorSnapshot.val();
          
          if (aggregatorData && aggregatorData.role) {
            role = aggregatorData.role;
            name = aggregatorData.name || aggregatorData.firstName || firebaseUser.email?.split('@')[0] || 'Aggregator';
            organization = aggregatorData.organization || '';
            phone = aggregatorData.phone || '';
            district = aggregatorData.district || '';
          }
        }
        
        // If not found, check in FieldOperators node
        if (!role) {
          const operatorRef = ref(db, `FieldOperators/${uid}`);
          const operatorSnapshot = await get(operatorRef);
          const operatorData = operatorSnapshot.val();
          
          if (operatorData && operatorData.role) {
            role = operatorData.role;
            name = operatorData.name || operatorData.firstName || firebaseUser.email?.split('@')[0] || 'Field Operator';
            organization = operatorData.organization || '';
            phone = operatorData.phone || '';
            district = operatorData.district || '';
          }
        }
        
        // If not found, check in Clients node (waste generators)
        if (!role) {
          const clientRef = ref(db, `Clients/${uid}`);
          const clientSnapshot = await get(clientRef);
          const clientData = clientSnapshot.val();
          
          if (clientData) {
            role = 'client';
            name = clientData.firstName || clientData.name || firebaseUser.email?.split('@')[0] || 'Client';
            phone = clientData.phoneNumber || '';
            district = clientData.district || '';
          }
        }
        
        if (!role) {
          console.error('User role not found for uid:', uid);
          await auth.signOut();
          router.push('/unauthorized');
          return;
        }
        
        const userInfo: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: name,
          role: role,
          organization: organization,
          phone: phone,
          district: district,
          wmsType: wmsType,
          wmsCategory: wmsCategory,
        };
        
        setUser(userInfo);
        
        // Check role-based access
        if (requiredRole) {
          const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
          if (!roles.includes(userInfo.role)) {
            console.warn(`User role "${userInfo.role}" not allowed. Required: ${roles.join(', ')}`);
            router.push('/unauthorized');
            return;
          }
        }
        
      } catch (error) {
        console.error('Error fetching user data:', error);
        setUser(null);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [requiredRole, router]);

  return { user, loading };
}