// types.ts - Complete updated Recycler interface

export interface WasteManagementInfo {
  CompanyName?: string;
  DirectorName?: string;
  WMSTYPE?: string;
  RecycleType?: string;  // Add this
  WasteCategory?: string | string[];  // Add this
  WasteClassification?: string | string[];
  detailsComp?: boolean;
  employees?: string;
  ghMobileNumber?: string;
  ghanaCardNumber?: string;
  gps?: string;
  landmark?: string;
  location?: string;
  compRegUrl?: string;
  logoUrl?: string;
  businessEmail?: string;
  businessWebsite?: string;
  businessImageUrl?: string;
  registrationImageUrl?: string;
  registrationNumber?: string;
  city?: string;
  district?: string;
  fullAddress?: string;
  nearestRoad?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  updatedAt?: number;
  [key: string]: any; // Allow for any additional properties
}

export interface Recycler {
  id: string;
  firstName?: string;
  LastName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;  // Add phoneNumber
  Password?: string;
  WMSTYPE?: string;
  WMSCATEGORY?: string;
  wmsCategory?: string;
  wmsType?: string;
  detailsComp?: boolean;
  detailsCompleted?: boolean;
  riderImageUrl?: string;
  token?: string;
  balance?: number;
  status?: string;
  createdAt?: string | number;
  userId?: string;
  newWMS?: any;
  wasteManagementInfo?: WasteManagementInfo;
  ratings?: Record<string, any>;
  transactions?: Record<string, any>;
  prices?: Record<string, any>;
  location?: string;  // Add location
  [key: string]: any; // Allow for any additional properties
}

export interface Client {
  id: string;
  firstName?: string;
  LastName?: string;
  email?: string;
  phoneNumber?: string;
  location?: string;
  SettlementType?: string;
  detailsComp?: boolean;
  dateOfBirth?: string;
  ghCardNo?: string;
  gpsAddress?: string;
  city?: string;
  district?: string;
  fullAddress?: string;
  nearestRoad?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
  userId?: string;
  userType?: string;
  createdAt?: number;
  [key: string]: any;
}

export interface WasteManagementRequest {
  id: string;
  client_name?: string;
  client_phone?: string;
  Client_id?: string;
  WMS_id?: string;
  WMS_name?: string;
  WMS_phone?: string;
  WMS_type?: string;
  category?: string;
  weight?: string;
  weight_kg?: number;
  calculated_price?: string;
  status?: string;
  created_at?: string;
  payment_method?: string;
  Client_address?: string;
  finalClient_address?: string;
  location?: string;
  imageUrl?: string;
  fares?: string;
  [key: string]: any;
}