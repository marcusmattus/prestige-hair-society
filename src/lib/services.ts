export type Service = {
  id: string;
  category: string;
  name: string;
  price: number;
  deposit: number;
  duration: number;
};

const rows: Array<[string, Array<[string, number, number?]>]> = [
  ["Colours, Bleach & Tone", [["Add-on: Toner",35],["Full Head Bleach & Tone",170,180],["Half Head Highlights",140,150],["Full Head Colour",70,120],["Root Colour",40,90]]],
  ["Natural Hair", [["Signature Stretch only",35,60],["Men’s Stretch & 8 Cornrows",80,150],["Men’s Stretch & 6 Cornrows",70,120],["Men’s Stretch & 4 Cornrows",60,100],["Wash & Blow-dry — Long, thick hair",70,90],["Signature Stretch & Trim",38,75],["Signature Stretch & Cut",48,90],["Wash & Blow-dry — Short hair",55,60],["Wash & Blow-dry — Medium hair",60,75]]],
  ["Treatments", [["Scalp Therapy Steam Treatment",48,60],["Olaplex Rebuilding Treatment",45,60],["Bixo Pilixin Hair Activation Treatment",28,45],["Hydration Nano Steam",38,45],["Bond Building Nano Steam",40,45],["Pre-scalp Detox & Hair Cleanse",45,60],["Moisture & Protein Mix Nano Steam",40,45],["Protein Nano Steam",35,45],["Post Texture Release Hydration Treatment",35,45]]],
  ["Brazilian Keratin Blow-dry", [["Keratin Blow-dry — Long, thick hair",250,210],["Keratin Blow-dry — Medium-length hair",230,180],["Keratin Blow-dry — Short, fine hair",210,150],["Partial Hairline Keratin Blow-dry",150,90],["New Client Consultation",10,30]]],
  ["Relaxers — Affirm Only", [["Relaxer & Cut",140,150],["Corrective Relaxer",18,60],["Wash, Blow-dry & Trim — Short",80,90],["Wash, Finish & Trim — Medium",90,100],["Wash, Finish & Trim — Long",100,120],["Virgin Relaxer & Trim",155,180],["Virgin Relaxer & Cut",170,195],["Wash & Finish Pixie",55,60],["Wash & Finish — Long hair",75,90],["Wash & Finish — Medium hair",70,75],["Wash & Finish — Short hair",60,60],["Texturiser & Trim",145,150],["Relaxer Retouch & Trim",135,135]]],
  ["Weaves & Extensions", [["Remove Wig Braids",20,30],["Wig Braids",30,60],["Half Head Weave",100,150],["Half Wig Pinned & Styled",90,120],["Tape-ins — Consultation only",10,30],["Tracks per row",20,30],["Clip-ins",40,60],["Weave Wash & Style",80,90],["Leave-out Weave",180,210],["Flip-over Weave",155,180]]],
  ["Texture Release", [["Virgin Texture Release Treatment — Long, thick hair",260,240],["Virgin Texture Release Treatment — Medium",202,210],["Follow-up Texture Release — Medium hair",200,180],["Follow-up Texture Release — Short, fine hair",180,150],["Follow-up Texture Release — Long, thick hair",220,210]]],
  ["Silk Press", [["Silk Press — Short hair",70,75],["Silk Press — Medium hair",80,90],["Silk Press — Long, thick hair",100,120]]],
  ["European Hair", [["Wash, Blow-dry & Finish",85,90]]],
  ["Consultations", [["Keratin Straightening",10,30],["Hair Loss & Regeneration",40,45],["Extensive Hair Consultation",60,60],["Healthy Hair & Scalp Consultation",20,30],["New Client Consultation",10,30]]],
  ["Bixo Pilixin Hair Activation", [["Bixo Pilixin Hair Activation Treatment — Women",70,75],["Bixo Pilixin Hair Activation Treatment — Men",75,75]]],
  ["Locs", [["Locs Wash, Retwist & Style — Long",205,240],["Locs Wash, Retwist & Style — Medium",190,210],["Locs Wash, Retwist & Style — Short",170,180],["Starter Locs",350,300]]],
  ["Braid Take-down", [["Add-on Trim",20,30],["Micro Braid Take-down, Shampoo & Blow-out",160,240],["Medium Braid Take-down, Shampoo & Blow-out",100,180],["Small Braids Take-down, Shampoo & Blow-out",125,210]]],
  ["Miracle Knots", [["Miracle Knots — Waist Length",310,300],["Miracle Knots — Bra Strap Length",245,270],["Miracle Knots — Shoulder Length",200,240]]]
];

function slug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function depositFor(price: number) {
  // A 50% deposit on every booking, rounded to the nearest pound.
  return Math.round(price * 0.5);
}

export const SERVICES: Service[] = rows.flatMap(([category, items]) =>
  items.map(([name, price, duration = 60], index) => ({
    id: `${slug(category)}-${slug(name)}-${index}`,
    category,
    name,
    price,
    deposit: Math.min(price, depositFor(price)),
    duration,
  })),
);

export const CATEGORIES = rows.map(([category]) => category);
export const TIMES = ["09:00", "10:00", "11:30", "13:00", "14:30", "16:00", "17:30"];

export function findService(id: string) {
  return SERVICES.find((service) => service.id === id);
}

export function pounds(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(value);
}
