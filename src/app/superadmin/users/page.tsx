'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { ref, onValue, update, push, set, get } from 'firebase/database';
import { useRouter } from 'next/navigation';
import styles from './users.module.css';

// Database interfaces based on your actual structure
interface ClientRequest {
  id: string;
  Client_id?: string;
  client_name?: string;
  client_phone?: string;
  category?: string;
  waste_category?: string;
  waste_grade?: string;
  status?: 'searching' | 'accepted' | 'onride' | 'ended';
  weight?: string;
  weight_kg?: number;
  calculated_price?: number;
  price_per_kg?: number;
  created_at?: string;
  location?: string;
  Client_address?: string;
  WMS_id?: string;
  WMS_name?: string;
  WMS_phone?: string;
  payment_method?: string;
  imageUrl?: string;
  pickup?: { latitude: string; longitude: string };
  dropoff?: { latitude: string; longitude: string };
}

interface RecyclerData {
  id: string;
  firstName?: string;
  LastName?: string;
  email?: string;
  phone?: string;
  WMSTYPE?: string;
  WMSCATEGORY?: string;
  wmsCategory?: string;
  detailsComp?: boolean;
  riderImageUrl?: string;
  token?: string;
  wasteManagementInfo?: {
    CompanyName?: string;
    location?: string;
    RecycleType?: string;
    WasteCategory?: string[] | string;
    WasteClassification?: string[] | string;
    employees?: number | string;
    district?: string;
    gps?: string;
    ghMobileNumber?: string;
    ghanaCardNumber?: string;
  };
}

interface ProcessingRecord {
  id: string;
  requestId: string;
  clientName: string;
  wasteCategory: string;
  grade: string;
  inputWeight: number;
  outputWeight: number;
  processedAt: string;
  processedBy: string;
  batchNumber: string;
  notes?: string;
}

interface SaleRecord {
  id: string;
  buyerName: string;
  buyerContact: string;
  wasteCategory: string;
  grade: string;
  quantity: number;
  pricePerKg: number;
  totalAmount: number;
  saleDate: string;
  status: 'pending' | 'completed' | 'delivered';
  notes?: string;
}

type TabType = 'assigned' | 'processing' | 'sales';

export default function RecyclerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [recyclerData, setRecyclerData] = useState<RecyclerData | null>(null);
  const [assignedRequests, setAssignedRequests] = useState<ClientRequest[]>([]);
  const [processingHistory, setProcessingHistory] = useState<ProcessingRecord[]>([]);
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);
  const [stats, setStats] = useState({
    totalReceived: 0,
    totalProcessed: 0,
    totalRevenue: 0,
    pendingCollections: 0,
    completedToday: 0,
    totalWeightProcessed: 0
  });
  const [activeTab, setActiveTab] = useState<TabType>('assigned');
  const [selectedRequest, setSelectedRequest] = useState<ClientRequest | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        // Get recycler data
        const recyclerRef = ref(db, `Recyclers/${user.uid}`);
        const recyclerSnapshot = await get(recyclerRef);
        const recyclerInfo = recyclerSnapshot.val();
        
        if (!recyclerInfo) {
          console.error('Recycler not found');
          router.push('/unauthorized');
          return;
        }
        
        setRecyclerData({ id: user.uid, ...recyclerInfo });
        
        // Load all data
        loadAssignedRequests(user.uid);
        loadProcessingHistory(user.uid);
        loadSalesHistory(user.uid);
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading recycler data:', error);
        router.push('/login');
      }
    });

    return () => unsubscribe();
  };

  const loadAssignedRequests = (recyclerId: string) => {
    const requestsRef = ref(db, 'ClientRequest');
    
    const unsubscribe = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const requestsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as ClientRequest[];
        
        // Filter requests assigned to this recycler and not completed
        const assigned = requestsArray.filter(req => 
          req.WMS_id === recyclerId && 
          req.status !== 'ended'
        );
        
        setAssignedRequests(assigned);
        
        // Calculate stats
        const today = new Date().toISOString().split('T')[0];
        const completedToday = requestsArray.filter(req => 
          req.WMS_id === recyclerId && 
          req.status === 'ended' &&
          req.created_at?.startsWith(today)
        ).length;
        
        const totalWeight = assigned.reduce((sum, req) => sum + (req.weight_kg || 0), 0);
        
        setStats(prev => ({
          ...prev,
          pendingCollections: assigned.length,
          completedToday,
          totalWeightProcessed: totalWeight
        }));
      }
    });

    return () => unsubscribe();
  };

  const loadProcessingHistory = (recyclerId: string) => {
    const historyRef = ref(db, `Recyclers/${recyclerId}/processingHistory`);
    
    const unsubscribe = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const historyArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as ProcessingRecord[];
        
        setProcessingHistory(historyArray);
        
        const totalProcessed = historyArray.reduce((sum, record) => sum + (record.outputWeight || 0), 0);
        setStats(prev => ({ ...prev, totalProcessed }));
      }
    });

    return () => unsubscribe();
  };

  const loadSalesHistory = (recyclerId: string) => {
    const salesRef = ref(db, `Recyclers/${recyclerId}/sales`);
    
    const unsubscribe = onValue(salesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const salesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as SaleRecord[];
        
        setSalesHistory(salesArray);
        
        const totalRevenue = salesArray.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
        setStats(prev => ({ ...prev, totalRevenue }));
      }
    });

    return () => unsubscribe();
  };

  const receiveAndProcessWaste = async (request: ClientRequest, inputWeight: number, outputWeight: number, grade: string, notes: string) => {
    try {
      const recyclerId = auth.currentUser?.uid;
      if (!recyclerId) throw new Error('No recycler ID');

      // Update the request status
      const requestRef = ref(db, `ClientRequest/${request.id}`);
      await update(requestRef, {
        status: 'ended',
        weight_kg: inputWeight,
        calculated_price: inputWeight * (request.price_per_kg || 2),
        waste_grade: grade,
        receivedAt: new Date().toISOString(),
        processedBy: recyclerId,
        outputWeight: outputWeight
      });

      // Create processing record
      const batchNumber = `BATCH-${Date.now()}-${recyclerId.slice(-4)}`;
      const historyRef = ref(db, `Recyclers/${recyclerId}/processingHistory`);
      const newHistoryRef = push(historyRef);
      
      await set(newHistoryRef, {
        requestId: request.id,
        clientName: request.client_name,
        wasteCategory: request.waste_category || request.category || 'General',
        grade: grade,
        inputWeight: inputWeight,
        outputWeight: outputWeight,
        processedAt: new Date().toISOString(),
        processedBy: recyclerId,
        batchNumber: batchNumber,
        notes: notes,
        originalWeight: request.weight_kg || request.weight,
        pricePerKg: request.price_per_kg || 2
      });

      // Update recycler stats
      const recyclerStatsRef = ref(db, `Recyclers/${recyclerId}/stats`);
      const statsSnapshot = await get(recyclerStatsRef);
      const currentStats = statsSnapshot.val() || {};
      
      await set(recyclerStatsRef, {
        totalReceived: (currentStats.totalReceived || 0) + inputWeight,
        totalProcessed: (currentStats.totalProcessed || 0) + outputWeight,
        lastProcessedAt: new Date().toISOString(),
        totalTransactions: (currentStats.totalTransactions || 0) + 1
      });

      alert(`Successfully processed ${inputWeight}kg into ${outputWeight}kg recyclable material!`);
      setShowReceiveModal(false);
      setSelectedRequest(null);
      
    } catch (error) {
      console.error('Error processing waste:', error);
      alert('Failed to process waste. Please try again.');
    }
  };

  const recordSale = async (sale: Omit<SaleRecord, 'id' | 'saleDate'>) => {
    try {
      const recyclerId = auth.currentUser?.uid;
      if (!recyclerId) throw new Error('No recycler ID');

      const salesRef = ref(db, `Recyclers/${recyclerId}/sales`);
      const newSaleRef = push(salesRef);
      
      await set(newSaleRef, {
        ...sale,
        saleDate: new Date().toISOString(),
        status: 'completed',
        recordedBy: recyclerId
      });

      // Update revenue stats
      const recyclerStatsRef = ref(db, `Recyclers/${recyclerId}/stats`);
      const statsSnapshot = await get(recyclerStatsRef);
      const currentStats = statsSnapshot.val() || {};
      
      await update(recyclerStatsRef, {
        totalRevenue: (currentStats.totalRevenue || 0) + sale.totalAmount,
        lastSaleAt: new Date().toISOString()
      });

      alert(`Sale recorded! Total: ₵${sale.totalAmount.toLocaleString()}`);
      setShowSaleModal(false);
      
    } catch (error) {
      console.error('Error recording sale:', error);
      alert('Failed to record sale. Please try again.');
    }
  };

  const getFilteredHistory = () => {
    if (!filterDate) return processingHistory;
    return processingHistory.filter(record => 
      record.processedAt?.startsWith(filterDate)
    );
  };

  const getFilteredSales = () => {
    if (!filterDate) return salesHistory;
    return salesHistory.filter(sale => 
      sale.saleDate?.startsWith(filterDate)
    );
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
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>♻️ Recycler Dashboard</h1>
          <p>Welcome, {recyclerData?.firstName || recyclerData?.wasteManagementInfo?.CompanyName || 'Recycler'}</p>
        </div>
        <div className={styles.dateBadge}>
          {new Date().toLocaleDateString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📦</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.totalWeightProcessed.toLocaleString()} kg</div>
            <div className={styles.statLabel}>Pending Collection</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>⚙️</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.totalProcessed.toLocaleString()} kg</div>
            <div className={styles.statLabel}>Total Processed</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>₵{stats.totalRevenue.toLocaleString()}</div>
            <div className={styles.statLabel}>Total Revenue</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.completedToday}</div>
            <div className={styles.statLabel}>Completed Today</div>
          </div>
        </div>
      </div>

      {/* Company Info Card */}
      {recyclerData?.wasteManagementInfo && (
        <div className={styles.companyCard}>
          <div className={styles.companyHeader}>
            <span className={styles.companyIcon}>🏭</span>
            <div>
              <h3>{recyclerData.wasteManagementInfo.CompanyName || 'Recycling Facility'}</h3>
              <p>{recyclerData.wasteManagementInfo.RecycleType || 'Recycler'} | {recyclerData.wasteManagementInfo.location || 'Location not set'}</p>
            </div>
          </div>
          <div className={styles.companyDetails}>
            <span>📞 {recyclerData.phone || recyclerData.wasteManagementInfo?.ghMobileNumber || 'N/A'}</span>
            <span>📍 {recyclerData.wasteManagementInfo.district || 'District not set'}</span>
            <span>👥 {recyclerData.wasteManagementInfo.employees || 'N/A'} Employees</span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className={styles.tabBar}>
        <button 
          className={`${styles.tab} ${activeTab === 'assigned' ? styles.active : ''}`}
          onClick={() => setActiveTab('assigned')}
        >
          📋 Assigned Collections ({assignedRequests.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'processing' ? styles.active : ''}`}
          onClick={() => setActiveTab('processing')}
        >
          📊 Processing History ({processingHistory.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'sales' ? styles.active : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          💰 Sales ({salesHistory.length})
        </button>
      </div>

      {/* Assigned Collections Tab */}
      {activeTab === 'assigned' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <h2>Waste Collections Assigned to You</h2>
            <p>Process incoming waste to add to your recycling inventory</p>
          </div>
          
          {assignedRequests.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📭</div>
              <h3>No assigned collections</h3>
              <p>You don't have any waste collections assigned at the moment.</p>
            </div>
          ) : (
            <div className={styles.requestsGrid}>
              {assignedRequests.map((request) => (
                <div key={request.id} className={styles.requestCard}>
                  <div className={styles.requestHeader}>
                    <div>
                      <h3>{request.client_name || 'Unknown Client'}</h3>
                      <span className={styles.requestId}>ID: {request.id.slice(-8)}</span>
                    </div>
                    <span className={`${styles.status} ${styles[request.status || 'searching']}`}>
                      {request.status === 'accepted' ? 'Accepted' : 
                       request.status === 'onride' ? 'In Transit' : 
                       request.status === 'ended' ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                  
                  <div className={styles.requestDetails}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailIcon}>📍</span>
                      <span>{request.Client_address || request.location || 'Address not specified'}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailIcon}>🗑️</span>
                      <span>{request.waste_category || request.category || 'General Waste'}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailIcon}>⚖️</span>
                      <span>Expected: {request.weight_kg || request.weight || '?'} kg</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailIcon}>💰</span>
                      <span>Rate: ₵{request.price_per_kg || 2}/kg</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailIcon}>📞</span>
                      <span>{request.client_phone || 'No phone'}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailIcon}>📅</span>
                      <span>{request.created_at ? new Date(request.created_at).toLocaleString() : 'Date not set'}</span>
                    </div>
                  </div>
                  
                  <button 
                    className={styles.processBtn}
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowReceiveModal(true);
                    }}
                  >
                    ⚙️ Process Waste
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Processing History Tab */}
      {activeTab === 'processing' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <h2>Processing History</h2>
            <div className={styles.filterGroup}>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={styles.dateFilter}
                placeholder="Filter by date"
              />
              {filterDate && (
                <button onClick={() => setFilterDate('')} className={styles.clearFilter}>
                  Clear
                </button>
              )}
            </div>
          </div>
          
          {getFilteredHistory().length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📊</div>
              <h3>No processing records</h3>
              <p>Start processing waste to see your history here.</p>
            </div>
          ) : (
            <div className={styles.historyTable}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Category</th>
                    <th>Grade</th>
                    <th>Input (kg)</th>
                    <th>Output (kg)</th>
                    <th>Yield</th>
                    <th>Batch #</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredHistory().map((record) => (
                    <tr key={record.id}>
                      <td>{new Date(record.processedAt).toLocaleDateString()}</td>
                      <td>{record.clientName}</td>
                      <td>{record.wasteCategory}</td>
                      <td>{record.grade}</td>
                      <td>{record.inputWeight.toLocaleString()}</td>
                      <td>{record.outputWeight.toLocaleString()}</td>
                      <td className={styles.yieldCell}>
                        {((record.outputWeight / record.inputWeight) * 100).toFixed(1)}%
                      </td>
                      <td><code className={styles.batchCode}>{record.batchNumber.slice(-12)}</code></td>
                      <td>{record.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.tableFooter}>
                    <td colSpan={4}><strong>Totals:</strong></td>
                    <td><strong>{getFilteredHistory().reduce((sum, r) => sum + r.inputWeight, 0).toLocaleString()} kg</strong></td>
                    <td><strong>{getFilteredHistory().reduce((sum, r) => sum + r.outputWeight, 0).toLocaleString()} kg</strong></td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <h2>Sales Records</h2>
            <div>
              <button 
                className={styles.sellBtn}
                onClick={() => setShowSaleModal(true)}
              >
                + Record Sale
              </button>
            </div>
          </div>
          
          {getFilteredSales().length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>💰</div>
              <h3>No sales recorded</h3>
              <p>Record your first sale to start tracking revenue.</p>
            </div>
          ) : (
            <div className={styles.salesTable}>
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
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredSales().map((sale) => (
                    <tr key={sale.id}>
                      <td>{new Date(sale.saleDate).toLocaleDateString()}</td>
                      <td>{sale.buyerName}</td>
                      <td>{sale.wasteCategory}</td>
                      <td>{sale.grade}</td>
                      <td>{sale.quantity.toLocaleString()}</td>
                      <td>₵{sale.pricePerKg}</td>
                      <td className={styles.totalCell}>₵{sale.totalAmount.toLocaleString()}</td>
                      <td>
                        <span className={`${styles.saleStatus} ${styles[sale.status]}`}>
                          {sale.status}
                        </span>
                      </td>
                      <td>{sale.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.tableFooter}>
                    <td colSpan={6}><strong>Total Revenue:</strong></td>
                    <td><strong>₵{getFilteredSales().reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString()}</strong></td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Process Waste Modal */}
      {showReceiveModal && selectedRequest && (
        <div className={styles.modal} onClick={() => setShowReceiveModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Process Waste Collection</h2>
              <button className={styles.closeBtn} onClick={() => setShowReceiveModal(false)}>×</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              receiveAndProcessWaste(
                selectedRequest,
                parseFloat(formData.get('inputWeight') as string),
                parseFloat(formData.get('outputWeight') as string),
                formData.get('grade') as string,
                formData.get('notes') as string
              );
            }}>
              <div className={styles.formGroup}>
                <label>Client</label>
                <input type="text" value={selectedRequest.client_name} disabled />
              </div>
              <div className={styles.formGroup}>
                <label>Waste Category</label>
                <input type="text" value={selectedRequest.waste_category || selectedRequest.category} disabled />
              </div>
              <div className={styles.formGroup}>
                <label>Expected Weight (kg)</label>
                <input type="text" value={selectedRequest.weight_kg || selectedRequest.weight} disabled />
              </div>
              <div className={styles.formGroup}>
                <label>Actual Input Weight (kg) *</label>
                <input type="number" name="inputWeight" required step="0.1" placeholder="Enter actual weight received" />
              </div>
              <div className={styles.formGroup}>
                <label>Output Weight After Processing (kg) *</label>
                <input type="number" name="outputWeight" required step="0.1" placeholder="Enter processed weight" />
              </div>
              <div className={styles.formGroup}>
                <label>Grade *</label>
                <select name="grade" required>
                  <option value="">Select grade</option>
                  <option value="G1">G1 - Not Clean (From dump sites)</option>
                  <option value="G2">G2 - Partially Clean (From streets)</option>
                  <option value="G3">G3 - Very Clean (From homes/orgs)</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Processing Notes</label>
                <textarea name="notes" rows={3} placeholder="Any notes about the processing..."></textarea>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowReceiveModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Process Waste
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
              <h2>Record Sale</h2>
              <button className={styles.closeBtn} onClick={() => setShowSaleModal(false)}>×</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const quantity = parseFloat(formData.get('quantity') as string);
              const pricePerKg = parseFloat(formData.get('pricePerKg') as string);
              recordSale({
                buyerName: formData.get('buyerName') as string,
                buyerContact: formData.get('buyerContact') as string,
                wasteCategory: formData.get('category') as string,
                grade: formData.get('grade') as string,
                quantity: quantity,
                pricePerKg: pricePerKg,
                totalAmount: quantity * pricePerKg,
                status: 'completed',
                notes: formData.get('notes') as string
              });
            }}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Buyer Name *</label>
                  <input type="text" name="buyerName" required placeholder="Enter buyer name" />
                </div>
                <div className={styles.formGroup}>
                  <label>Buyer Contact</label>
                  <input type="tel" name="buyerContact" placeholder="Phone number" />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Category *</label>
                  <select name="category" required>
                    <option value="">Select category</option>
                    <option value="Plastic">Plastic</option>
                    <option value="Glass">Glass</option>
                    <option value="Metal">Metal</option>
                    <option value="Paper">Paper</option>
                    <option value="Organic">Organic</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Grade *</label>
                  <select name="grade" required>
                    <option value="">Select grade</option>
                    <option value="G1">G1 - Basic Quality</option>
                    <option value="G2">G2 - Standard Quality</option>
                    <option value="G3">G3 - Premium Quality</option>
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Quantity (kg) *</label>
                  <input type="number" name="quantity" required step="0.1" placeholder="Quantity in kg" />
                </div>
                <div className={styles.formGroup}>
                  <label>Price per kg (₵) *</label>
                  <input type="number" name="pricePerKg" required step="0.01" placeholder="Price per kg" />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Notes (Optional)</label>
                <textarea name="notes" rows={2} placeholder="Any additional notes..."></textarea>
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