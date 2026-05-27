"use client";

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ref, get, onValue, remove, update } from "firebase/database";
import styles from "./superadmin.module.css";
import Modal from "@/components/Modal";
import UserForm from "@/components/UserForm";
import Image from "next/image";
import { Client, Recycler } from "@/types";

// ============================================================================
// Types & Constants
// ============================================================================

type ViewMode = "clients" | "recyclers" | "secondary" | "tertiary" | null;

interface Transaction {
  amount: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: string;
  timestamp: string;
  transactionId?: string;
  type?: string;
  ref?: string;
  DepositorName?: string;
  id?: string;
}

interface WasteRequest {
  id: string;
  Client_id?: string;
  client_name?: string;
  client_phone?: string;
  category?: string;
  status?: string;
  weight?: string;
  weight_kg?: number;
  calculated_price?: string;
  payment_method?: string;
  created_at?: string;
  WMS_name?: string;
  WMS_phone?: string;
  location?: string;
  [key: string]: unknown;
}

interface PrimaryRequest {
  id: string;
  UserName?: string;
  address?: string;
  category?: string;
  description?: string;
  grade?: string;
  status?: string;
  weight?: string;
  valuePerKg?: string;
  total?: string;
  timestamp?: string;
  userId?: string;
  [key: string]: unknown;
}

interface SecondaryRequest {
  id: string;
  UserName?: string;
  address?: string;
  category?: string;
  description?: string;
  grade?: string;
  status?: string;
  weight?: string;
  valuePerKg?: string;
  timestamp?: string;
  userId?: string;
  [key: string]: unknown;
}

// ============================================================================
// Helper Components
// ============================================================================

// Image Component with Fallback
const AvatarWithFallback = ({ 
  src, 
  name, 
  size = 52 
}: { 
  src?: string; 
  name: string; 
  size?: number;
}) => {
  const [imgError, setImgError] = useState(false);
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  if (imgError || !src) {
    return (
      <div 
        className={styles.avatarPlaceholder}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initials || "?"}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      className={styles.avatar}
      width={size}
      height={size}
      onError={() => setImgError(true)}
      unoptimized={false}
    />
  );
};

// Toast Notification Component
const Toast = ({ 
  message, 
  type, 
  onClose 
}: { 
  message: string; 
  type: "success" | "error" | "info";
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  
  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      <span className={styles.toastIcon}>{icons[type]}</span>
      <span className={styles.toastMessage}>{message}</span>
      <button onClick={onClose} className={styles.toastClose}>×</button>
    </div>
  );
};

// Entity Card Component
const EntityCard = ({ 
  entity, 
  type, 
  onView, 
  onDelete 
}: { 
  entity: Client | Recycler;
  type: "client" | "recycler";
  onView: () => void;
  onDelete: () => void;
}) => {
  const isClient = type === "client";
  const name = isClient 
    ? `${(entity as Client).firstName || "Unknown"} ${(entity as Client).LastName || ""}`
    : `${(entity as Recycler).firstName || "Unknown"} ${(entity as Recycler).LastName || ""}`;
  
  const email = isClient ? (entity as Client).email : (entity as Recycler).email;
  const phone = isClient ? (entity as Client).phoneNumber : (entity as Recycler).phone || (entity as Recycler).phoneNumber;
  const company = !isClient ? (entity as Recycler).wasteManagementInfo?.CompanyName : null;
  const location = isClient ? (entity as Client).location : (entity as Recycler).wasteManagementInfo?.location;

  return (
    <div className={styles.entityCard}>
      <div className={styles.entityHeader}>
        <AvatarWithFallback 
          src={!isClient ? (entity as Recycler).riderImageUrl : undefined}
          name={name}
          size={52}
        />
        <div className={styles.entityHeaderContent}>
          <h3>{name}</h3>
          <span className={styles.entityType}>
            {isClient ? "👤 Client" : `♻️ ${(entity as Recycler).WMSTYPE || "Recycler"}`}
          </span>
        </div>
      </div>

      <div className={styles.entityInfo}>
        {company && <p><strong>Company:</strong> {company}</p>}
        <p><strong>Email:</strong> {email || "N/A"}</p>
        <p><strong>Phone:</strong> {phone || "N/A"}</p>
        {location && <p><strong>Location:</strong> {location}</p>}
      </div>

      <div className={styles.entityActions}>
        <button className={styles.viewButton} onClick={onView}>
          📋 View / Edit
        </button>
        <button className={styles.deleteButton} onClick={onDelete}>
          🗑️ Delete
        </button>
      </div>
    </div>
  );
};

// Detail Row Component
const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.popupRow}>
    <span className={styles.popupLabel}>{label}:</span>
    <span className={styles.popupValue}>{value}</span>
  </div>
);

// ============================================================================
// Popup Menu Component
// ============================================================================

interface FormData {
  [key: string]: unknown;
}

interface PopupMenuProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  item: Client | Recycler | null;
  itemType: "client" | "recycler";
  onSave: (updatedData: Record<string, unknown>) => void;
}

const PopupMenu = ({
  isOpen,
  onClose,
  title,
  item,
  itemType,
  onSave,
}: PopupMenuProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormData>({});
  const popupRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // Handle body scroll and ESC key
  useEffect(() => {
    if (isOpen) {
      scrollPositionRef.current = window.scrollY;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          if (isEditing) {
            setIsEditing(false);
          } else {
            onClose();
          }
        }
      };
      
      window.addEventListener("keydown", handleEsc);
      
      setTimeout(() => {
        if (popupRef.current) {
          const focusableElements = popupRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusableElements.length) {
            (focusableElements[0] as HTMLElement).focus();
          }
        }
      }, 100);
      
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        
        window.scrollTo(0, scrollPositionRef.current);
        window.removeEventListener("keydown", handleEsc);
      };
    }
  }, [isOpen, onClose, isEditing]);

  // Set form data when item changes
  useEffect(() => {
    if (isOpen && item) {
      setFormData({ ...item });
    }
  }, [isOpen, item]);

  // Handle click outside
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (isEditing) {
        setIsEditing(false);
      } else {
        onClose();
      }
    }
  };

  if (!isOpen || !item) {
    return null;
  }

  const isClient = itemType === "client" || ("firstName" in item && "LastName" in item);
  const client = isClient ? item as Client : null;
  const recycler = !isClient ? item as Recycler : null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev: FormData) => ({
        ...prev,
        [parent]: { ...(prev[parent] as Record<string, unknown>), [child]: value },
      }));
    } else {
      setFormData((prev: FormData) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setIsEditing(false);
    onClose();
  };

  const renderClientForm = () => (
    <>
      {["firstName", "LastName", "email", "phoneNumber", "location", "SettlementType", "gpsAddress", "ghCardNo", "dateOfBirth"].map((field) => (
        <div key={field} className={styles.popupFormGroup}>
          <label>{field.replace(/([A-Z])/g, ' $1').trim()}</label>
          <input
            type={field === "dateOfBirth" ? "date" : field === "email" ? "email" : "text"}
            name={field}
            value={(formData[field] as string) || ""}
            onChange={handleInputChange}
            required={["firstName", "LastName", "email", "phoneNumber"].includes(field)}
          />
        </div>
      ))}
    </>
  );

  const renderRecyclerForm = () => (
    <>
      {["firstName", "LastName", "email", "phone"].map((field) => (
        <div key={field} className={styles.popupFormGroup}>
          <label>{field.replace(/([A-Z])/g, ' $1').trim()}</label>
          <input
            type={field === "email" ? "email" : "text"}
            name={field}
            value={(formData[field] as string) || ""}
            onChange={handleInputChange}
            required={["firstName", "LastName", "email"].includes(field)}
          />
        </div>
      ))}
      
      <div className={styles.popupDividerText}>Waste Management Info</div>
      
      {["CompanyName", "location", "RecycleType", "employees"].map((field) => (
        <div key={field} className={styles.popupFormGroup}>
          <label>{field}</label>
          <input
            type={field === "employees" ? "number" : "text"}
            name={`wasteManagementInfo.${field}`}
            value={((formData.wasteManagementInfo as Record<string, unknown>)?.[field] as string) || ""}
            onChange={handleInputChange}
          />
        </div>
      ))}
      
      {["WasteCategory", "WasteClassification"].map((field) => (
        <div key={field} className={styles.popupFormGroup}>
          <label>{field} (comma separated)</label>
          <input
            type="text"
            value={
              Array.isArray((formData.wasteManagementInfo as Record<string, unknown>)?.[field])
                ? ((formData.wasteManagementInfo as Record<string, unknown>)[field] as string[]).join(", ")
                : ((formData.wasteManagementInfo as Record<string, unknown>)?.[field] as string) || ""
            }
            onChange={(e) =>
              setFormData((prev: FormData) => ({
                ...prev,
                wasteManagementInfo: {
                  ...(prev.wasteManagementInfo as Record<string, unknown>),
                  [field]: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean),
                },
              }))
            }
          />
        </div>
      ))}
    </>
  );

  const renderClientDetails = () => (
    <>
      <DetailRow label="Full Name" value={`${client?.firstName || "N/A"} ${client?.LastName || ""}`} />
      <DetailRow label="Email" value={client?.email || "N/A"} />
      <DetailRow label="Phone" value={client?.phoneNumber || "N/A"} />
      <DetailRow label="Location" value={client?.location || "N/A"} />
      <DetailRow label="Settlement Type" value={client?.SettlementType || "N/A"} />
      <DetailRow label="GPS Address" value={client?.gpsAddress || "N/A"} />
      <DetailRow label="GH Card No" value={client?.ghCardNo || "N/A"} />
      <DetailRow label="Date of Birth" value={client?.dateOfBirth || "N/A"} />
    </>
  );

  const renderRecyclerDetails = () => (
    <>
      <DetailRow label="Full Name" value={`${recycler?.firstName || "N/A"} ${recycler?.LastName || ""}`} />
      <DetailRow label="Email" value={recycler?.email || "N/A"} />
      <DetailRow label="Phone" value={recycler?.phone || recycler?.phoneNumber || "N/A"} />
      <DetailRow label="Category" value={recycler?.WMSCATEGORY || recycler?.wmsCategory || recycler?.wasteManagementInfo?.RecycleType || "Primary"} />
      
      {recycler?.wasteManagementInfo && (
        <>
          <div className={styles.popupDivider} />
          <DetailRow label="Company" value={recycler.wasteManagementInfo.CompanyName || "N/A"} />
          <DetailRow label="Location" value={recycler.wasteManagementInfo.location || "N/A"} />
          <DetailRow label="Recycle Type" value={recycler.wasteManagementInfo.RecycleType || "N/A"} />
          <DetailRow 
            label="Waste Category" 
            value={
              recycler.wasteManagementInfo.WasteCategory
                ? Array.isArray(recycler.wasteManagementInfo.WasteCategory)
                  ? recycler.wasteManagementInfo.WasteCategory.join(", ")
                  : recycler.wasteManagementInfo.WasteCategory
                : "N/A"
            }
          />
          <DetailRow 
            label="Waste Classification" 
            value={
              recycler.wasteManagementInfo.WasteClassification
                ? Array.isArray(recycler.wasteManagementInfo.WasteClassification)
                  ? recycler.wasteManagementInfo.WasteClassification.join(", ")
                  : recycler.wasteManagementInfo.WasteClassification
                : "N/A"
            }
          />
          <DetailRow label="Employees" value={recycler.wasteManagementInfo.employees?.toString() || "N/A"} />
        </>
      )}
    </>
  );

  return (
    <div className={styles.popupOverlay} onClick={handleOverlayClick}>
      <div
        className={styles.popupMenu}
        ref={popupRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.popupHeader}>
          <h3>{title}</h3>

          <div>
            {!isEditing && (
              <button
                className={styles.popupEditBtn}
                onClick={() => setIsEditing(true)}
              >
                ✏️ Edit
              </button>
            )}

            <button className={styles.popupClose} onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit}>
            {isClient ? renderClientForm() : renderRecyclerForm()}

            <div className={styles.popupFormActions}>
              <button
                type="button"
                className={styles.popupCancelBtn}
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>

              <button type="submit" className={styles.popupSaveBtn}>
                Save
              </button>
            </div>
          </form>
        ) : (
          <div>
            {isClient ? renderClientDetails() : renderRecyclerDetails()}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export default function SuperAdminPage() {
  const router = useRouter();
  
  // State
  const [requests, setRequests] = useState<WasteRequest[]>([]);
  const [primaryRequests, setPrimaryRequests] = useState<PrimaryRequest[]>([]);
  const [secondaryRequests, setSecondaryRequests] = useState<SecondaryRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recyclers, setRecyclers] = useState<{ primary: Recycler[]; secondary: Recycler[]; tertiary: Recycler[] }>({
    primary: [], secondary: [], tertiary: []
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(null);
  const [selectedItem, setSelectedItem] = useState<Client | Recycler | null>(null);
  const [popupState, setPopupState] = useState({ isOpen: false, title: "", type: "client" as "client" | "recycler" });
  const [modalType, setModalType] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Helper Functions
  const showToast = useCallback((message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
  }, []);

  const getRecyclerCategory = useCallback((recycler: Recycler): "primary" | "secondary" | "tertiary" => {
    const category = recycler.WMSCATEGORY || recycler.wmsCategory || recycler.wasteManagementInfo?.RecycleType;
    if (category === "Secondary") return "secondary";
    if (category === "Tertiary") return "tertiary";
    return "primary";
  }, []);

  // Authentication Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const snapshot = await get(ref(db, `Admin/${user.uid}`));
        if (snapshot.val()?.role !== "super_admin") {
          router.push("/unauthorized");
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking admin role:", error);
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Data Fetching
  useEffect(() => {
    const unsubscribeRecyclers = onValue(ref(db, "Recyclers"), (snapshot) => {
      const data = snapshot.val();
      const recyclersArray: Recycler[] = data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : [];
      
      const categorized = { primary: [] as Recycler[], secondary: [] as Recycler[], tertiary: [] as Recycler[] };
      recyclersArray.forEach((recycler) => {
        categorized[getRecyclerCategory(recycler)].push(recycler);
      });
      setRecyclers(categorized);
    });

    const unsubscribeClients = onValue(ref(db, "Clients"), (snapshot) => {
      const data = snapshot.val();
      setClients(data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : []);
    });

    const unsubscribeRequests = onValue(ref(db, "ClientRequest"), (snapshot) => {
      const data = snapshot.val();
      setRequests(data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : []);
    });

    const unsubscribePrimaryRequests = onValue(ref(db, "PrimaryRequestsAvailable"), (snapshot) => {
      const data = snapshot.val();
      setPrimaryRequests(data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : []);
    });

    const unsubscribeSecondaryRequests = onValue(ref(db, "SecondaryRequestsAvailable"), (snapshot) => {
      const data = snapshot.val();
      setSecondaryRequests(data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : []);
    });

    const unsubscribeTransactions = onValue(ref(db, "transactions"), (snapshot) => {
      const data = snapshot.val();
      setTransactions(data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : []);
    });

    return () => {
      unsubscribeRecyclers();
      unsubscribeClients();
      unsubscribeRequests();
      unsubscribePrimaryRequests();
      unsubscribeSecondaryRequests();
      unsubscribeTransactions();
    };
  }, [getRecyclerCategory]);

  // Stats Data
  const stats = useMemo(() => ({
    totalRequests: requests.length,
    totalPrimaryRequests: primaryRequests.length,
    totalSecondaryRequests: secondaryRequests.length,
    pendingRequests: requests.filter(r => r.status === "searching" || r.status === "accepted").length,
    completedRequests: requests.filter(r => r.status === "ended").length,
    totalRecyclers: recyclers.primary.length + recyclers.secondary.length + recyclers.tertiary.length,
    totalClients: clients.length,
    totalTransactions: transactions.length,
    totalRevenue: transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
  }), [requests, primaryRequests, secondaryRequests, recyclers, clients, transactions]);

  // Filtered Data - Fixed version without generic issues
  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) {
      return {
        clients,
        primary: recyclers.primary,
        secondary: recyclers.secondary,
        tertiary: recyclers.tertiary,
      };
    }
    
    // Filter clients
    const filteredClients = clients.filter(client => {
      return (
        client.firstName?.toLowerCase().includes(term) ||
        client.LastName?.toLowerCase().includes(term) ||
        client.email?.toLowerCase().includes(term) ||
        client.phoneNumber?.toLowerCase().includes(term) ||
        client.location?.toLowerCase().includes(term)
      );
    });
    
    // Filter primary recyclers
    const filteredPrimary = recyclers.primary.filter(recycler => {
      return (
        recycler.firstName?.toLowerCase().includes(term) ||
        recycler.LastName?.toLowerCase().includes(term) ||
        recycler.email?.toLowerCase().includes(term) ||
        recycler.phone?.toLowerCase().includes(term) ||
        recycler.wasteManagementInfo?.CompanyName?.toLowerCase().includes(term)
      );
    });
    
    // Filter secondary recyclers
    const filteredSecondary = recyclers.secondary.filter(recycler => {
      return (
        recycler.firstName?.toLowerCase().includes(term) ||
        recycler.LastName?.toLowerCase().includes(term) ||
        recycler.email?.toLowerCase().includes(term) ||
        recycler.phone?.toLowerCase().includes(term) ||
        recycler.wasteManagementInfo?.CompanyName?.toLowerCase().includes(term)
      );
    });
    
    // Filter tertiary recyclers
    const filteredTertiary = recyclers.tertiary.filter(recycler => {
      return (
        recycler.firstName?.toLowerCase().includes(term) ||
        recycler.LastName?.toLowerCase().includes(term) ||
        recycler.email?.toLowerCase().includes(term) ||
        recycler.phone?.toLowerCase().includes(term) ||
        recycler.wasteManagementInfo?.CompanyName?.toLowerCase().includes(term)
      );
    });

    return {
      clients: filteredClients,
      primary: filteredPrimary,
      secondary: filteredSecondary,
      tertiary: filteredTertiary,
    };
  }, [searchTerm, clients, recyclers]);

  // CRUD Operations
  const handleDelete = async (collection: string, id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await remove(ref(db, `${collection}/${id}`));
      showToast("Item deleted successfully!", "success");
    } catch (error) {
      console.error("Error deleting item:", error);
      showToast("Failed to delete item. Please try again.", "error");
    }
  };

  const handleUpdate = async (collection: string, id: string, updatedData: Record<string, unknown>) => {
    try {
      await update(ref(db, `${collection}/${id}`), updatedData);
      setPopupState(prev => ({ ...prev, isOpen: false }));
      setSelectedItem(null);
      showToast("Item updated successfully!", "success");
    } catch (error) {
      console.error("Error updating item:", error);
      showToast("Failed to update item. Please try again.", "error");
    }
  };

  const handleCreate = async (collection: string, id: string, data: Record<string, unknown>) => {
    try {
      await update(ref(db, `${collection}/${id}`), data);
      setModalType(null);
      setSelectedItem(null);
      showToast("Item created successfully!", "success");
    } catch (error) {
      console.error("Error creating item:", error);
      showToast("Failed to create item. Please try again.", "error");
    }
  };

  const openPopupMenu = (item: Client | Recycler, title: string, type: "client" | "recycler") => {
    setSelectedItem(item);
    setPopupState({ isOpen: true, title, type });
  };

  const handleClosePopup = useCallback(() => {
    setPopupState(prev => ({ ...prev, isOpen: false }));
    setTimeout(() => setSelectedItem(null), 300);
  }, []);

  // Loading State
  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <div className={styles.loadingText}>Loading dashboard...</div>
      </div>
    );
  }

  // Main Dashboard View
  if (viewMode === null) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.glassContainer}>
          <h1 className={styles.title}>♻️ Waste Management Dashboard</h1>
          
          {/* Stats Overview */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>📋</div>
              <div className={styles.statInfo}>
                <h3>Total Requests</h3>
                <p>{stats.totalRequests}</p>
                <small>+{stats.pendingRequests} pending</small>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>♻️</div>
              <div className={styles.statInfo}>
                <h3>Recyclers</h3>
                <p>{stats.totalRecyclers}</p>
                <small>{recyclers.primary.length} Primary</small>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>👥</div>
              <div className={styles.statInfo}>
                <h3>Clients</h3>
                <p>{stats.totalClients}</p>
                <small>Registered users</small>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>💰</div>
              <div className={styles.statInfo}>
                <h3>Revenue</h3>
                <p>₵{stats.totalRevenue.toLocaleString()}</p>
                <small>From {stats.totalTransactions} txns</small>
              </div>
            </div>
          </div>
          
          <div className={styles.categoryGrid}>
            <div className={styles.categoryCard} onClick={() => setViewMode("clients")}>
              <div className={styles.categoryIcon}>👥</div>
              <h3>Clients</h3>
              <p className={styles.categoryCount}>{filteredData.clients.length} registered</p>
            </div>
            <div className={styles.categoryCard} onClick={() => setViewMode("recyclers")}>
              <div className={styles.categoryIcon}>♻️</div>
              <h3>Primary Recyclers</h3>
              <p className={styles.categoryCount}>{recyclers.primary.length} active</p>
            </div>
            <div className={styles.categoryCard} onClick={() => setViewMode("secondary")}>
              <div className={styles.categoryIcon}>🏭</div>
              <h3>Secondary Recyclers</h3>
              <p className={styles.categoryCount}>{recyclers.secondary.length} active</p>
            </div>
            <div className={styles.categoryCard} onClick={() => setViewMode("tertiary")}>
              <div className={styles.categoryIcon}>🔧</div>
              <h3>Tertiary Recyclers</h3>
              <p className={styles.categoryCount}>{recyclers.tertiary.length} active</p>
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className={styles.recentActivity}>
            <h2>Recent Activity</h2>
            <div className={styles.activityList}>
              {requests.slice(0, 5).map((req) => (
                <div key={req.id} className={styles.activityItem}>
                  <span className={styles.activityIcon}>
                    {req.status === "ended" ? "✅" : req.status === "accepted" ? "🚚" : "⏳"}
                  </span>
                  <div className={styles.activityContent}>
                    <p><strong>{req.client_name || "Unknown"}</strong> - {req.category || "General"}</p>
                    <small>{req.status} • {req.weight_kg || req.weight || "?"} kg</small>
                  </div>
                  <span className={styles.activityTime}>
                    {req.created_at ? new Date(req.created_at).toLocaleDateString() : "Recent"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // Entity View Renderer
  const renderEntityView = (
    title: string,
    items: (Client | Recycler)[],
    type: "client" | "recycler",
    collection: string,
    addButtonText: string
  ) => (
    <div className={styles.dashboard}>
      <div className={styles.glassContainer}>
        <div className={styles.viewHeader}>
          <button className={styles.backButton} onClick={() => { setViewMode(null); setSearchTerm(""); }}>
            ← Back to Dashboard
          </button>
          <h2>{title}</h2>
          <button 
            className={styles.addButton} 
            onClick={() => { setSelectedItem(null); setModalType(`add${type === "client" ? "Client" : "Recycler"}`); }}
          >
            + {addButtonText}
          </button>
        </div>

        <div className={styles.searchContainer}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className={styles.searchClear} onClick={() => setSearchTerm("")}>
                ✕
              </button>
            )}
          </div>
        </div>

        <div className={styles.statsBar}>
          <span>Total: {items.length} items</span>
          {searchTerm && <span>Filtered: {items.length} results</span>}
        </div>

        <div className={styles.grid}>
          {items.map((item) => (
            <EntityCard
              key={item.id}
              entity={item}
              type={type}
              onView={() => openPopupMenu(item, `${title} Information`, type)}
              onDelete={() => handleDelete(collection, item.id)}
            />
          ))}
        </div>

        {items.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>📭</div>
            <h3>No {title.toLowerCase()} found</h3>
            <p>Try adjusting your search or add a new {type}.</p>
            <button 
              className={styles.emptyStateAction}
              onClick={() => { setSelectedItem(null); setModalType(`add${type === "client" ? "Client" : "Recycler"}`); }}
            >
              + Add {type === "client" ? "Client" : "Recycler"}
            </button>
          </div>
        )}

        {modalType && (
          <Modal onClose={() => { setModalType(null); setSelectedItem(null); }}>
            <UserForm
              type={type}
              initialData={modalType.startsWith("edit") && selectedItem ? selectedItem : undefined}
              onSubmit={(data: Record<string, unknown>) => {
                if (modalType.startsWith("edit") && selectedItem) {
                  handleUpdate(collection, selectedItem.id, data);
                } else {
                  handleCreate(collection, Date.now().toString(), data);
                }
              }}
              onCancel={() => { setModalType(null); setSelectedItem(null); }}
            />
          </Modal>
        )}

        <PopupMenu
          isOpen={popupState.isOpen}
          onClose={handleClosePopup}
          title={popupState.title}
          item={selectedItem}
          itemType={popupState.type}
          onSave={(updatedData: Record<string, unknown>) => {
            if (selectedItem) {
              handleUpdate(collection, selectedItem.id, updatedData);
            }
          }}
        />
      </div>
      
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );

  // Route to appropriate view
  const views = {
    clients: () => renderEntityView("Clients Management", filteredData.clients, "client", "Clients", "Add Client"),
    recyclers: () => renderEntityView("Primary Recyclers Management", filteredData.primary, "recycler", "Recyclers", "Add Recycler"),
    secondary: () => renderEntityView("Secondary Recyclers Management", filteredData.secondary, "recycler", "Recyclers", "Add Secondary Recycler"),
    tertiary: () => renderEntityView("Tertiary Recyclers Management", filteredData.tertiary, "recycler", "Recyclers", "Add Tertiary Recycler"),
  };

  return views[viewMode as keyof typeof views]?.() || null;
}