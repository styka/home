interface CategoryRule {
  category: string;
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Warzywa i owoce",
    keywords: [
      "jabłko", "jabłka", "banan", "banany", "pomidor", "pomidory", "ogórek", "ogórki",
      "marchew", "marchewka", "ziemniak", "ziemniaki", "cebula", "czosnek", "sałata",
      "szpinak", "papryka", "cytryna", "limonka", "truskawk", "malina", "borówka",
      "gruszka", "śliwka", "mango", "awokado", "brokuł", "kalafior", "kapusta",
      "por", "seler", "pietruszka", "burak", "rzodkiewka", "koper", "bazylia",
      "natka", "winogrona", "ananas", "melon", "arbuz", "brzoskwinia", "morela",
      "apple", "banana", "tomato", "cucumber", "carrot", "potato", "onion",
      "garlic", "lettuce", "spinach", "pepper", "lemon", "lime", "strawberry",
      "raspberry", "blueberry", "pear", "plum", "mango", "avocado", "broccoli",
      "cauliflower", "cabbage", "leek", "celery", "parsley", "beet", "radish",
      "grape", "pineapple", "melon", "watermelon", "peach", "apricot", "cherry",
      "warzywa", "owoce", "fruit", "vegetable",
    ],
  },
  {
    category: "Nabiał i jaja",
    keywords: [
      "mleko", "śmietana", "śmietanka", "jogurt", "kefir", "maślanka", "twaróg",
      "serek", "masło", "ser", "żółty", "biały", "ricotta", "mozzarella", "parmezan",
      "feta", "brie", "camembert", "jajko", "jajka", "jaj",
      "milk", "butter", "cheese", "yogurt", "cream", "egg", "eggs", "sour cream",
      "whey", "quark",
    ],
  },
  {
    category: "Mięso i ryby",
    keywords: [
      "kurczak", "indyk", "wieprzowina", "wołowina", "łosoś", "tuńczyk",
      "dorsz", "krewetki", "kiełbasa", "parówki", "szynka", "boczek", "mięso",
      "mielone", "schab", "karkówka", "pierś", "udziec", "żeberka", "wątróbka",
      "pstrąg", "makrela", "sardynka", "halibut", "mintaj", "krab", "małże",
      "chicken", "turkey", "pork", "beef", "salmon", "tuna", "cod", "shrimp",
      "sausage", "ham", "bacon", "meat", "mince", "steak", "ribs", "liver",
      "trout", "mackerel", "sardine", "crab", "mussels", "fish",
    ],
  },
  {
    category: "Piekarnia",
    keywords: [
      "chleb", "bułka", "bułki", "bagietka", "croissant", "rogalik", "toast",
      "tortilla", "pita", "ciabatta", "żytni", "pszenny", "razowy", "tostowy",
      "bread", "roll", "baguette", "bun", "bagel", "muffin",
      "sourdough", "rye", "whole grain", "flatbread",
    ],
  },
  {
    category: "Suche produkty",
    keywords: [
      "makaron", "ryż", "kasza", "płatki", "mąka", "cukier", "sól", "pieprz",
      "gryczana", "jaglana", "owsianka", "musli", "granola", "soczewica", "fasola",
      "ciecierzyca", "groch", "quinoa", "bulgur", "kuskus", "polenta",
      "pasta", "spaghetti", "lasagne", "rice", "flour", "sugar", "salt", "oats",
      "lentil", "bean", "chickpea", "couscous", "cereal", "muesli",
    ],
  },
  {
    category: "Napoje",
    keywords: [
      "woda", "sok", "napój", "cola", "pepsi", "sprite", "piwo", "wino",
      "herbata", "kawa", "kakao", "kombucha", "energia", "energetyk", "lemoniada",
      "water", "juice", "beer", "wine", "tea", "coffee", "soda", "drink",
      "smoothie", "lemonade", "sparkling", "still", "energy",
    ],
  },
  {
    category: "Mrożone",
    keywords: [
      "mrożon", "lody", "zamrożon",
      "frozen", "ice cream", "gelato",
    ],
  },
  {
    category: "Przekąski i słodycze",
    keywords: [
      "chipsy", "paluszki", "orzeszki", "orzech", "migdał", "nerkowiec",
      "czekolada", "cukierek", "ciastko", "wafel", "batonik", "dżem", "miód",
      "nutella", "popcorn", "precle", "krakersy",
      "chips", "nut", "almond", "cashew", "chocolate", "candy", "cookie",
      "wafer", "bar", "jam", "honey", "pretzel", "cracker",
    ],
  },
  {
    category: "Przyprawy i oleje",
    keywords: [
      "ketchup", "musztarda", "majonez", "sos", "ocet", "oliwa", "olej",
      "sojowy", "tabasco", "sriracha", "hummus", "pesto", "sos rybny",
      "mustard", "mayonnaise", "sauce", "vinegar", "oil", "olive oil",
      "soy sauce", "hot sauce", "dressing",
    ],
  },
  {
    category: "Zioła i przyprawy",
    keywords: [
      "przyprawa", "ziele", "liść", "oregano", "tymianek", "rozmaryn",
      "kurkuma", "cynamon", "imbir", "papryka słodka", "ostra", "curry", "kminek",
      "spice", "herb", "thyme", "rosemary", "turmeric",
      "cinnamon", "ginger", "paprika", "cumin", "coriander",
    ],
  },
  {
    category: "Chemia i higiena",
    keywords: [
      "proszek", "płyn", "tabletki", "zmywarka", "pralka", "detergent",
      "szampon", "żel", "mydło", "pasta do zębów", "dezodorant", "papier toaletowy",
      "ręcznik papierowy", "worki", "folia", "gąbka", "ścierka", "wybielacz",
      "soap", "shampoo", "toothpaste", "deodorant", "toilet paper",
      "cleaner", "bleach", "sponge", "cloth", "bag", "foil", "laundry",
    ],
  },
  {
    category: "Konserwy i przetwory",
    keywords: [
      "konserwa", "puszka", "słoik", "marynata", "ogórki kiszone", "kapusta kiszona",
      "pasta pomidorowa", "przecier", "kompot",
      "canned", "tin", "jar", "preserve", "pickle", "tomato paste", "compote",
    ],
  },
  {
    category: "Inne",
    keywords: [],
  },
];

export function categorize(itemName: string): string {
  const normalized = itemName.toLowerCase().trim();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => normalized.includes(kw))) {
      return rule.category;
    }
  }
  return "Inne";
}
