// lib/brand.ts
export const BRAND = {
  name: "ParksonMX",
  companyLegal: "BS DU S.A. DE C.V.",
  colors: {
    primary: "#2f3c7e",
    accent: "#fbeaeb",
  },
  footer: (year = new Date().getFullYear(), version = "v1.0.0") => ({
    line1: `© ${year} BS DU S.A. DE C.V. 保留所有权利`,
    line2: `ParksonMX 验货平台 ${version}`,
  }),
};
