// types.ts
export interface WasteManagementRequest {
    id: string;
    Client_address: string;
    Client_id: string;
    WMS_id: string;
    WMS_location: {
      latitude: string;
      longitude: string;
    };
    WMS_name: string;
    WMS_phone: string;
    WMS_type: string;
    category: string;
    client_Coordinates: {
      latitude: string;
      longitude: string;
    };
    client_name: string;
    client_phone: string;
    created_at: string;
    dropoff: {
      latitude: string;
      longitude: string;
    };
    fares: string;
    finalClient_address: string;
    finalClient_coordinates: {
      latitude: string;
      longitude: string;
    };
    imageUrl: string;
    location: string;
    payment_method: string;
    pickup: {
      latitude: string;
      longitude: string;
    };
    status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
    weight: string;
  }
  
  export interface Recycler {
    id: string;
    LastName: string;
    Password?: string;
    WMSTYPE: string;
    detailsComp: boolean;
    email: string;
    firstName: string;
    CompanyName: string;
    employees: string;
    phone: string;
    riderImageUrl?: string;
    token?: string;
    wasteManagementInfo?: {
      CompanyName: string;
      DirectorName: string;
      WMSTYPE: string;
      compRegUrl?: string;
      detailsComp: boolean;
      employees: string;
      ghMobileNumber: string;
      ghanaCardNumber: string;
      gps: string;
      landmark: string;
      location: string;
      logoUrl?: string;
    };
  }
  
  export interface Client {
    id: string;
    dateOfBirth: string;
    LastName: string;
    firstName: string;

    detailsComp: boolean;
    ghCardNo: string;
    gpsAddress: string;
    location: string;
  }