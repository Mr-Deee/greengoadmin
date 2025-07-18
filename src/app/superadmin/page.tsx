// app/SuperAdmin/page.tsx
"use client"
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ref, get, onValue, remove, update } from 'firebase/database';
import styles from './superadmin.module.css';
import { WasteManagementRequest, Recycler, Client } from '@/types';
import Modal from '@/components/Modal';
import UserForm from '@/components/UserForm';
import RequestDetails from '@/components/RequestDetails';

export default function SuperAdminPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<WasteManagementRequest[]>([]);
  const [recyclers, setRecyclers] = useState<Recycler[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<WasteManagementRequest | Recycler | Client| null>(null);
  const [modalType, setModalType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Authentication check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      
      try {
        const snapshot = await get(ref(db, `Admin/${user.uid}`));
        if (snapshot.val()?.role !== 'super_admin') {
          router.push('/unauthorized');
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Data fetching
  useEffect(() => {
    const requestsRef = ref(db, 'ClientRequest');
    const recyclersRef = ref(db, 'Recyclers');
    const clientsRef = ref(db, 'Clients');

    const unsubscribeRequests = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val();
      const requestsArray: WasteManagementRequest[] = data ? Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      })) : [];
      setRequests(requestsArray);
    });

    const unsubscribeRecyclers = onValue(recyclersRef, (snapshot) => {
      const data = snapshot.val();
      const recyclersArray: Recycler[] = data ? Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      })) : [];
      setRecyclers(recyclersArray);
    });

    const unsubscribeClients = onValue(clientsRef, (snapshot) => {
      const data = snapshot.val();
      const clientsArray: Client[] = data ? Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      })) : [];
      setClients(clientsArray);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeRecyclers();
      unsubscribeClients();
    };
  }, []);

  const filteredRequests = requests.filter(request => 
    request.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.WMS_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRecyclers = recyclers.filter(recycler => 
    recycler.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recycler.LastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recycler.wasteManagementInfo?.CompanyName?.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const filteredClients= clients.filter(clients => 
    clients.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    clients.LastName?.toLowerCase().includes(searchTerm.toLowerCase()) 
    // clients.wasteManagementInfo?.CompanyName?.toLowerCase().includes(searchTerm.toLowerCase())
);
  const handleDelete = async (collection: string, id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await remove(ref(db, `${collection}/${id}`));
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const handleUpdate = async (collection: string, id: string, updatedData: any) => {
    try {
      await update(ref(db, `${collection}/${id}`), updatedData);
      setModalType(null);
      setSelectedItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const openDetailsModal = (item: WasteManagementRequest | Recycler, type: string) => {
    setSelectedItem(item);
    setModalType(type);
  };

  if (loading) {
    return <div className={styles.loading}>Loading dashboard...</div>;
  }

  // Type guards
  const isRequest = (item: any): item is WasteManagementRequest => {
    return item && 'client_name' in item;
  };

  const isRecycler = (item: any): item is Recycler => {
    return item && 'firstName' in item;
  };

  return (
    <div className={styles.dashboard}>
      <h1 className={styles.title}>Waste Management Dashboard</h1>
      
      {/* Search Bar */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search requests, recyclers..."
          className={styles.searchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {/* Overview Cards */}
      <div className={styles.overviewCards}>
        <div className={styles.card}>
          <h3>Total Requests</h3>
          <p>{requests.length}</p>
        </div>
        <div className={styles.card}>
          <h3>Active Recyclers</h3>
          <p>{recyclers.length}</p>
        </div>
        <div className={styles.card}>
          <h3>Registered Clients</h3>
          <p>{clients.length}</p>
        </div>
      </div>

      {/* Recent Requests */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Waste Collection Requests</h2>
          {/* <button 
            className={styles.addButton}
            onClick={() => setModalType('addRequest')}
          >
            Add New Request
          </button> */}
        </div>
        
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Client</th>
                <th>WMS</th>
                <th>Category</th>
                <th>Weight</th>
                <th>Fare</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.slice(0, 10).map(request => (
                <tr key={request.id}>
                  <td>
                    <div className={styles.clientCell}>
                      <span className={styles.name}>{request.client_name}</span>
                      <span className={styles.phone}>{request.client_phone}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.wmsCell}>
                      <span className={styles.name}>{request.WMS_name}</span>
                      <span className={styles.phone}>{request.WMS_phone}</span>
                    </div>
                  </td>
                  <td>{request.category}</td>
                  <td>{request.weight} kg</td>
                  <td>GHS {request.fares}</td>
                  <td>
                    <span className={`${styles.status} ${styles[request.status]}`}>
                      {request.status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button 
                        className={styles.viewButton}
                        onClick={() => openDetailsModal(request, 'requestDetails')}
                      >
                        View
                      </button>
                      <button 
                        className={styles.editButton}
                        onClick={() => {
                          setSelectedItem(request);
                          setModalType('editRequest');
                        }}
                      >
                        Edit
                      </button>
                      <button 
                        className={styles.deleteButton}
                        onClick={() => handleDelete('ClientRequest', request.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>


          {/* Client List */}
          <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Clients</h2>
         
        </div>
        
        <div className={styles.grid}>
          {filteredClients.slice(0, 12).map(clients => (
            <div key={clients.id} className={styles.recyclerCard}>
              <div className={styles.recyclerHeader}>
                {/* {clients.riderImageUrl && (
                  <img 
                    src={clients.riderImageUrl} 
                    alt={`${clients.firstName} ${clients.LastName}`}
                    className={styles.avatar}
                  />
                )} */}
                <div>
                  <h3>{clients.firstName} {clients.LastName}</h3>
                  {/* <p className={styles.recyclerType}>{recycler.WMSTYPE}</p> */}
                </div>
              </div>
              
            
              
              <div className={styles.recyclerActions}>
                <button 
                  className={styles.viewButton}
                  onClick={() => openDetailsModal(clients, 'recyclerDetails')}
                >
                  Details
                </button>
                <button 
                  className={styles.editButton}
                  onClick={() => {
                    setSelectedItem(clients);
                    setModalType('editRecycler');
                  }}
                >
                  Edit
                </button>
                <button 
                  className={styles.deleteButton}
                  onClick={() => handleDelete('Recyclers', clients.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* Recyclers List */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Registered Recyclers</h2>
          <button 
            className={styles.addButton}
            onClick={() => setModalType('addRecycler')}
          >
            Add New Recycler
          </button>
        </div>
        
        <div className={styles.grid}>
          {filteredRecyclers.slice(0, 12).map(recycler => (
            <div key={recycler.id} className={styles.recyclerCard}>
              <div className={styles.recyclerHeader}>
                {recycler.riderImageUrl && (
                  <img 
                    src={recycler.riderImageUrl} 
                    alt={`${recycler.firstName} ${recycler.LastName}`}
                    className={styles.avatar}
                  />
                )}
                <div>
                  <h3>{recycler.firstName} {recycler.LastName}</h3>
                  <p className={styles.recyclerType}>{recycler.WMSTYPE}</p>
                </div>
              </div>
              
              {recycler.wasteManagementInfo && (
                <div className={styles.companyInfo}>
                  <p><strong>Company:</strong> {recycler.wasteManagementInfo.CompanyName}</p>
                  <p><strong>Location:</strong> {recycler.wasteManagementInfo.location}</p>
                </div>
              )}
              
              <div className={styles.recyclerActions}>
                <button 
                  className={styles.viewButton}
                  onClick={() => openDetailsModal(recycler, 'recyclerDetails')}
                >
                  Details
                </button>
                <button 
                  className={styles.editButton}
                  onClick={() => {
                    setSelectedItem(recycler);
                    setModalType('editRecycler');
                  }}
                >
                  Edit
                </button>
                <button 
                  className={styles.deleteButton}
                  onClick={() => handleDelete('Recyclers', recycler.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modals */}
      {modalType && (
        <Modal onClose={() => {
          setModalType(null);
          setSelectedItem(null);
        }}>
          {modalType === 'requestDetails' && selectedItem && isRequest(selectedItem) && (
            <RequestDetails 
              request={selectedItem} 
              onClose={() => setModalType(null)}
            />
          )}
          {(modalType === 'editRequest' || modalType === 'addRequest') && (
            <UserForm
              type="request"
              initialData={modalType === 'editRequest' && selectedItem && isRequest(selectedItem) ? selectedItem : undefined}
              onSubmit={(data: any) => handleUpdate(
                'ClientRequest', 
                modalType === 'editRequest' && selectedItem ? selectedItem.id : Date.now().toString(),
                data
              )}
            />
          )}
          {(modalType === 'editRecycler' || modalType === 'addRecycler') && (
            <UserForm
              type="recycler"
              initialData={modalType === 'editRecycler' && selectedItem && isRecycler(selectedItem) ? selectedItem : undefined}
              onSubmit={(data) => handleUpdate(
                'Recyclers', 
                modalType === 'editRecycler' && selectedItem ? selectedItem.id : Date.now().toString(),
                data
              )}
            />
          )}
          {modalType === 'recyclerDetails' && selectedItem && isRecycler(selectedItem) && (
            <div className={styles.detailsModal}>
              <h2>Recycler Details</h2>
              <div className={styles.detailsContent}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Name:</span>
                  <span>{selectedItem.firstName} {selectedItem.LastName}</span>
                </div>
                {selectedItem.wasteManagementInfo && (
                  <>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Company:</span>
                      <span>{selectedItem.wasteManagementInfo.CompanyName}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Location:</span>
                      <span>{selectedItem.wasteManagementInfo.location}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}