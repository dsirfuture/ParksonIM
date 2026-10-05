export type PosDemoProduct = {
  id: string;
  barcode: string;
  clave: string;
  name_cn: string;
  name_es: string;
  spec: string;
  price: number;
  stock: number;
  allowDiscount: boolean;
  active: boolean;
};

export const POS_DEMO_PRODUCTS: PosDemoProduct[] = [
  {
    id: "p1",
    barcode: "6925103000037",
    clave: "DST-300003",
    name_cn: "套皮开窗油瓶 500ml",
    name_es: "BOTELLA DE ACEITE",
    spec: "500ML",
    price: 30,
    stock: 48,
    allowDiscount: true,
    active: true,
  },
  {
    id: "p2",
    barcode: "6925103000044",
    clave: "DST-300004",
    name_cn: "套皮油瓶 200ml",
    name_es: "BOTELLA DE ACEITE",
    spec: "200ML",
    price: 23,
    stock: 80,
    allowDiscount: true,
    active: true,
  },
  {
    id: "p3",
    barcode: "6925103000051",
    clave: "DST-300005",
    name_cn: "套皮油瓶 300ml",
    name_es: "BOTELLA DE ACEITE",
    spec: "300ML",
    price: 23,
    stock: 48,
    allowDiscount: true,
    active: true,
  },
  {
    id: "p4",
    barcode: "6352829000858",
    clave: "WY-900085",
    name_cn: "2006小熊二格不锈钢饭盒 21.5*15.5cm",
    name_es: "LONCHERA",
    spec: "21.5*15.5CM",
    price: 65,
    stock: 60,
    allowDiscount: true,
    active: true,
  },
  {
    id: "p5",
    barcode: "7501206680011",
    clave: "POS-100011",
    name_cn: "陶瓷杯 450ml",
    name_es: "TAZA CERAMICA",
    spec: "450ML",
    price: 39,
    stock: 26,
    allowDiscount: true,
    active: true,
  },
  {
    id: "p6",
    barcode: "7501206680012",
    clave: "POS-100012",
    name_cn: "儿童水杯 350ml",
    name_es: "VASO INFANTIL",
    spec: "350ML",
    price: 28,
    stock: 12,
    allowDiscount: false,
    active: true,
  },
  {
    id: "p7",
    barcode: "7501206680013",
    clave: "POS-100013",
    name_cn: "厨房收纳盒",
    name_es: "CAJA ORGANIZADORA",
    spec: "M",
    price: 52,
    stock: 18,
    allowDiscount: true,
    active: true,
  },
  {
    id: "p8",
    barcode: "7501206680014",
    clave: "POS-100014",
    name_cn: "塑料脸盆",
    name_es: "PALANGANA",
    spec: "32CM",
    price: 24,
    stock: 9,
    allowDiscount: true,
    active: true,
  },
];

export const POS_DEMO_CASHIER = "CAJERO 01";
