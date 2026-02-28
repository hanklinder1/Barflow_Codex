export type Profile = {
  id?: string;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  premium: boolean;
};

export type Bar = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  tagline: string;
  vibeTags: string[];
  musicStyle: string;
  lineLevel: string;
  bestNights: string;
  friendsHere?: Array<{
    userId: string;
    displayName: string;
    username: string;
    avatar: string;
  }>;
};

export type Friend = {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  premium: boolean;
  checkIn: null | {
    barId: string;
    barName: string;
    updatedAt: string;
  };
};

export type Message = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  sentAt: string;
  readAt: string | null;
};

export type Nudge = {
  id: string;
  createdAt: string;
  sender: {
    userId: string;
    displayName: string;
    username: string;
    avatar: string;
  };
  bar: {
    id: string;
    name: string;
    vibeTags: string[];
  };
};
