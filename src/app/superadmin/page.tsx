// app/SuperAdmin/page.tsx
"use client";

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ref, get, onValue, remove, update } from "firebase/database";
import styles from "./superadmin.module.css";
import { WasteManagementRequest, Recycler, Client } from "@/types";
import Modal from "@/components/Modal";
import UserForm from "@/components/UserForm";
import RequestDetails from "@/components/RequestDetails";

type ViewMode = "clients" | "recyclers" | "secondary" | "tertiary" | null;

// Helper function to get recycler category safely
const getRecyclerCategory = (recycler: Recycler): string => {
  if (recycler.WMSCATEGORY) return recycler.WMSCATEGORY;
  if (recycler.wmsCategory) return recycler.wmsCategory;
  if (recycler.wasteManagementInfo?.RecycleType) return recycler.wasteManagementInfo.RecycleType;
  return "Primary";
};

// Helper function to get recycler phone safely
const getRecyclerPhone = (recycler: Recycler): string => {
  return recycler.phone || recycler.phoneNumber || "N/A";
};

// Helper function to get waste category safely
const getWasteCategory = (recycler: Recycler): string => {
  const wasteCategory = recycler.wasteManagementInfo?.WasteCategory;
  if (!wasteCategory) return "N/A";
  if (Array.isArray(wasteCategory)) return wasteCategory.join(", ");
  return wasteCategory;
};

// Helper function to get waste classification safely
const getWasteClassification = (recycler: Recycler): string => {
  const classification = recycler.wasteManagementInfo?.WasteClassification;
  if (!classification) return "N/A";
  if (Array.isArray(classification)) return classification.join(", ");
  return classification;
};

export default function SuperAdminPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<WasteManagementRequest[]>([]);
  const [recyclers, setRecyclers] = useState<Recycler[]>([]);
  const [secondaryRecyclers, setSecondaryRecyclers] = useState<Recycler[]>([]);
  const [tertiaryRecyclers, setTertiaryRecyclers] = useState<Recycler[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<
    WasteManagementRequest | Recycler | Client | null
  >(null);
  const [modalType, setModalType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(null);

  // Authentication check
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

  // Data fetching
  useEffect(() => {
    const requestsRef = ref(db, "ClientRequest");
    const recyclersRef = ref(db, "Recyclers");
    const clientsRef = ref(db, "Clients");

    const unsubscribeRequests = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val();
      const requestsArray: WasteManagementRequest[] = data
        ? Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }))
        : [];
      setRequests(requestsArray);
    });

    const unsubscribeRecyclers = onValue(recyclersRef, (snapshot) => {
      const data = snapshot.val();
      const recyclersArray: Recycler[] = data
        ? Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }))
        : [];

      // Categorize recyclers by their category
      const primary: Recycler[] = [];
      const secondary: Recycler[] = [];
      const tertiary: Recycler[] = [];

      recyclersArray.forEach((recycler) => {
        const category = getRecyclerCategory(recycler);
        
        if (category === "Secondary") {
          secondary.push(recycler);
        } else if (category === "Tertiary") {
          tertiary.push(recycler);
        } else {
          primary.push(recycler);
        }
      });

      setRecyclers(primary);
      setSecondaryRecyclers(secondary);
      setTertiaryRecyclers(tertiary);
    });

    const unsubscribeClients = onValue(clientsRef, (snapshot) => {
      const data = snapshot.val();
      const clientsArray: Client[] = data
        ? Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }))
        : [];
      setClients(clientsArray);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeRecyclers();
      unsubscribeClients();
    };
  }, []);

  // Filter functions
  const filteredClients = clients.filter(
    (client) =>
      client.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.LastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRecyclers = recyclers.filter(
    (recycler) =>
      recycler.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recycler.LastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recycler.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recycler.wasteManagementInfo?.CompanyName?.toLowerCase().includes(
        searchTerm.toLowerCase()
      )
  );

  const filteredSecondaryRecyclers = secondaryRecyclers.filter(
    (recycler) =>
      recycler.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recycler.LastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recycler.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recycler.wasteManagementInfo?.CompanyName?.toLowerCase().includes(
        searchTerm.toLowerCase()
      )
  );

  const filteredTertiaryRecyclers = tertiaryRecyclers.filter(
    (recycler) =>
      recycler.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recycler.LastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recycler.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recycler.wasteManagementInfo?.CompanyName?.toLowerCase().includes(
        searchTerm.toLowerCase()
      )
  );

  const handleDelete = async (collection: string, id: string) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await remove(ref(db, `${collection}/${id}`));
        alert("Item deleted successfully!");
      } catch (error) {
        console.error("Error deleting item:", error);
        alert("Failed to delete item. Please try again.");
      }
    }
  };

  const handleUpdate = async (
    collection: string,
    id: string,
    updatedData: any
  ) => {
    try {
      await update(ref(db, `${collection}/${id}`), updatedData);
      setModalType(null);
      setSelectedItem(null);
      alert("Item updated successfully!");
    } catch (error) {
      console.error("Error updating item:", error);
      alert("Failed to update item. Please try again.");
    }
  };

  const openDetailsModal = (
    item: WasteManagementRequest | Recycler | Client,
    type: string
  ) => {
    setSelectedItem(item);
    setModalType(type);
  };

  const closeView = () => {
    setViewMode(null);
    setSearchTerm("");
  };

  if (loading) {
    return <div className={styles.loading}>Loading dashboard...</div>;
  }

  // Render category boxes (main screen)
  if (viewMode === null) {
    return (
      <div className={styles.dashboard}>
        <h1 className={styles.title}>Waste Management Dashboard</h1>

        {/* Category Boxes */}
        <div className={styles.categoryGrid}>
          <div
            className={styles.categoryCard}
            onClick={() => setViewMode("clients")}
          >
            <div className={styles.categoryIcon}>👥</div>
            <h3>Clients</h3>
            <p className={styles.categoryCount}>{clients.length} registered</p>
          </div>

          <div
            className={styles.categoryCard}
            onClick={() => setViewMode("recyclers")}
          >
            <div className={styles.categoryIcon}>♻️</div>
            <h3>Primary Recyclers</h3>
            <p className={styles.categoryCount}>{recyclers.length} active</p>
          </div>

          <div
            className={styles.categoryCard}
            onClick={() => setViewMode("secondary")}
          >
            <div className={styles.categoryIcon}>🏭</div>
            <h3>Secondary Recyclers</h3>
            <p className={styles.categoryCount}>
              {secondaryRecyclers.length} active
            </p>
          </div>

          <div
            className={styles.categoryCard}
            onClick={() => setViewMode("tertiary")}
          >
            <div className={styles.categoryIcon}>🔧</div>
            <h3>Tertiary Recyclers</h3>
            <p className={styles.categoryCount}>
              {tertiaryRecyclers.length} active
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className={styles.overviewCards}>
          <div className={styles.card}>
            <h3>Total Requests</h3>
            <p>{requests.length}</p>
          </div>
          <div className={styles.card}>
            <h3>Total Recyclers</h3>
            <p>{recyclers.length + secondaryRecyclers.length + tertiaryRecyclers.length}</p>
          </div>
          <div className={styles.card}>
            <h3>Registered Clients</h3>
            <p>{clients.length}</p>
          </div>
        </div>
      </div>
    );
  }

  // Render Clients List
  if (viewMode === "clients") {
    return (
      <div className={styles.dashboard}>
        <div className={styles.viewHeader}>
          <button className={styles.backButton} onClick={closeView}>
            ← Back to Dashboard
          </button>
          <h2>Clients Management</h2>
          <button
            className={styles.addButton}
            onClick={() => {
              setSelectedItem(null);
              setModalType("addClient");
            }}
          >
            + Add Client
          </button>
        </div>

        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search clients by name, email, or phone..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.grid}>
          {filteredClients.map((client) => (
            <div key={client.id} className={styles.recyclerCard}>
              <div className={styles.recyclerHeader}>
                <div className={styles.avatarPlaceholder}>
                  {client.firstName?.charAt(0) || "?"}
                  {client.LastName?.charAt(0) || ""}
                </div>
                <div>
                  <h3>
                    {client.firstName || "Unknown"} {client.LastName || ""}
                  </h3>
                  <p className={styles.recyclerType}>
                    {client.SettlementType || "Client"}
                  </p>
                </div>
              </div>

              <div className={styles.companyInfo}>
                <p>
                  <strong>Email:</strong> {client.email || "N/A"}
                </p>
                <p>
                  <strong>Phone:</strong> {client.phoneNumber || "N/A"}
                </p>
                <p>
                  <strong>Location:</strong> {client.location || "N/A"}
                </p>
              </div>

              <div className={styles.recyclerActions}>
                <button
                  className={styles.viewButton}
                  onClick={() => openDetailsModal(client, "clientDetails")}
                >
                  Details
                </button>
                <button
                  className={styles.editButton}
                  onClick={() => {
                    setSelectedItem(client);
                    setModalType("editClient");
                  }}
                >
                  Edit
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleDelete("Clients", client.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredClients.length === 0 && (
          <div className={styles.noResults}>No clients found.</div>
        )}

        {/* Modals */}
        {modalType && (
          <Modal
            onClose={() => {
              setModalType(null);
              setSelectedItem(null);
            }}
          >
            {(modalType === "editClient" || modalType === "addClient") && (
              <UserForm
                // type="client"
                initialData={modalType === "editClient" && selectedItem
                  ? selectedItem
                  : undefined}
                onSubmit={(data: any) => handleUpdate(
                  "Clients",
                  modalType === "editClient" && selectedItem
                    ? selectedItem.id
                    : Date.now().toString(),
                  data
                )} type={"recycler"}              />
            )}
            {modalType === "clientDetails" && selectedItem && (
              <div className={styles.detailsModal}>
                <h2>Client Details</h2>
                <div className={styles.detailsContent}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Name:</span>
                    <span>
                      {(selectedItem as Client).firstName || "N/A"} {(selectedItem as Client).LastName || ""}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Email:</span>
                    <span>{(selectedItem as Client).email || "N/A"}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Phone:</span>
                    <span>{(selectedItem as Client).phoneNumber || "N/A"}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Location:</span>
                    <span>{(selectedItem as Client).location || "N/A"}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Settlement Type:</span>
                    <span>
                      {(selectedItem as Client).SettlementType || "N/A"}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>GPS Address:</span>
                    <span>{(selectedItem as Client).gpsAddress || "N/A"}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>GH Card No:</span>
                    <span>{(selectedItem as Client).ghCardNo || "N/A"}</span>
                  </div>
                </div>
              </div>
            )}
          </Modal>
        )}
      </div>
    );
  }

  // Render Recyclers (Primary)
  if (viewMode === "recyclers") {
    return (
      <div className={styles.dashboard}>
        <div className={styles.viewHeader}>
          <button className={styles.backButton} onClick={closeView}>
            ← Back to Dashboard
          </button>
          <h2>Primary Recyclers Management</h2>
          <button
            className={styles.addButton}
            onClick={() => {
              setSelectedItem(null);
              setModalType("addRecycler");
            }}
          >
            + Add Recycler
          </button>
        </div>

        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search recyclers by name, email, or company..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.grid}>
          {filteredRecyclers.map((recycler) => (
            <div key={recycler.id} className={styles.recyclerCard}>
              <div className={styles.recyclerHeader}>
                {recycler.riderImageUrl ? (
                  <img
                    src={recycler.riderImageUrl}
                    alt={`${recycler.firstName} ${recycler.LastName}`}
                    className={styles.avatar}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {recycler.firstName?.charAt(0) || "?"}
                    {recycler.LastName?.charAt(0) || ""}
                  </div>
                )}
                <div>
                  <h3>
                    {recycler.firstName || "Unknown"} {recycler.LastName || ""}
                  </h3>
                  <p className={styles.recyclerType}>
                    {recycler.WMSTYPE || "Primary Recycler"}
                  </p>
                </div>
              </div>

              {recycler.wasteManagementInfo && (
                <div className={styles.companyInfo}>
                  <p>
                    <strong>Company:</strong>{" "}
                    {recycler.wasteManagementInfo.CompanyName || "N/A"}
                  </p>
                  <p>
                    <strong>Location:</strong>{" "}
                    {recycler.wasteManagementInfo.location || "N/A"}
                  </p>
                  <p>
                    <strong>Email:</strong> {recycler.email || "N/A"}
                  </p>
                </div>
              )}

              <div className={styles.recyclerActions}>
                <button
                  className={styles.viewButton}
                  onClick={() => openDetailsModal(recycler, "recyclerDetails")}
                >
                  Details
                </button>
                <button
                  className={styles.editButton}
                  onClick={() => {
                    setSelectedItem(recycler);
                    setModalType("editRecycler");
                  }}
                >
                  Edit
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleDelete("Recyclers", recycler.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredRecyclers.length === 0 && (
          <div className={styles.noResults}>No primary recyclers found.</div>
        )}

        {/* Modals */}
        {modalType && (
          <Modal
            onClose={() => {
              setModalType(null);
              setSelectedItem(null);
            }}
          >
            {(modalType === "editRecycler" || modalType === "addRecycler") && (
              <UserForm
                type="recycler"
                initialData={
                  modalType === "editRecycler" && selectedItem
                    ? selectedItem
                    : undefined
                }
                onSubmit={(data: any) =>
                  handleUpdate(
                    "Recyclers",
                    modalType === "editRecycler" && selectedItem
                      ? selectedItem.id
                      : Date.now().toString(),
                    data
                  )
                }
              />
            )}
            {modalType === "recyclerDetails" && selectedItem && (
              <div className={styles.detailsModal}>
                <h2>Recycler Details</h2>
                <div className={styles.detailsContent}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Name:</span>
                    <span>
                      {(selectedItem as Recycler).firstName || "N/A"} {(selectedItem as Recycler).LastName || ""}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Email:</span>
                    <span>{(selectedItem as Recycler).email || "N/A"}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Phone:</span>
                    <span>{getRecyclerPhone(selectedItem as Recycler)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Category:</span>
                    <span>{getRecyclerCategory(selectedItem as Recycler)}</span>
                  </div>
                  {(selectedItem as Recycler).wasteManagementInfo && (
                    <>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Company:</span>
                        <span>
                          {(selectedItem as Recycler).wasteManagementInfo?.CompanyName || "N/A"}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Location:</span>
                        <span>
                          {(selectedItem as Recycler).wasteManagementInfo?.location || "N/A"}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Recycle Type:</span>
                        <span>
                          {(selectedItem as Recycler).wasteManagementInfo?.RecycleType || "N/A"}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Waste Category:</span>
                        <span>
                          {getWasteCategory(selectedItem as Recycler)}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Waste Classification:</span>
                        <span>
                          {getWasteClassification(selectedItem as Recycler)}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Employees:</span>
                        <span>
                          {(selectedItem as Recycler).wasteManagementInfo?.employees || "N/A"}
                        </span>
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

  // Render Secondary Recyclers
  if (viewMode === "secondary") {
    return (
      <div className={styles.dashboard}>
        <div className={styles.viewHeader}>
          <button className={styles.backButton} onClick={closeView}>
            ← Back to Dashboard
          </button>
          <h2>Secondary Recyclers Management</h2>
          <button
            className={styles.addButton}
            onClick={() => {
              setSelectedItem(null);
              setModalType("addSecondary");
            }}
          >
            + Add Secondary Recycler
          </button>
        </div>

        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search secondary recyclers..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.grid}>
          {filteredSecondaryRecyclers.map((recycler) => (
            <div key={recycler.id} className={styles.recyclerCard}>
              <div className={styles.recyclerHeader}>
                {recycler.riderImageUrl ? (
                  <img
                    src={recycler.riderImageUrl}
                    alt={`${recycler.firstName} ${recycler.LastName}`}
                    className={styles.avatar}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {recycler.firstName?.charAt(0) || "?"}
                    {recycler.LastName?.charAt(0) || ""}
                  </div>
                )}
                <div>
                  <h3>
                    {recycler.firstName || "Unknown"} {recycler.LastName || ""}
                  </h3>
                  <p className={styles.recyclerType}>Secondary Recycler</p>
                </div>
              </div>

              {recycler.wasteManagementInfo && (
                <div className={styles.companyInfo}>
                  <p>
                    <strong>Company:</strong>{" "}
                    {recycler.wasteManagementInfo.CompanyName || "N/A"}
                  </p>
                  <p>
                    <strong>Location:</strong>{" "}
                    {recycler.wasteManagementInfo.location || "N/A"}
                  </p>
                  <p>
                    <strong>Email:</strong> {recycler.email || "N/A"}
                  </p>
                </div>
              )}

              <div className={styles.recyclerActions}>
                <button
                  className={styles.viewButton}
                  onClick={() => openDetailsModal(recycler, "recyclerDetails")}
                >
                  Details
                </button>
                <button
                  className={styles.editButton}
                  onClick={() => {
                    setSelectedItem(recycler);
                    setModalType("editSecondary");
                  }}
                >
                  Edit
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleDelete("Recyclers", recycler.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredSecondaryRecyclers.length === 0 && (
          <div className={styles.noResults}>
            No secondary recyclers found.
          </div>
        )}

        {/* Modals */}
        {modalType && (
          <Modal
            onClose={() => {
              setModalType(null);
              setSelectedItem(null);
            }}
          >
            {(modalType === "editSecondary" || modalType === "addSecondary") && (
              <UserForm
                type="recycler"
                initialData={
                  modalType === "editSecondary" && selectedItem
                    ? selectedItem
                    : undefined
                }
                onSubmit={(data: any) =>
                  handleUpdate(
                    "Recyclers",
                    modalType === "editSecondary" && selectedItem
                      ? selectedItem.id
                      : Date.now().toString(),
                    data
                  )
                }
              />
            )}
            {modalType === "recyclerDetails" && selectedItem && (
              <div className={styles.detailsModal}>
                <h2>Secondary Recycler Details</h2>
                <div className={styles.detailsContent}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Name:</span>
                    <span>
                      {(selectedItem as Recycler).firstName || "N/A"} {(selectedItem as Recycler).LastName || ""}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Email:</span>
                    <span>{(selectedItem as Recycler).email || "N/A"}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Phone:</span>
                    <span>{getRecyclerPhone(selectedItem as Recycler)}</span>
                  </div>
                  {(selectedItem as Recycler).wasteManagementInfo && (
                    <>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Company:</span>
                        <span>
                          {(selectedItem as Recycler).wasteManagementInfo?.CompanyName || "N/A"}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Location:</span>
                        <span>
                          {(selectedItem as Recycler).wasteManagementInfo?.location || "N/A"}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Waste Categories:</span>
                        <span>
                          {getWasteCategory(selectedItem as Recycler)}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Waste Classifications:</span>
                        <span>
                          {getWasteClassification(selectedItem as Recycler)}
                        </span>
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

  // Render Tertiary Recyclers
  if (viewMode === "tertiary") {
    return (
      <div className={styles.dashboard}>
        <div className={styles.viewHeader}>
          <button className={styles.backButton} onClick={closeView}>
            ← Back to Dashboard
          </button>
          <h2>Tertiary Recyclers Management</h2>
          <button
            className={styles.addButton}
            onClick={() => {
              setSelectedItem(null);
              setModalType("addTertiary");
            }}
          >
            + Add Tertiary Recycler
          </button>
        </div>

        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search tertiary recyclers..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.grid}>
          {filteredTertiaryRecyclers.map((recycler) => (
            <div key={recycler.id} className={styles.recyclerCard}>
              <div className={styles.recyclerHeader}>
                {recycler.riderImageUrl ? (
                  <img
                    src={recycler.riderImageUrl}
                    alt={`${recycler.firstName} ${recycler.LastName}`}
                    className={styles.avatar}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {recycler.firstName?.charAt(0) || "?"}
                    {recycler.LastName?.charAt(0) || ""}
                  </div>
                )}
                <div>
                  <h3>
                    {recycler.firstName || "Unknown"} {recycler.LastName || ""}
                  </h3>
                  <p className={styles.recyclerType}>Tertiary Recycler</p>
                </div>
              </div>

              {recycler.wasteManagementInfo && (
                <div className={styles.companyInfo}>
                  <p>
                    <strong>Company:</strong>{" "}
                    {recycler.wasteManagementInfo.CompanyName || "N/A"}
                  </p>
                  <p>
                    <strong>Location:</strong>{" "}
                    {recycler.wasteManagementInfo.location || "N/A"}
                  </p>
                  <p>
                    <strong>Email:</strong> {recycler.email || "N/A"}
                  </p>
                </div>
              )}

              <div className={styles.recyclerActions}>
                <button
                  className={styles.viewButton}
                  onClick={() => openDetailsModal(recycler, "recyclerDetails")}
                >
                  Details
                </button>
                <button
                  className={styles.editButton}
                  onClick={() => {
                    setSelectedItem(recycler);
                    setModalType("editTertiary");
                  }}
                >
                  Edit
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleDelete("Recyclers", recycler.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredTertiaryRecyclers.length === 0 && (
          <div className={styles.noResults}>No tertiary recyclers found.</div>
        )}

        {/* Modals */}
        {modalType && (
          <Modal
            onClose={() => {
              setModalType(null);
              setSelectedItem(null);
            }}
          >
            {(modalType === "editTertiary" || modalType === "addTertiary") && (
              <UserForm
                type="recycler"
                initialData={
                  modalType === "editTertiary" && selectedItem
                    ? selectedItem
                    : undefined
                }
                onSubmit={(data: any) =>
                  handleUpdate(
                    "Recyclers",
                    modalType === "editTertiary" && selectedItem
                      ? selectedItem.id
                      : Date.now().toString(),
                    data
                  )
                }
              />
            )}
            {modalType === "recyclerDetails" && selectedItem && (
              <div className={styles.detailsModal}>
                <h2>Tertiary Recycler Details</h2>
                <div className={styles.detailsContent}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Name:</span>
                    <span>
                      {(selectedItem as Recycler).firstName || "N/A"} {(selectedItem as Recycler).LastName || ""}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Email:</span>
                    <span>{(selectedItem as Recycler).email || "N/A"}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Phone:</span>
                    <span>{getRecyclerPhone(selectedItem as Recycler)}</span>
                  </div>
                  {(selectedItem as Recycler).wasteManagementInfo && (
                    <>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Company:</span>
                        <span>
                          {(selectedItem as Recycler).wasteManagementInfo?.CompanyName || "N/A"}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Location:</span>
                        <span>
                          {(selectedItem as Recycler).wasteManagementInfo?.location || "N/A"}
                        </span>
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

  return null;
}