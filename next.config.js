/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Avoid bundling massive local image folders into serverless functions.
    outputFileTracingExcludes: {
      "*": [
        "public/products/**/*",
        "public/supplier-logos/**/*",
        "tmp/**/*",
      ],
    },
  },
};

module.exports = nextConfig;
