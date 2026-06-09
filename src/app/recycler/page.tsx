'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { ref, onValue, update, push, set, get } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import styles from './recycler.module.css';

interface WasteRequest {
  id: string;
  client_name?: string;
  client_phone?: string;
  category?: string;
  waste_category?: string;
  waste_grade?: string;
  status?: string;
  weight?: string;
  weight_kg?: number;
  calculated_price?: number;
  price_per_kg?: number;
  created_at?: string;
  location?: string;
  Client_address?: string;
  WMS_name?: string;
  WMS_id?: string;
  assignedTo?: string;
}

interface InventoryItem {
  id: string;
  category: string;
  grade: string;
  quantity: number;
  unit: string;
  pricePerKg: number;
  lastUpdated?: string;
  status?: 'raw' | 'processed' | 'sold' | 'available';
  sourceRequestId?: string;
  receivedDate?: string;
  processedFromBatch?: string;
  processedDate?: string;
  recyclerId?: string;
}

interface ProcessingBatch {
  id: string;
  batchNumber: string;
  category: string;
  grade: string;
  inputWeight: number;
  outputWeight: number;
  status: 'pending' | 'processing' | 'completed';
  startDate: string;
  endDate?: string;
  notes?: string;
  processedBy?: string;
  recyclerId?: string;
}

interface Sale {
  id: string;
  buyerName: string;
  buyerContact: string;
  category: string;
  grade: string;
  quantity: number;
  pricePerKg: number;
  totalAmount: number;
  saleDate: string;
  status: 'pending' | 'completed' | 'delivered';
  recordedBy?: string;
  recyclerId?: string;
}

export default function RecyclerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [recyclerId, setRecyclerId] = useState<string | null>(null);
  const [wasteRequests, setWasteRequests] = useState<WasteRequest[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [processingBatches, setProcessingBatches] = useState<ProcessingBatch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [activeTab, setActiveTab] = useState<'receive' | 'inventory' | 'processing' | 'sales'>('receive');
  const [selectedRequest, setSelectedRequest] = useState<WasteRequest | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [stats, setStats] = useState({
    totalReceived: 0,
    totalProcessed: 0,
    totalSales: 0,
    inventoryValue: 0,
    pendingRequests: 0
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log('Auth state changed:', user?.uid);
      
      if (!user) {
        console.log('No user found, redirecting to login');
        window.location.href = window.location.origin + '/login';
        return;
      }

      try {
        setRecyclerId(user.uid);
        
        // First check in Recyclers node
        const recyclerRef = ref(db, `Recyclers/${user.uid}`);
        const snapshot = await get(recyclerRef);
        const userData = snapshot.val();
        
        if (userData) {
          console.log('Recycler data found:', userData);
          setUserName(userData.firstName || userData.name || user.email?.split('@')[0] || 'Recycler');
          setUserRole(userData.role || 'recycler');
          setLoading(false);
          
          // Fetch data for this recycler
          fetchWasteRequestsForRecycler(user.uid);
          fetchInventoryForRecycler(user.uid);
          fetchProcessingBatchesForRecycler(user.uid);
          fetchSalesForRecycler(user.uid);
          return;
        }
        
        // If not in Recyclers, check in Admin node
        const adminRef = ref(db, `Admin/${user.uid}`);
        const adminSnapshot = await get(adminRef);
        const adminData = adminSnapshot.val();
        
        if (adminData && adminData.role === 'super_admin') {
          console.log('Super admin found:', adminData);
          setUserName(adminData.email?.split('@')[0] || 'Super Admin');
          setUserRole('super_admin');
          setLoading(false);
          fetchAllWasteRequests();
          // For super admin, inventory/processing/sales might be from a different path
          // Or just show empty states
          return;
        }
        
        // If not found anywhere
        console.log('No user data found in Recyclers or Admin');
        setLoading(false);
        router.push('/unauthorized');
        
      } catch (error) {
        console.error('Error checking user:', error);
        setLoading(false);
        router.push('/login');
      }
    });

    return () => unsubscribe();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const fetchWasteRequestsForRecycler = (recyclerId: string) => {
    console.log('Fetching waste requests for recycler:', recyclerId);
    const requestsRef = ref(db, 'ClientRequest');
    
    const unsubscribe = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val();
      console.log('ClientRequest data received:', data ? Object.keys(data).length : 0, 'records');
      
      if (data) {
        const requestsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as WasteRequest[];
        
        // Filter requests assigned to this recycler and not ended/completed
        const filteredRequests = requestsArray.filter(req => {
          const isAssignedToMe = req.WMS_id === recyclerId;
          const isActive = req.status !== 'ended' && req.status !== 'completed';
          return isAssignedToMe && isActive;
        });
        
        console.log('Filtered requests:', filteredRequests.length);
        setWasteRequests(filteredRequests);
        
        setStats(prev => ({
          ...prev,
          pendingRequests: filteredRequests.filter(r => 
            r.status === 'accepted' || r.status === 'searching' || r.status === 'onride'
          ).length
        }));
        
        const completedRequests = requestsArray.filter(req => 
          req.WMS_id === recyclerId && (req.status === 'ended' || req.status === 'completed')
        );
        const totalReceived = completedRequests.reduce((sum, req) => sum + (req.weight_kg || 0), 0);
        setStats(prev => ({ ...prev, totalReceived }));
      } else {
        setWasteRequests([]);
      }
    });

    return () => unsubscribe();
  };

  const fetchAllWasteRequests = () => {
    console.log('Fetching all waste requests for super admin');
    const requestsRef = ref(db, 'ClientRequest');
    
    const unsubscribe = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val();
      console.log('All ClientRequest data:', data ? Object.keys(data).length : 0, 'records');
      
      if (data) {
        const requestsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as WasteRequest[];
        
        const activeRequests = requestsArray.filter(req => 
          req.status !== 'ended' && req.status !== 'completed'
        );
        
        setWasteRequests(activeRequests);
        
        setStats(prev => ({
          ...prev,
          pendingRequests: activeRequests.filter(r => 
            r.status === 'accepted' || r.status === 'searching'
          ).length
        }));
      } else {
        setWasteRequests([]);
        setStats(prev => ({ ...prev, pendingRequests: 0 }));
      }
    });

    return () => unsubscribe();
  };

  const fetchInventoryForRecycler = (recyclerId: string) => {
    console.log('Fetching inventory for recycler:', recyclerId);
    const inventoryRef = ref(db, `Recyclers/${recyclerId}/inventory`);
    
    const unsubscribe = onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Inventory data:', data ? Object.keys(data).length : 0, 'items');
      
      if (data) {
        const inventoryArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as InventoryItem[];
        
        setInventory(inventoryArray);
        
        const totalValue = inventoryArray.reduce((sum, item) => sum + (item.quantity * item.pricePerKg), 0);
        setStats(prev => ({ ...prev, inventoryValue: totalValue }));
      } else {
        setInventory([]);
        setStats(prev => ({ ...prev, inventoryValue: 0 }));
      }
    });

    return () => unsubscribe();
  };

  const fetchProcessingBatchesForRecycler = (recyclerId: string) => {
    console.log('Fetching processing batches for recycler:', recyclerId);
    const batchesRef = ref(db, `Recyclers/${recyclerId}/processingBatches`);
    
    const unsubscribe = onValue(batchesRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Processing batches:', data ? Object.keys(data).length : 0, 'batches');
      
      if (data) {
        const batchesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as ProcessingBatch[];
        
        setProcessingBatches(batchesArray);
        
        const processed = batchesArray
          .filter(b => b.status === 'completed')
          .reduce((sum, b) => sum + (b.outputWeight || 0), 0);
        setStats(prev => ({ ...prev, totalProcessed: processed }));
      } else {
        setProcessingBatches([]);
        setStats(prev => ({ ...prev, totalProcessed: 0 }));
      }
    });

    return () => unsubscribe();
  };

  const fetchSalesForRecycler = (recyclerId: string) => {
    console.log('Fetching sales for recycler:', recyclerId);
    const salesRef = ref(db, `Recyclers/${recyclerId}/sales`);
    
    const unsubscribe = onValue(salesRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Sales data:', data ? Object.keys(data).length : 0, 'sales');
      
      if (data) {
        const salesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as Sale[];
        
        setSales(salesArray);
        
        const totalSales = salesArray.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
        setStats(prev => ({ ...prev, totalSales: totalSales }));
      } else {
        setSales([]);
        setStats(prev => ({ ...prev, totalSales: 0 }));
      }
    });

    return () => unsubscribe();
  };

  const receiveWaste = async (request: WasteRequest, actualWeight: number, grade: string) => {
    try {
      const currentRecyclerId = auth.currentUser?.uid;
      if (!currentRecyclerId) throw new Error('No recycler ID');
      
      const requestRef = ref(db, `ClientRequest/${request.id}`);
      const calculatedPrice = actualWeight * (request.price_per_kg || 2);
      
      await update(requestRef, {
        status: 'ended',
        weight_kg: actualWeight,
        calculated_price: calculatedPrice,
        waste_grade: grade,
        receivedAt: new Date().toISOString(),
        receivedBy: currentRecyclerId
      });
      
      const inventoryRef = ref(db, `Recyclers/${currentRecyclerId}/inventory`);
      const newInventoryRef = push(inventoryRef);
      
      await set(newInventoryRef, {
        category: request.waste_category || request.category || 'General',
        grade: grade,
        quantity: actualWeight,
        unit: 'kg',
        pricePerKg: request.price_per_kg || 2,
        sourceRequestId: request.id,
        receivedDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        status: 'raw',
        recyclerId: currentRecyclerId
      });
      
      setStats(prev => ({
        ...prev,
        totalReceived: prev.totalReceived + actualWeight
      }));
      
      alert(`✅ Successfully received ${actualWeight} kg of waste!`);
      setShowReceiveModal(false);
      setSelectedRequest(null);
      
      // Refresh data
      fetchInventoryForRecycler(currentRecyclerId);
      fetchWasteRequestsForRecycler(currentRecyclerId);
    } catch (error) {
      console.error('Error receiving waste:', error);
      alert('❌ Failed to receive waste. Please try again.');
    }
  };

  const processWaste = async (batch: {
    category: string;
    grade: string;
    inputWeight: number;
    outputWeight: number;
    notes: string;
  }) => {
    try {
      const currentRecyclerId = auth.currentUser?.uid;
      if (!currentRecyclerId) throw new Error('No recycler ID');
      
      const batchesRef = ref(db, `Recyclers/${currentRecyclerId}/processingBatches`);
      const newBatchRef = push(batchesRef);
      const batchNumber = `BATCH-${Date.now()}`;
      
      await set(newBatchRef, {
        batchNumber,
        category: batch.category,
        grade: batch.grade,
        inputWeight: batch.inputWeight,
        outputWeight: batch.outputWeight,
        status: 'completed',
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        notes: batch.notes,
        processedBy: currentRecyclerId,
        recyclerId: currentRecyclerId
      });
      
      const inventoryRef = ref(db, `Recyclers/${currentRecyclerId}/inventory`);
      const processedRef = push(inventoryRef);
      
      await set(processedRef, {
        category: batch.category,
        grade: `Processed-${batch.grade}`,
        quantity: batch.outputWeight,
        unit: 'kg',
        pricePerKg: batch.category === 'Plastic' ? 5 : 3,
        processedFromBatch: batchNumber,
        processedDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        status: 'processed',
        recyclerId: currentRecyclerId
      });
      
      alert(`✅ Successfully processed ${batch.inputWeight} kg into ${batch.outputWeight} kg!`);
      setShowProcessModal(false);
      
      fetchInventoryForRecycler(currentRecyclerId);
      fetchProcessingBatchesForRecycler(currentRecyclerId);
    } catch (error) {
      console.error('Error processing waste:', error);
      alert('❌ Failed to process waste. Please try again.');
    }
  };

  const recordSale = async (sale: Omit<Sale, 'id' | 'saleDate'>) => {
    try {
      const currentRecyclerId = auth.currentUser?.uid;
      if (!currentRecyclerId) throw new Error('No recycler ID');
      
      const salesRef = ref(db, `Recyclers/${currentRecyclerId}/sales`);
      const newSaleRef = push(salesRef);
      
      await set(newSaleRef, {
        ...sale,
        saleDate: new Date().toISOString(),
        status: 'completed',
        recordedBy: currentRecyclerId,
        recyclerId: currentRecyclerId
      });
      
      // Update inventory - subtract sold quantity
      const inventoryItems = inventory.filter(item => 
        item.category === sale.category && 
        item.grade === sale.grade && 
        item.status !== 'sold' &&
        item.recyclerId === currentRecyclerId
      );
      
      let remainingQuantity = sale.quantity;
      for (const item of inventoryItems) {
        if (remainingQuantity <= 0) break;
        
        const deductAmount = Math.min(item.quantity, remainingQuantity);
        const newQuantity = item.quantity - deductAmount;
        
        if (newQuantity <= 0) {
          await update(ref(db, `Recyclers/${currentRecyclerId}/inventory/${item.id}`), {
            quantity: 0,
            status: 'sold',
            lastUpdated: new Date().toISOString()
          });
        } else {
          await update(ref(db, `Recyclers/${currentRecyclerId}/inventory/${item.id}`), {
            quantity: newQuantity,
            lastUpdated: new Date().toISOString()
          });
        }
        
        remainingQuantity -= deductAmount;
      }
      
      alert(`💰 Sale recorded! Total: ₵${sale.totalAmount.toLocaleString()}`);
      setShowSaleModal(false);
      
      fetchInventoryForRecycler(currentRecyclerId);
      fetchSalesForRecycler(currentRecyclerId);
    } catch (error) {
      console.error('Error recording sale:', error);
      alert('❌ Failed to record sale. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading recycler dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header with Logout Button */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoSection}>
            <span className={styles.logoEmoji}>♻️</span>
            <div>
              <h1 className={styles.title}>Recycler Dashboard</h1>
              <p className={styles.subtitle}>Welcome back, {userName}</p>
              {recyclerId && (
                <p className={styles.recyclerId}>ID: {recyclerId.slice(0, 8)}...</p>
              )}
            </div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.dateBadge}>
            <span className={styles.dateIcon}>📅</span>
            <span>{new Date().toLocaleDateString(undefined, { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</span>
          </div>
          <button 
            className={styles.logoutBtn}
            onClick={() => setShowLogoutConfirm(true)}
            title="Logout"
          >
            <span className={styles.logoutIcon}>🚪</span>
            <span className={styles.logoutText}>Logout</span>
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className={styles.modal} onClick={() => setShowLogoutConfirm(false)}>
          <div className={`${styles.modalContent} ${styles.confirmModal}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Confirm Logout</h2>
              <button className={styles.closeBtn} onClick={() => setShowLogoutConfirm(false)}>✕</button>
            </div>
            <div className={styles.confirmBody}>
              <div className={styles.confirmIcon}>👋</div>
              <p className={styles.confirmText}>Are you sure you want to logout?</p>
              <p className={styles.confirmSubtext}>You'll need to login again to access your dashboard.</p>
            </div>
            <div className={styles.formActions}>
              <button 
                type="button" 
                className={styles.cancelBtn} 
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className={styles.logoutConfirmBtn} 
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statCardReceive}`}>
          <div className={styles.statIconWrapper}>
            <div className={styles.statIcon}>📦</div>
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.totalReceived.toLocaleString()} kg</div>
            <div className={styles.statLabel}>Total Received</div>
            <div className={styles.statTrend}>Waste you've collected</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardProcess}`}>
          <div className={styles.statIconWrapper}>
            <div className={styles.statIcon}>⚙️</div>
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.totalProcessed.toLocaleString()} kg</div>
            <div className={styles.statLabel}>Processed Material</div>
            <div className={styles.statTrend}>Materials you've processed</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardSales}`}>
          <div className={styles.statIconWrapper}>
            <div className={styles.statIcon}>💰</div>
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>₵{stats.totalSales.toLocaleString()}</div>
            <div className={styles.statLabel}>Total Revenue</div>
            <div className={styles.statTrend}>From your sales</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardInventory}`}>
          <div className={styles.statIconWrapper}>
            <div className={styles.statIcon}>📊</div>
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>₵{stats.inventoryValue.toLocaleString()}</div>
            <div className={styles.statLabel}>Inventory Value</div>
            <div className={styles.statTrend}>{inventory.length} active items</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabBar}>
        <button 
          className={`${styles.tab} ${activeTab === 'receive' ? styles.active : ''}`}
          onClick={() => setActiveTab('receive')}
        >
          <span className={styles.tabIcon}>📥</span>
          <span>Receive Waste</span>
          {stats.pendingRequests > 0 && (
            <span className={styles.badge}>{stats.pendingRequests}</span>
          )}
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'inventory' ? styles.active : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <span className={styles.tabIcon}>📦</span>
          <span>Inventory</span>
          <span className={styles.badgeLight}>{inventory.length}</span>
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'processing' ? styles.active : ''}`}
          onClick={() => setActiveTab('processing')}
        >
          <span className={styles.tabIcon}>⚙️</span>
          <span>Processing</span>
          {processingBatches.filter(b => b.status === 'pending').length > 0 && (
            <span className={styles.badge}>{processingBatches.filter(b => b.status === 'pending').length}</span>
          )}
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'sales' ? styles.active : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          <span className={styles.tabIcon}>💰</span>
          <span>Sales</span>
          <span className={styles.badgeLight}>{sales.length}</span>
        </button>
      </div>

      {/* Receive Waste Tab */}
      {activeTab === 'receive' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Pending Waste Collections</h2>
              <p className={styles.sectionSubtitle}>Waste assigned to you for processing</p>
            </div>
          </div>
          
          {wasteRequests.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📭</div>
              <h3 className={styles.emptyTitle}>No pending waste</h3>
              <p className={styles.emptyText}>You don't have any waste assignments at the moment.</p>
            </div>
          ) : (
            <div className={styles.requestsGrid}>
              {wasteRequests.map((request) => (
                <div key={request.id} className={styles.requestCard}>
                  <div className={styles.requestHeader}>
                    <div className={styles.requestClient}>
                      <div className={styles.clientAvatar}>
                        {request.client_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h3 className={styles.clientName}>{request.client_name || 'Unknown Client'}</h3>
                        <span className={`${styles.status} ${styles[request.status || 'pending']}`}>
                          {request.status === 'accepted' ? '✓ Accepted' : 
                           request.status === 'onride' ? '🚚 In Transit' : 
                           request.status === 'searching' ? '⏳ Pending' : 
                           request.status === 'ended' ? '✓ Completed' : '⏳ Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.requestDetails}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>📍 Location</span>
                      <span className={styles.detailValue}>{request.location || request.Client_address || 'N/A'}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>🗑️ Category</span>
                      <span className={styles.detailValue}>{request.waste_category || request.category || 'General'}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>⚖️ Weight</span>
                      <span className={styles.detailValue}>{request.weight_kg || request.weight || '?'} kg</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>💰 Price/kg</span>
                      <span className={styles.detailValue}>₵{request.price_per_kg || 2}</span>
                    </div>
                  </div>
                  
                  <button 
                    className={styles.receiveBtn}
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowReceiveModal(true);
                    }}
                  >
                    📥 Receive & Process
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Material Inventory</h2>
              <p className={styles.sectionSubtitle}>Track and manage your recyclable materials</p>
            </div>
            <button 
              className={styles.primaryBtn}
              onClick={() => setShowProcessModal(true)}
            >
              + New Processing Batch
            </button>
          </div>
          
          {inventory.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📦</div>
              <h3 className={styles.emptyTitle}>No inventory items</h3>
              <p className={styles.emptyText}>Start receiving waste to build your inventory.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Grade</th>
                    <th>Quantity (kg)</th>
                    <th>Price/kg (₵)</th>
                    <th>Total Value (₵)</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.id}>
                      <td className={styles.categoryCell}>{item.category}</td>
                      <td>{item.grade}</td>
                      <td className={styles.numberCell}>{item.quantity.toLocaleString()}</td>
                      <td className={styles.numberCell}>₵{item.pricePerKg}</td>
                      <td className={styles.numberCell}>₵{(item.quantity * item.pricePerKg).toLocaleString()}</td>
                      <td>
                        <span className={`${styles.inventoryStatus} ${styles[item.status || 'raw']}`}>
                          {item.status === 'raw' ? 'Raw' : 
                           item.status === 'processed' ? 'Processed' : 
                           item.status === 'sold' ? 'Sold' : 'Available'}
                        </span>
                      </td>
                      <td>{item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Processing Tab */}
      {activeTab === 'processing' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Processing Batches</h2>
              <p className={styles.sectionSubtitle}>Track your waste processing operations</p>
            </div>
          </div>
          
          {processingBatches.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>⚙️</div>
              <h3 className={styles.emptyTitle}>No processing batches</h3>
              <p className={styles.emptyText}>Start processing waste to create batches.</p>
            </div>
          ) : (
            <div className={styles.batchesGrid}>
              {processingBatches.map((batch) => (
                <div key={batch.id} className={styles.batchCard}>
                  <div className={styles.batchHeader}>
                    <div>
                      <div className={styles.batchNumber}>{batch.batchNumber}</div>
                      <div className={styles.batchDate}>{new Date(batch.startDate).toLocaleDateString()}</div>
                    </div>
                    <span className={`${styles.batchStatus} ${styles[batch.status]}`}>
                      {batch.status === 'completed' ? '✓ Completed' : 
                       batch.status === 'processing' ? '⚙️ Processing' : '⏳ Pending'}
                    </span>
                  </div>
                  <div className={styles.batchDetails}>
                    <div className={styles.batchInfo}>
                      <span className={styles.batchLabel}>Category:</span>
                      <span className={styles.batchValue}>{batch.category}</span>
                    </div>
                    <div className={styles.batchInfo}>
                      <span className={styles.batchLabel}>Grade:</span>
                      <span className={styles.batchValue}>{batch.grade}</span>
                    </div>
                    <div className={styles.batchMetrics}>
                      <div className={styles.metric}>
                        <span className={styles.metricLabel}>Input</span>
                        <span className={styles.metricValue}>{batch.inputWeight} kg</span>
                      </div>
                      <div className={styles.metricArrow}>→</div>
                      <div className={styles.metric}>
                        <span className={styles.metricLabel}>Output</span>
                        <span className={styles.metricValue}>{batch.outputWeight} kg</span>
                      </div>
                      <div className={styles.metric}>
                        <span className={styles.metricLabel}>Yield</span>
                        <span className={styles.metricValue}>{((batch.outputWeight / batch.inputWeight) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    {batch.notes && (
                      <div className={styles.batchNotes}>📝 {batch.notes}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Sales Records</h2>
              <p className={styles.sectionSubtitle}>Track your revenue and sales performance</p>
            </div>
            <button 
              className={styles.primaryBtn}
              onClick={() => setShowSaleModal(true)}
            >
              + Record Sale
            </button>
          </div>
          
          {sales.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>💰</div>
              <h3 className={styles.emptyTitle}>No sales recorded</h3>
              <p className={styles.emptyText}>Record your first sale to start tracking revenue.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Buyer</th>
                    <th>Category</th>
                    <th>Grade</th>
                    <th>Quantity (kg)</th>
                    <th>Price/kg (₵)</th>
                    <th>Total (₵)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{new Date(sale.saleDate).toLocaleDateString()}</td>
                      <td className={styles.buyerCell}>{sale.buyerName}</td>
                      <td>{sale.category}</td>
                      <td>{sale.grade}</td>
                      <td className={styles.numberCell}>{sale.quantity.toLocaleString()}</td>
                      <td className={styles.numberCell}>₵{sale.pricePerKg}</td>
                      <td className={styles.numberCell}>₵{sale.totalAmount.toLocaleString()}</td>
                      <td>
                        <span className={`${styles.saleStatus} ${styles[sale.status]}`}>
                          {sale.status === 'completed' ? '✓ Completed' : 
                           sale.status === 'delivered' ? '🚚 Delivered' : '⏳ Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && selectedRequest && (
        <div className={styles.modal} onClick={() => setShowReceiveModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>📥 Receive Waste</h2>
              <button className={styles.closeBtn} onClick={() => setShowReceiveModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const actualWeight = parseFloat(formData.get('weight') as string);
              const grade = formData.get('grade') as string;
              receiveWaste(selectedRequest, actualWeight, grade);
            }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Client Name</label>
                <input type="text" value={selectedRequest.client_name} disabled className={styles.formInputDisabled} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Waste Category</label>
                <input type="text" value={selectedRequest.waste_category || selectedRequest.category} disabled className={styles.formInputDisabled} />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Expected Weight (kg)</label>
                  <input type="text" value={selectedRequest.weight_kg || selectedRequest.weight} disabled className={styles.formInputDisabled} />
                </div>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.required}`}>Actual Weight (kg)</label>
                  <input type="number" name="weight" required step="0.1" placeholder="Enter actual weight" className={styles.formInput} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={`${styles.formLabel} ${styles.required}`}>Grade</label>
                <select name="grade" required className={styles.formSelect}>
                  <option value="">Select grade</option>
                  <option value="G1">G1 - Not Clean (From dump sites)</option>
                  <option value="G2">G2 - Partially Clean (From streets)</option>
                  <option value="G3">G3 - Very Clean (From homes/orgs)</option>
                </select>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowReceiveModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Receive & Process
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Modal */}
      {showProcessModal && (
        <div className={styles.modal} onClick={() => setShowProcessModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>⚙️ Create Processing Batch</h2>
              <button className={styles.closeBtn} onClick={() => setShowProcessModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              processWaste({
                category: formData.get('category') as string,
                grade: formData.get('grade') as string,
                inputWeight: parseFloat(formData.get('inputWeight') as string),
                outputWeight: parseFloat(formData.get('outputWeight') as string),
                notes: formData.get('notes') as string
              });
            }}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.required}`}>Category</label>
                  <select name="category" required className={styles.formSelect}>
                    <option value="">Select category</option>
                    <option value="Plastic">♻️ Plastic</option>
                    <option value="Glass">🥂 Glass</option>
                    <option value="Metal">🔩 Metal</option>
                    <option value="Paper">📄 Paper</option>
                    <option value="Organic">🌱 Organic</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.required}`}>Grade</label>
                  <select name="grade" required className={styles.formSelect}>
                    <option value="">Select grade</option>
                    <option value="G1">G1 - Not Clean</option>
                    <option value="G2">G2 - Partially Clean</option>
                    <option value="G3">G3 - Very Clean</option>
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.required}`}>Input Weight (kg)</label>
                  <input type="number" name="inputWeight" required step="0.1" placeholder="Enter input weight" className={styles.formInput} />
                </div>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.required}`}>Output Weight (kg)</label>
                  <input type="number" name="outputWeight" required step="0.1" placeholder="Enter output weight" className={styles.formInput} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Notes (Optional)</label>
                <textarea name="notes" rows={3} placeholder="Processing notes..." className={styles.formTextarea}></textarea>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowProcessModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Modal */}
      {showSaleModal && (
        <div className={styles.modal} onClick={() => setShowSaleModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>💰 Record Sale</h2>
              <button className={styles.closeBtn} onClick={() => setShowSaleModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const quantity = parseFloat(formData.get('quantity') as string);
              const pricePerKg = parseFloat(formData.get('pricePerKg') as string);
              recordSale({
                buyerName: formData.get('buyerName') as string,
                buyerContact: formData.get('buyerContact') as string,
                category: formData.get('category') as string,
                grade: formData.get('grade') as string,
                quantity: quantity,
                pricePerKg: pricePerKg,
                totalAmount: quantity * pricePerKg,
                status: 'completed'
              });
            }}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.required}`}>Buyer Name</label>
                  <input type="text" name="buyerName" required placeholder="Enter buyer name" className={styles.formInput} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Buyer Contact</label>
                  <input type="tel" name="buyerContact" placeholder="Phone number" className={styles.formInput} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.required}`}>Category</label>
                  <select name="category" required className={styles.formSelect}>
                    <option value="">Select category</option>
                    <option value="Plastic">♻️ Plastic</option>
                    <option value="Glass">🥂 Glass</option>
                    <option value="Metal">🔩 Metal</option>
                    <option value="Paper">📄 Paper</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.required}`}>Grade</label>
                  <select name="grade" required className={styles.formSelect}>
                    <option value="">Select grade</option>
                    <option value="Processed-G1">Processed G1</option>
                    <option value="Processed-G2">Processed G2</option>
                    <option value="Processed-G3">Processed G3</option>
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.required}`}>Quantity (kg)</label>
                  <input type="number" name="quantity" required step="0.1" placeholder="Quantity" className={styles.formInput} />
                </div>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.required}`}>Price per kg (₵)</label>
                  <input type="number" name="pricePerKg" required step="0.01" placeholder="Price" className={styles.formInput} />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowSaleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Record Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}