/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose TURN server credentials to the browser for WebRTC P2P connectivity.
  // Configure these in your hosting environment (e.g. Vercel project settings):
  //   TURN_URLS       — comma-separated, e.g. "turn:turn.example.com:3478,turn:turn.example.com:3478?transport=tcp"
  //   TURN_USER       — username
  //   TURN_CREDENTIAL — password/secret
  env: {
    NEXT_PUBLIC_TURN_URLS: process.env.TURN_URLS ?? '',
    NEXT_PUBLIC_TURN_USER: process.env.TURN_USER ?? '',
    NEXT_PUBLIC_TURN_CREDENTIAL: process.env.TURN_CREDENTIAL ?? '',
  },
};

export default nextConfig;
