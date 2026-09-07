const BOOKING_URL = "https://frohub.com/partner/prestige-hair-society/";

const catalogue = [
  { category: "Colours, Bleach & Tone", services: [
    ["Add-on: Toner", 35], ["Full Head Bleach & Tone", 170], ["Half Head Highlights", 140], ["Full Head Colour", 70], ["Root Colour", 40],
  ]},
  { category: "Natural Hair", services: [
    ["Signature Stretch only", 35], ["Men’s Stretch & 8 Cornrows", 80], ["Men’s Stretch & 6 Cornrows", 70], ["Men’s Stretch & 4 Cornrows", 60], ["Wash & Blow-dry — Long, thick hair", 70], ["Signature Stretch & Trim", 38], ["Signature Stretch & Cut", 48], ["Wash & Blow-dry — Short hair", 55], ["Wash & Blow-dry — Medium hair", 60],
  ]},
  { category: "Treatments", services: [
    ["Scalp Therapy Steam Treatment", 48], ["Olaplex Rebuilding Treatment", 45], ["Bixo Pilixin Hair Activation Treatment", 28], ["Hydration Nano Steam", 38], ["Bond Building Nano Steam", 40], ["Pre-scalp Detox & Hair Cleanse", 45], ["Moisture & Protein Mix Nano Steam", 40], ["Protein Nano Steam", 35], ["Post Texture Release Hydration Treatment", 35],
  ]},
  { category: "Brazilian Keratin Blow-dry", services: [
    ["Keratin Blow-dry — Long, thick hair", 250], ["Keratin Blow-dry — Medium-length hair", 230], ["Keratin Blow-dry — Short, fine hair", 210], ["Partial Hairline Keratin Blow-dry", 150], ["New Client Consultation", 10],
  ]},
  { category: "Relaxers — Affirm Only", services: [
    ["Relaxer & Cut", 140], ["Corrective Relaxer", 18], ["Wash, Blow-dry & Trim — Short", 80], ["Wash, Finish & Trim — Medium", 90], ["Wash, Finish & Trim — Long", 100], ["Virgin Relaxer & Trim", 155], ["Virgin Relaxer & Cut", 170], ["Wash & Finish Pixie", 55], ["Wash & Finish — Long hair", 75], ["Wash & Finish — Medium hair", 70], ["Wash & Finish — Short hair", 60], ["Texturiser & Trim", 145], ["Relaxer Retouch & Trim", 135],
  ]},
  { category: "Weaves & Extensions", services: [
    ["Remove Wig Braids", 20], ["Wig Braids", 30], ["Half Head Weave", 100], ["Half Wig Pinned & Styled", 90], ["Tape-ins — Consultation only", 10], ["Tracks per row", 20], ["Clip-ins", 40], ["Weave Wash & Style", 80], ["Leave-out Weave", 180], ["Flip-over Weave", 155],
  ]},
  { category: "Texture Release", services: [
    ["Virgin Texture Release Treatment — Long, thick hair", 260], ["Virgin Texture Release Treatment — Medium", 202], ["Follow-up Texture Release — Medium hair", 200], ["Follow-up Texture Release — Short, fine hair", 180], ["Follow-up Texture Release — Long, thick hair", 220],
  ]},
  { category: "Silk Press", services: [
    ["Silk Press — Short hair", 70], ["Silk Press — Medium hair", 80], ["Silk Press — Long, thick hair", 100],
  ]},
  { category: "European Hair", services: [["Wash, Blow-dry & Finish", 85]] },
  { category: "Consultations", services: [
    ["Keratin Straightening", 10], ["Hair Loss & Regeneration", 40], ["Extensive Hair Consultation", 60], ["Healthy Hair & Scalp Consultation", 20], ["New Client Consultation", 10],
  ]},
  { category: "Bixo Pilixin Hair Activation", services: [
    ["Bixo Pilixin Hair Activation Treatment — Women", 70], ["Bixo Pilixin Hair Activation Treatment — Men", 75],
  ]},
  { category: "Locs", services: [
    ["Locs Wash, Retwist & Style — Long", 205], ["Locs Wash, Retwist & Style — Medium", 190], ["Locs Wash, Retwist & Style — Short", 170], ["Starter Locs", 350],
  ]},
  { category: "Braid Take-down", services: [
    ["Add-on Trim", 20], ["Micro Braid Take-down, Shampoo & Blow-out", 160], ["Medium Braid Take-down, Shampoo & Blow-out", 100], ["Small Braids Take-down, Shampoo & Blow-out", 125],
  ]},
  { category: "Miracle Knots", services: [
    ["Miracle Knots — Waist Length", 310], ["Miracle Knots — Bra Strap Length", 245], ["Miracle Knots — Shoulder Length", 200],
  ]},
];

const search = document.querySelector("#service-search");
const filters = document.querySelector("#category-filters");
const results = document.querySelector("#service-results");
const empty = document.querySelector("#empty-state");
let activeCategory = "All services";

const normalise = (value) => value.toLocaleLowerCase("en-GB").replace(/[’']/g, "");
const formatPrice = (value) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(value);

function makeFilter(label) {
  const button = document.createElement("button");
  button.className = "category-button";
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-pressed", String(label === activeCategory));
  button.addEventListener("click", () => {
    activeCategory = label;
    filters.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    renderCatalogue();
  });
  return button;
}

function renderCatalogue() {
  const query = normalise(search.value.trim());
  const visible = catalogue
    .filter((group) => activeCategory === "All services" || group.category === activeCategory)
    .map((group) => ({
      ...group,
      services: group.services.filter(([name]) => normalise(`${group.category} ${name}`).includes(query)),
    }))
    .filter((group) => group.services.length);

  results.replaceChildren();
  visible.forEach((group) => {
    const section = document.createElement("section");
    section.className = "service-group";
    const heading = document.createElement("h3");
    heading.textContent = group.category;
    const list = document.createElement("ul");
    list.className = "service-list";
    group.services.forEach(([name, price]) => {
      const row = document.createElement("li");
      row.className = "service-row";
      const serviceName = document.createElement("span");
      serviceName.textContent = name;
      const servicePrice = document.createElement("span");
      servicePrice.className = "service-price";
      servicePrice.textContent = formatPrice(price);
      row.append(serviceName, servicePrice);
      list.append(row);
    });
    section.append(heading, list);
    results.append(section);
  });
  empty.hidden = visible.length > 0;
}

filters.append(makeFilter("All services"), ...catalogue.map((group) => makeFilter(group.category)));
search.addEventListener("input", renderCatalogue);
renderCatalogue();

const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector("#site-nav");
menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.textContent = open ? "Close" : "Menu";
  nav.classList.toggle("open", open);
});
nav.addEventListener("click", () => {
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.textContent = "Menu";
  nav.classList.remove("open");
});
