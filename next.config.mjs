/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Images are plain <img> tags backed by local /uploads paths or
    // (legacy) full http(s) URLs, not next/image — no remote host
    // allowlist is needed either way. See lib/uploads/save-images.ts.
    remotePatterns: [],
  },
  experimental: {
    serverActions: {
      // Product/listing/auction forms can post up to 6 image files at
      // 4MB each (see lib/uploads/save-images.ts's MAX_IMAGES_PER_PRODUCT
      // / MAX_IMAGE_BYTES) plus the rest of the form fields, so this needs
      // headroom above the raw 24MB worst case for multipart overhead.
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
