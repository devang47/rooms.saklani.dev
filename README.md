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

- [SvelteKit 3](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev/) (static build)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Firebase](https://firebase.google.com/) (Firestore, Storage, anonymous Auth, scheduled Functions)
- [Cloudflare Pages](https://pages.cloudflare.com/) for hosting
- [WebRTC](https://webrtc.org/) via [PeerJS](https://github.com/peers/peerjs)
- Web Crypto (AES-GCM + PBKDF2) for end-to-end encryption, no crypto library
- [Playwright](https://playwright.dev/) end-to-end tests against the Firebase emulators
