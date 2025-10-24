export interface ReissueResponse {
  table_id: string;
  location_id: string | null;
  qr_token: string;
  signature: string;
  qr_url: string | null;
  issued_at: string;
}

export interface AdminQrFormState {
  tableId: string;
  adminToken: string;
}
