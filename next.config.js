/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Avoid bundling massive local image folders into the runtime image.
  outputFileTracingExcludes: {
    "*": [
      "public/products/**/*",
      "public/supplier-logos/**/*",
      "tmp/**/*",
    ],
  },
};

module.exports = nextConfig;
