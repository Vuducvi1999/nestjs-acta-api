# Socket Events for Avatar Posts

This document describes the WebSocket events emitted when avatar posts are created.

## Events Emitted

### `newPost` Event

**Description**: Standard event for any new post creation (including avatar posts)

**Event Name**: `newPost`

**Payload**: Standard `PostResponseDto` object

```typescript
{
  id: string;
  content: string;
  imageUrls: string[];
  videoUrls: string[];
  user: {
    id: string;
    fullName: string;
    referenceId: string;
    avatarUrl?: string;
    // ... other user fields
  };
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  isPublished: boolean;
  // ... other post fields
}
```

**Note**: Avatar posts use the same `newPost` event as regular posts. This ensures consistency with the existing post system and avoids duplicate socket handling logic.

## Implementation

Avatar posts are created using the existing `PostService.createPost()` method, which automatically handles:

- ✅ Socket event emission (`newPost`)
- ✅ Post validation and creation
- ✅ Auto-publishing for verified users
- ✅ Activity logging
- ✅ Cache management
- ✅ Error handling

## Frontend Integration

### React/Next.js Example

```typescript
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const usePostSocket = () => {
  useEffect(() => {
    const socket: Socket = io(process.env.NEXT_PUBLIC_API_URL);

    // Listen for all new posts (including avatar posts)
    socket.on('newPost', (post) => {
      console.log('New post created:', post);

      // Check if it's an avatar post by content or image URLs
      const isAvatarPost =
        post.content?.includes('ảnh đại diện') ||
        post.imageUrls?.some((url) => url === post.user.avatarUrl);

      if (isAvatarPost) {
        console.log('This is an avatar post!');
        // Handle avatar post specifically
      }

      // Update your posts state/cache
    });

    return () => {
      socket.disconnect();
    };
  }, []);
};
```

## Event Flow

1. **User Updates Avatar**

   ```
   PATCH /users/update-avatar
   ↓
   UserProfileService.updateUserAvatar()
   ↓
   AvatarPostService.createAvatarPost()
   ↓
   PostService.createPost() // Uses existing post service
   ↓
   Socket Event Emitted: newPost
   ```

2. **Frontend Response**
   ```
   Client receives newPost event
   ↓
   Updates posts list/cache
   ↓
   Shows real-time post in feed
   ```

## Benefits of This Approach

- ✅ **Consistency**: Uses the same event system as regular posts
- ✅ **Simplicity**: No duplicate socket handling logic
- ✅ **Reliability**: Leverages battle-tested PostService
- ✅ **Maintainability**: Single source of truth for post creation
- ✅ **Performance**: No additional socket events to handle

## Testing

### Backend Testing

```bash
# Update avatar to trigger post creation
curl -X PATCH http://localhost:3000/users/update-avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"avatarUrl": "https://example.com/new-avatar.jpg"}'
```

### Frontend Testing

```typescript
// Listen for events in browser console
const socket = io('http://localhost:3000');

socket.on('newPost', (data) => {
  console.log('New post event:', data);

  // Check if it's an avatar post
  if (data.content?.includes('ảnh đại diện')) {
    console.log('Avatar post detected!');
  }
});
```

## Logs to Monitor

Watch for these log messages:

```
✅ Success:
[UserProfileService] Avatar post created successfully for user {userId}: {postId}
[PostService] Post created successfully: {postId}

🔍 Debug:
[PostsGateway] WebSocket - Create Post: {postId}
```

This simplified approach ensures avatar posts integrate seamlessly with your existing post system while maintaining real-time synchronization across all clients.
