# ChatRooms

In this website you can create a private chat room and share data across multiple devices.

### Rooms are of two types:

Traditional Chatrooms
- ✅ Uses Firebase to store messages
and files
- ✅ Connect Multiple devices concurrently
- ✅ Messages history
- ✅ Auto delete all data after 15min
- ✅ Messages encrypted with a key derived from the room code
- ❌ End to end encrypted (anyone with the 6-character code can read the room, and files are not encrypted)

WebRTC based Chatrooms
- ✅ Uses WebRTC to transfer messages
and files
- ✅ Only 2 devices can connect a time
- ✅ No messages history
- ✅ End to end encrypted
- ✅ File transfers
- ✅ Video calls

## Tools / Libraries used:

- [Sveltekit](https://kit.svelte.dev/)
- [Tailwind](https://tailwindcss.com/)
- [Firebase & Firestore](https://firebase.google.com/)
- [Gsap](https://greensock.com/)
- [Vercel](https://vercel.com/) for Frontend
- [Firebase Functions](https://firebase.google.com/) for scheduled room cleanup
- [WebRTC](https://webrtc.org/)
- [Peer.js](https://github.com/peers/peerjs)
