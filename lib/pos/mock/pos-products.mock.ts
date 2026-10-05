import { type PosProduct } from "@/lib/pos/types";

export const POS_MOCK_PRODUCTS: PosProduct[] = [
  {
    id: "p1",
    barcode: "6925103000037",
    clave: "DST-300003",
    nameCn: "套皮开窗油瓶 500ml",
    nameEs: "BOTELLA DE ACEITE",
    category: "调料瓶系列",
    subcategory: "油瓶",
    spec: "500ML",
    origin: "CHINA",
    importer: "PARKSONMX",
    shortDescription: "玻璃调味油瓶",
    price: 30,
    stock: 48,
    allowDiscount: true,
    active: true,
  },
  {
    id: "p2",
    barcode: "6925103000044",
    clave: "DST-300004",
    nameCn: "套皮油瓶 200ml",
    nameEs: "BOTELLA DE ACEITE",
    category: "调料瓶系列",
    subcategory: "油瓶",
    spec: "200ML",
    origin: "CHINA",
    importer: "PARKSONMX",
    shortDescription: "玻璃调味油瓶",
    price: 23,
    stock: 80,
    allowDiscount: true,
    active: true,
  },
  {
    id: "p3",
    barcode: "6925103000051",
    clave: "DST-300005",
    nameCn: "套皮油瓶 300ml",
    nameEs: "BOTELLA DE ACEITE",
    category: "调料瓶系列",
    subcategory: "油瓶",
    spec: "300ML",
    origin: "CHINA",
    importer: "PARKSONMX",
    shortDescription: "玻璃调味油瓶",
    price: 23,
    stock: 48,
    allowDiscount: true,
    active: true,
  },
  {
    id: "p4",
    barcode: "6352829000858",
    clave: "WY-900085",
    nameCn: "2006小熊二格不锈钢饭盒 21.5*15.5cm",
    nameEs: "LONCHERA",
    category: "便当盒系列",
    subcategory: "饭盒",
    spec: "21.5*15.5CM",
    origin: "CHINA",
    importer: "PARKSONMX",
    shortDescription: "双格不锈钢便当盒",
    price: 65,
    stock: 60,
    allowDiscount: true,
    active: true,
  },
  {
    id: "p5",
    barcode: "7501206680011",
    clave: "POS-100011",
    nameCn: "陶瓷杯 450ml",
    nameEs: "TAZA CERAMICA",
    category: "杯壶系列",
    subcategory: "杯子",
    spec: "450ML",
    origin: "CHINA",
    importer: "PARKSONMX",
    shortDescription: "高温烧制陶瓷杯",
    price: 39,
    stock: 26,
    allowDiscount: true,
    active: true,
  },
  {
    id: "p6",
    barcode: "7501206680012",
    clave: "POS-100012",
    nameCn: "儿童水杯 350ml",
    nameEs: "VASO INFANTIL",
    category: "杯壶系列",
    subcategory: "水杯",
    spec: "350ML",
    origin: "CHINA",
    importer: "PARKSONMX",
    shortDescription: "儿童吸管水杯",
    price: 28,
    stock: 12,
    allowDiscount: false,
    active: true,
  },
  {
    id: "p7",
    barcode: "7501206680013",
    clave: "POS-100013",
    nameCn: "厨房收纳盒",
    nameEs: "CAJA ORGANIZADORA",
    category: "各类建材",
    subcategory: "收纳",
    spec: "M",
    origin: "CHINA",
    importer: "PARKSONMX",
    shortDescription: "多用途厨房收纳盒",
    price: 52,
    stock: 18,
    allowDiscount: true,
    active: true,
  },
  {
    id: "p8",
    barcode: "7501206680014",
    clave: "POS-100014",
    nameCn: "塑料脸盆",
    nameEs: "PALANGANA",
    category: "各类建材",
    subcategory: "塑料用品",
    spec: "32CM",
    origin: "CHINA",
    importer: "PARKSONMX",
    shortDescription: "日用塑料脸盆",
    price: 24,
    stock: 9,
    allowDiscount: true,
    active: true,
  },
];

export function listProducts() {
  return POS_MOCK_PRODUCTS.map((item) => ({ ...item }));
}

export function searchProducts(query: { barcode?: string; clave?: string; name?: string }) {
  const barcode = query.barcode?.trim().toLowerCase() || "";
  const clave = query.clave?.trim().toLowerCase() || "";
  const name = query.name?.trim().toLowerCase() || "";
  return POS_MOCK_PRODUCTS.filter((product) => {
    if (!product.active) return false;
    const barcodeMatch = !barcode || product.barcode.toLowerCase().includes(barcode);
    const claveMatch = !clave || product.clave.toLowerCase().includes(clave);
    const nameMatch =
      !name
      || product.nameCn.toLowerCase().includes(name)
      || product.nameEs.toLowerCase().includes(name)
      || product.spec.toLowerCase().includes(name);
    return barcodeMatch && claveMatch && nameMatch;
  }).map((item) => ({ ...item }));
}

export function getProductByBarcode(barcode: string) {
  const value = barcode.trim().toLowerCase();
  const product = POS_MOCK_PRODUCTS.find((item) => item.barcode.toLowerCase() === value);
  return product ? { ...product } : null;
}

export function getProductByClave(clave: string) {
  const value = clave.trim().toLowerCase();
  const product = POS_MOCK_PRODUCTS.find((item) => item.clave.toLowerCase() === value);
  return product ? { ...product } : null;
}
