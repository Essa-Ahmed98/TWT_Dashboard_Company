export interface DeviceItem {
  Id:          string;
  ImeiNumber:  string;
  SimNumber:   string;
  Notes:       string;
  UserId:      string | null;
  UserName:    string | null;
}

export interface DeviceForm {
  imeiNumber: string;
  simNumber:  string;
  notes:      string;
}

export interface CreateDeviceRequest {
  ImeiNumber: string;
  SimNumber:  string;
  Notes:      string;
}

export interface UpdateDeviceRequest {
  Id:         string;
  ImeiNumber: string;
  SimNumber:  string;
  Notes:      string;
  /** UpdateDeviceCommand maps every field onto the device - send the current link or it gets cleared */
  UserId:     string | null;
}

/** Result of POST Devices/upload (UploadDevicesResult) */
export interface UploadDevicesResult {
  TotalRows:    number;
  SuccessCount: number;
  Errors:       string[];
}

export interface UpdateDeviceConnectionRequest {
  Id:     string;
  UserId: string | null;
}

export interface PilgrimOption {
  Id:     string;
  UserId: string;
  Name:   string;
}
