# ChatRooms

In this website you can create a private chat room and share data across multiple devices.

### Rooms are of two types:

Traditional Chatrooms
✅ Uses Firebase to store messages
and files
✅ Connect Multiple devices concurrently
✅ Messages history
✅ Auto delete all data after 15min
✅ Messages end-to-end encrypted (AES-GCM, the key is derived from the room code and never leaves your browser; uploaded files are not encrypted)

WebRTC based Chatrooms
✅ Uses WebRTC to transfer messages
and files
✅ Only 2 devices can connect a time
✅ No messages history
✅ End to end encrypted
✅ File transfers
✅ Video calls

## Tools / Libraries used:

- [Sveltekit](https://kit.svelte.dev/)
- [Tailwind](https://tailwindcss.com/)
- [Firebase & Firestore](https://firebase.google.com/)
- [Gsap](https://greensock.com/)
- [Cloudflare Pages](https://pages.cloudflare.com/) for Frontend (static build)
- [Firebase Functions](https://firebase.google.com/) for scheduled room cleanup
- [WebRTC](https://webrtc.org/)
- [Peer.js](https://github.com/peers/peerjs)
