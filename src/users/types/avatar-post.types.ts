import { AvatarPostType, AvatarUpdateReason } from '../constants/avatar-post.constants';

// Avatar update context
export interface AvatarUpdateContext {
  userId: string;
  oldAvatarUrl?: string | null;
  newAvatarUrl: string;
  originalFileName?: string;
  updateReason: AvatarUpdateReason;
  timestamp: Date;
}

// Avatar post creation options
export interface AvatarPostCreationOptions {
  postType: AvatarPostType;
  customMessage?: string;
  includeComparison?: boolean;
  autoPublish?: boolean;
  taggedUserIds?: string[];
  location?: {
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
}

// Avatar post creation result
export interface AvatarPostCreationResult {
  success: boolean;
  postId?: string;
  message?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

// Avatar post statistics
export interface AvatarPostStats {
  totalAvatarUpdates: number;
  postsCreated: number;
  postsSkipped: number;
  successRate: string;
  skipReasons: {
    tooFrequent: number;
    dailyLimitReached: number;
    userPreference: number;
    error: number;
  };
}

// User avatar post preferences
export interface UserAvatarPostPreferences {
  enabled: boolean;
  postType: AvatarPostType;
  autoPublish: boolean;
  includeComparison: boolean;
  customMessage?: string;
  notifyFollowers: boolean;
}

// Avatar post template data
export interface AvatarPostTemplateData {
  userName: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  isFirstAvatar: boolean;
  daysSinceLastUpdate?: number;
}

// Avatar post creation request
export interface CreateAvatarPostRequest {
  context: AvatarUpdateContext;
  options?: Partial<AvatarPostCreationOptions>;
  preferences?: Partial<UserAvatarPostPreferences>;
}

// Avatar update history entry
export interface AvatarUpdateHistoryEntry {
  id: string;
  userId: string;
  oldAvatarUrl?: string | null;
  newAvatarUrl: string;
  postCreated: boolean;
  postId?: string;
  updateReason: AvatarUpdateReason;
  createdAt: Date;
}
