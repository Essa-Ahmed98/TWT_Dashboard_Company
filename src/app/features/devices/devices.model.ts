export interface DeviceItem {
  Id:          string;
  ImeiNumber:  string;
  SimNumber:   string;
  Notes:       string;
  UserId:      string;
  UserName:    string;
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
}

export interface UpdateDeviceConnectionRequest {
  Id:     string;
  UserId: string | null;
}

export interface PilgrimOption {
  Id:   string;
  Name: string;
}
