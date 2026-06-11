'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { ref, onValue, update, push, set } from 'firebase/database';
import styles from './field-operator.module.css';

interface CollectionTask {
  id: string;
  clientName: string;
  address: string;
  wasteType: string;
  weight: number;
  scheduledDate: string;
  status: 'pending' | 'in-progress' | 'completed';
  coordinates?: { lat: number; lng: number };
  clientId?: string;
  clientPhone?: string;
  actualWeight?: number;
  completedAt?: string;
  updatedAt?: string;
}

export default function FieldOperatorPage() {
  const [tasks, setTasks] = useState<CollectionTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeTasks: 0,
    inProgress: 0,
    totalWeight: 0,
    completedToday: 0
  });

  useEffect(() => {
    fetchTasksRealtime();
  }, []);

  // Real-time listener for tasks
  const fetchTasksRealtime = () => {
    setLoading(true);
    
    // Listen to collection tasks
    const tasksRef = ref(db, 'collectionTasks');
    
    const unsubscribe = onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tasksArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as CollectionTask[];
        
        // Filter for pending and in-progress tasks
        const activeTasks = tasksArray.filter(task => 
          task.status === 'pending' || task.status === 'in-progress'
        );
        
        setTasks(activeTasks);
        
        // Update stats
        const inProgressCount = activeTasks.filter(t => t.status === 'in-progress').length;
        const totalWeight = activeTasks.reduce((sum, t) => sum + (t.weight || 0), 0);
        const completedToday = tasksArray.filter(t => 
          t.status === 'completed' && 
          t.completedAt?.startsWith(new Date().toISOString().split('T')[0])
        ).length;
        
        setStats({
          activeTasks: activeTasks.length,
          inProgress: inProgressCount,
          totalWeight: totalWeight,
          completedToday: completedToday
        });
      } else {
        setTasks([]);
        setStats({
          activeTasks: 0,
          inProgress: 0,
          totalWeight: 0,
          completedToday: 0
        });
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching tasks:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const taskRef = ref(db, `collectionTasks/${taskId}`);
      await update(taskRef, {
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.uid
      });
      
      // Show success message
      alert(`Task marked as ${status}!`);
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task status. Please try again.');
    }
  };

  const recordCollection = async (taskId: string, actualWeight: number) => {
    try {
      const taskRef = ref(db, `collectionTasks/${taskId}`);
      const completedAt = new Date().toISOString();
      
      await update(taskRef, {
        status: 'completed',
        actualWeight,
        completedAt,
        updatedAt: completedAt,
        completedBy: auth.currentUser?.uid
      });
      
      // Get the task details before creating log
      const task = tasks.find(t => t.id === taskId);
      
      if (task) {
        // Create collection log in Realtime Database
        const logsRef = ref(db, 'collectionLogs');
        const newLogRef = push(logsRef);
        await set(newLogRef, {
          taskId,
          clientName: task.clientName,
          clientId: task.clientId,
          wasteType: task.wasteType,
          scheduledWeight: task.weight,
          actualWeight,
          address: task.address,
          collectedAt: completedAt,
          operatorId: auth.currentUser?.uid,
          operatorName: auth.currentUser?.displayName || auth.currentUser?.email,
          status: 'completed'
        });
      }
      
      alert('Collection recorded successfully!');
    } catch (error) {
      console.error('Error recording collection:', error);
      alert('Failed to record collection. Please try again.');
    }
  };

  const getCurrentLocation = () => {
    return new Promise<{lat: number; lng: number}>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          reject(error);
        }
      );
    });
  };

  const updateLocation = async (taskId: string) => {
    try {
      const location = await getCurrentLocation();
      const taskRef = ref(db, `collectionTasks/${taskId}`);
      await update(taskRef, {
        currentLocation: location,
        lastLocationUpdate: new Date().toISOString()
      });
      alert('Location updated successfully!');
    } catch (error) {
      console.error('Error updating location:', error);
      alert('Failed to get current location. Please enable location services.');
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>🚛 Field Operator Dashboard</h1>
          <p>Manage your daily collection tasks</p>
        </div>
        <div className={styles.operatorInfo}>
          <span className={styles.operatorName}>
            {auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0]}
          </span>
        </div>
      </div>

      {/* Stats Overview */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📋</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.activeTasks}</div>
            <div className={styles.statLabel}>Active Tasks</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🚚</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.inProgress}</div>
            <div className={styles.statLabel}>In Progress</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>⚖️</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.totalWeight} kg</div>
            <div className={styles.statLabel}>Total Scheduled</div>
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

      {/* Tasks List */}
      <div className={styles.tasksSection}>
        <h2>Today&apos;s Collection Tasks</h2>
        {tasks.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <h3>No Active Tasks</h3>
            <p>You have no pending or in-progress tasks at the moment.</p>
          </div>
        ) : (
          <div className={styles.tasksList}>
            {tasks.map((task) => (
              <div key={task.id} className={styles.taskCard}>
                <div className={styles.taskHeader}>
                  <div>
                    <h3>{task.clientName}</h3>
                    <span className={styles.clientId}>ID: {task.clientId || 'N/A'}</span>
                  </div>
                  <span className={`${styles.taskStatus} ${styles[task.status]}`}>
                    {task.status === 'pending' ? '⏳ Pending' : 
                     task.status === 'in-progress' ? '🚚 In Progress' : '✅ Completed'}
                  </span>
                </div>
                
                <div className={styles.taskDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailIcon}>📍</span>
                    <span>{task.address}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailIcon}>🗑️</span>
                    <span>{task.wasteType}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailIcon}>⚖️</span>
                    <span>Expected: {task.weight} kg</span>
                    {task.actualWeight && (
                      <span className={styles.actualWeight}> | Actual: {task.actualWeight} kg</span>
                    )}
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailIcon}>📅</span>
                    <span>{new Date(task.scheduledDate).toLocaleString()}</span>
                  </div>
                  {task.clientPhone && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailIcon}>📞</span>
                      <span>{task.clientPhone}</span>
                    </div>
                  )}
                </div>

                <div className={styles.taskActions}>
                  {task.status === 'pending' && (
                    <>
                      <button 
                        className={styles.startBtn}
                        onClick={() => updateTaskStatus(task.id, 'in-progress')}
                      >
                        🚗 Start Collection
                      </button>
                      <button 
                        className={styles.mapBtn}
                        onClick={() => {
                          setSelectedTask(task);
                          setShowMap(true);
                        }}
                      >
                        🗺️ View Route
                      </button>
                      <button 
                        className={styles.locationBtn}
                        onClick={() => updateLocation(task.id)}
                      >
                        📍 Update Location
                      </button>
                    </>
                  )}
                  
                  {task.status === 'in-progress' && (
                    <>
                      <button 
                        className={styles.completeBtn}
                        onClick={() => {
                          const weight = prompt('Enter actual weight collected (kg):', task.weight.toString());
                          if (weight && !isNaN(parseFloat(weight))) {
                            recordCollection(task.id, parseFloat(weight));
                          } else if (weight) {
                            alert('Please enter a valid number for weight.');
                          }
                        }}
                      >
                        ✅ Complete Collection
                      </button>
                      <button 
                        className={styles.mapBtn}
                        onClick={() => {
                          setSelectedTask(task);
                          setShowMap(true);
                        }}
                      >
                        🗺️ View Route
                      </button>
                      <button 
                        className={styles.locationBtn}
                        onClick={() => updateLocation(task.id)}
                      >
                        📍 Update Location
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map Modal */}
      {showMap && selectedTask && (
        <div className={styles.mapModal} onClick={() => setShowMap(false)}>
          <div className={styles.mapContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mapHeader}>
              <h3>Route to {selectedTask.clientName}</h3>
              <button className={styles.closeBtn} onClick={() => setShowMap(false)}>×</button>
            </div>
            <div className={styles.mapPlaceholder}>
              <div className={styles.locationInfo}>
                <p><strong>📍 Address:</strong> {selectedTask.address}</p>
                {selectedTask.coordinates ? (
                  <>
                    <p><strong>📌 Coordinates:</strong> {selectedTask.coordinates.lat}, {selectedTask.coordinates.lng}</p>
                    <button 
                      className={styles.openMapBtn}
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedTask.coordinates?.lat},${selectedTask.coordinates?.lng}`, '_blank')}
                    >
                      🗺️ Get Directions
                    </button>
                  </>
                ) : (
                  <p>No coordinates available for this location</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}