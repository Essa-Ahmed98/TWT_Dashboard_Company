export enum TargetType {
  All      = 0,
  Company  = 1,
  Campaign = 2,
  Group    = 3,
}

export enum MessageType {
  Text  = 0,
  Audio = 1,
  Image = 2,
}

export interface BroadcastRequest {
  Content:     string;
  TargetType:  TargetType;
  TargetId:    string;
  MessageType: MessageType;
  ImageUrl:    string | null;
  AudioUrl:    string | null;
}
