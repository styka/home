"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import type { CategoryWithUsage } from "@/actions/categories";
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories";

interface CategoryManagerProps {
  categories: CategoryWithUsage[];
}

// ~300 emoji with Polish + English keywords for search
const EMOJI_DATA: { emoji: string; keywords: string[] }[] = [
  // Warzywa i owoce
  { emoji: "🥕", keywords: ["marchew","carrot","warzywo","produce","vegetable"] },
  { emoji: "🍎", keywords: ["jabłko","apple","owoc","fruit","czerwony"] },
  { emoji: "🍊", keywords: ["pomarańcza","orange","cytrus","citrus"] },
  { emoji: "🍋", keywords: ["cytryna","lemon","limonka","cytrus"] },
  { emoji: "🍇", keywords: ["winogrona","grape","winogron","fruit"] },
  { emoji: "🍓", keywords: ["truskawka","strawberry","owoc","berry"] },
  { emoji: "🫐", keywords: ["borówka","blueberry","jagoda","berry"] },
  { emoji: "🍒", keywords: ["czereśnia","wisnia","cherry","owoc"] },
  { emoji: "🍑", keywords: ["brzoskwinia","peach","owoc","fruit"] },
  { emoji: "🥭", keywords: ["mango","fruit","owoc","tropikalny"] },
  { emoji: "🍍", keywords: ["ananas","pineapple","tropikalny"] },
  { emoji: "🥝", keywords: ["kiwi","fruit","owoc","zielony"] },
  { emoji: "🍅", keywords: ["pomidor","tomato","warzywo","czerwony"] },
  { emoji: "🫑", keywords: ["papryka","pepper","bell pepper","warzywo"] },
  { emoji: "🥦", keywords: ["brokuł","broccoli","warzywo","zielony"] },
  { emoji: "🥬", keywords: ["sałata","lettuce","liściowe","warzywo"] },
  { emoji: "🥒", keywords: ["ogórek","cucumber","warzywo","zielony"] },
  { emoji: "🌽", keywords: ["kukurydza","corn","warzywo","żółty"] },
  { emoji: "🥑", keywords: ["awokado","avocado","owoc","zielony"] },
  { emoji: "🧅", keywords: ["cebula","onion","warzywo"] },
  { emoji: "🧄", keywords: ["czosnek","garlic","warzywo","przyprawa"] },
  { emoji: "🥔", keywords: ["ziemniak","potato","warzywo","skrobia"] },
  { emoji: "🍠", keywords: ["bataty","sweet potato","warzywo"] },
  { emoji: "🌶️", keywords: ["chili","pepper","ostra","spicy","przyprawa"] },
  { emoji: "🫘", keywords: ["fasola","bean","groch","rośliny strączkowe"] },
  { emoji: "🥜", keywords: ["orzeszki","peanut","orzech","nut"] },
  { emoji: "🌰", keywords: ["kasztan","chestnut","orzech","nut"] },
  { emoji: "🍄", keywords: ["grzyb","mushroom","warzywo","las"] },
  { emoji: "🫚", keywords: ["oliwa","olive oil","olej","tłuszcz","condiment"] },
  // Pieczywo i zboża
  { emoji: "🍞", keywords: ["chleb","bread","pieczywo","bakery","pszenny"] },
  { emoji: "🥖", keywords: ["bagietka","baguette","pieczywo","french"] },
  { emoji: "🥐", keywords: ["rogalik","croissant","pieczywo","masło"] },
  { emoji: "🧁", keywords: ["babeczka","cupcake","ciasto","słodycze","sweet"] },
  { emoji: "🎂", keywords: ["tort","cake","ciasto","urodziny","birthday"] },
  { emoji: "🍰", keywords: ["ciasto","cake","deser","sweet","słodki"] },
  { emoji: "🥧", keywords: ["ciasto","pie","tarta","deser"] },
  { emoji: "🍩", keywords: ["donut","pączek","słodycze","sweet"] },
  { emoji: "🍪", keywords: ["ciastko","cookie","herbatnik","słodycze"] },
  { emoji: "🥨", keywords: ["precel","pretzel","przekąska","snack"] },
  { emoji: "🥞", keywords: ["naleśnik","pancake","śniadanie","breakfast"] },
  { emoji: "🧇", keywords: ["gofr","waffle","śniadanie","breakfast"] },
  // Nabiał i jajka
  { emoji: "🧀", keywords: ["ser","cheese","nabiał","dairy","żółty"] },
  { emoji: "🥛", keywords: ["mleko","milk","nabiał","dairy","biały"] },
  { emoji: "🫙", keywords: ["słoik","jar","jogurt","śmietana","kondyment","condiment"] },
  { emoji: "🧈", keywords: ["masło","butter","nabiał","dairy"] },
  { emoji: "🥚", keywords: ["jajko","egg","nabiał","śniadanie","breakfast"] },
  { emoji: "🍳", keywords: ["jajko","egg","smażone","fried","patelnia"] },
  // Mięso i ryby
  { emoji: "🥩", keywords: ["mięso","meat","beef","wołowina","steak"] },
  { emoji: "🍗", keywords: ["kurczak","chicken","drób","poultry","noga"] },
  { emoji: "🍖", keywords: ["żeberka","ribs","mięso","meat","kość"] },
  { emoji: "🥓", keywords: ["boczek","bacon","wieprzowina","pork","wędlina"] },
  { emoji: "🌭", keywords: ["hot dog","parówka","kiełbasa","sausage","wurst"] },
  { emoji: "🍔", keywords: ["burger","hamburguer","mięso","fast food"] },
  { emoji: "🐟", keywords: ["ryba","fish","łosoś","owoce morza","seafood"] },
  { emoji: "🦐", keywords: ["krewetki","shrimp","prawns","owoce morza","seafood"] },
  { emoji: "🦑", keywords: ["kałamarnica","squid","owoce morza","seafood"] },
  { emoji: "🦀", keywords: ["krab","crab","owoce morza","seafood"] },
  { emoji: "🦞", keywords: ["homar","lobster","owoce morza","seafood"] },
  { emoji: "🐠", keywords: ["ryba","fish","tropikalna","owoce morza"] },
  // Napoje
  { emoji: "🍺", keywords: ["piwo","beer","alkohol","drinks","napój"] },
  { emoji: "🍻", keywords: ["piwo","beer","toast","napój","drinks"] },
  { emoji: "🍷", keywords: ["wino","wine","czerwone","alkohol","drinks"] },
  { emoji: "🥂", keywords: ["szampan","champagne","prosecco","alkohol"] },
  { emoji: "🍸", keywords: ["koktajl","cocktail","drink","alkohol"] },
  { emoji: "🍹", keywords: ["koktajl","tropical drink","sok","juice"] },
  { emoji: "🧉", keywords: ["maté","yerba","herbata","drink","napój"] },
  { emoji: "🥤", keywords: ["sok","juice","cola","napój","drink","smoothie"] },
  { emoji: "🧋", keywords: ["bubble tea","herbata","mleczna","drink"] },
  { emoji: "☕", keywords: ["kawa","coffee","espresso","cappuccino","napój"] },
  { emoji: "🫖", keywords: ["herbata","tea","czajnik","napój"] },
  { emoji: "🧃", keywords: ["sok","juice","karton","dziecięcy","napój"] },
  { emoji: "💧", keywords: ["woda","water","mineralna","napój","hydratacja"] },
  { emoji: "🍵", keywords: ["herbata","tea","matcha","zielona","napój"] },
  // Przekąski i słodycze
  { emoji: "🍫", keywords: ["czekolada","chocolate","słodycze","sweet","kakao"] },
  { emoji: "🍬", keywords: ["cukierek","candy","słodycze","sweet","cukier"] },
  { emoji: "🍭", keywords: ["lizak","lollipop","cukierek","słodycze"] },
  { emoji: "🍮", keywords: ["budyń","pudding","deser","dessert","słodki"] },
  { emoji: "🍯", keywords: ["miód","honey","naturalny","słodki","pszczoła"] },
  { emoji: "🍿", keywords: ["popcorn","przekąska","snack","kinowy","corn"] },
  { emoji: "🧆", keywords: ["falafel","ciecierzyca","przekąska","snack"] },
  { emoji: "🥨", keywords: ["precel","pretzel","solony","snack","przekąska"] },
  { emoji: "🧂", keywords: ["sól","salt","przyprawa","spice","solony"] },
  { emoji: "🍡", keywords: ["mochi","dango","słodycze","azjatyckie","snack"] },
  { emoji: "🍢", keywords: ["oden","japońskie","przekąska","snack"] },
  // Dania i fast food
  { emoji: "🍕", keywords: ["pizza","włoska","fast food","ser","pomidor"] },
  { emoji: "🌮", keywords: ["taco","meksykańskie","fast food","tortilla"] },
  { emoji: "🌯", keywords: ["wrap","tortilla","kanapka","sandwich"] },
  { emoji: "🥙", keywords: ["gyros","wrap","kebab","mięso","fast food"] },
  { emoji: "🥗", keywords: ["sałatka","salad","zdrowe","healthy","warzywa"] },
  { emoji: "🍲", keywords: ["zupa","stew","gulasz","garnek","obiad"] },
  { emoji: "🫕", keywords: ["fondue","garnek","obiad","gotowane"] },
  { emoji: "🥘", keywords: ["paella","gulasz","ryż","obiad","danie"] },
  { emoji: "🍜", keywords: ["ramen","makaron","zupa","azjatyckie","noodle"] },
  { emoji: "🍝", keywords: ["spaghetti","pasta","makaron","włoskie","bolognese"] },
  { emoji: "🍛", keywords: ["curry","ryż","indyjskie","ostre","obiad"] },
  { emoji: "🍣", keywords: ["sushi","ryba","japoński","ryż","owoce morza"] },
  { emoji: "🍱", keywords: ["bento","lunch box","japoński","obiad","pudełko"] },
  { emoji: "🥫", keywords: ["konserwa","puszka","can","preserved","warzywa"] },
  // Przyprawy i oleje
  { emoji: "🌿", keywords: ["zioła","herbs","świeże","basil","bazylia","pietruszka"] },
  { emoji: "🫛", keywords: ["groszek","pea","strączek","zielony","warzywo"] },
  { emoji: "🧁", keywords: ["posypka","sprinkles","dekoracja","ciasto","sweet"] },
  // Chemia i higiena
  { emoji: "🧴", keywords: ["szampon","płyn","kosmetyk","hygiene","cleaning","krem"] },
  { emoji: "🧼", keywords: ["mydło","soap","hygiene","czystość","cleaning"] },
  { emoji: "🪥", keywords: ["szczoteczka","toothbrush","zęby","hygiene","dental"] },
  { emoji: "🧻", keywords: ["papier toaletowy","toilet paper","chusteczki","hygiene"] },
  { emoji: "🪒", keywords: ["maszynka","razor","golenie","shave","hygiene"] },
  { emoji: "💊", keywords: ["lek","medicine","tabletka","pill","zdrowie","health"] },
  { emoji: "🩺", keywords: ["lekarz","doctor","zdrowie","health","medycyna"] },
  { emoji: "🩹", keywords: ["plaster","bandage","apteczka","first aid","zdrowie"] },
  { emoji: "🧪", keywords: ["laboratorium","chemistry","test","zdrowie","supplement"] },
  { emoji: "🪣", keywords: ["wiadro","bucket","cleaning","sprzątanie"] },
  { emoji: "🧹", keywords: ["miotła","broom","sprzątanie","cleaning","sweep"] },
  { emoji: "🧺", keywords: ["kosz","basket","pranie","laundry","cleaning"] },
  { emoji: "🪤", keywords: ["pułapka","trap","dom","mouse trap","gryzonie"] },
  { emoji: "🫧", keywords: ["bąbelki","bubbles","płyn","cleaning","mycie"] },
  // Dom i kuchnia
  { emoji: "🏠", keywords: ["dom","house","home","mieszkanie","budynek"] },
  { emoji: "🛒", keywords: ["koszyk","shopping cart","zakupy","sklep","store"] },
  { emoji: "🍽️", keywords: ["talerz","plate","obiad","danie","naczynia"] },
  { emoji: "🥄", keywords: ["łyżka","spoon","sztućce","kuchnia","gotowanie"] },
  { emoji: "🍴", keywords: ["sztućce","cutlery","widelec","nóż","fork"] },
  { emoji: "🔪", keywords: ["nóż","knife","kuchenny","kuchnia","gotowanie"] },
  { emoji: "🫙", keywords: ["słoik","jar","przetwory","przechowywanie"] },
  { emoji: "🧊", keywords: ["lód","ice","mrożone","frozen","zimne","kostka"] },
  { emoji: "🪴", keywords: ["roślina","plant","doniczkowa","kwiat","ogród"] },
  { emoji: "🌱", keywords: ["sadzonka","seedling","roślina","kiełkować","ogród"] },
  { emoji: "🌷", keywords: ["tulipan","tulip","kwiat","flower","ogród","prezent"] },
  { emoji: "🌸", keywords: ["kwiat","blossom","cherry","wiosna","spring"] },
  { emoji: "💐", keywords: ["bukiet","bouquet","kwiaty","flowers","prezent"] },
  // Transport i motoryzacja
  { emoji: "🚗", keywords: ["auto","car","samochód","transport","jeżdżenie"] },
  { emoji: "⛽", keywords: ["benzyna","fuel","paliwo","stacja","gas"] },
  { emoji: "🛞", keywords: ["opona","tire","tyre","koło","auto","samochód"] },
  { emoji: "🔧", keywords: ["klucz","wrench","naprawa","repair","narzędzie"] },
  { emoji: "🚲", keywords: ["rower","bike","bicycle","transport","sport"] },
  { emoji: "🛵", keywords: ["skuter","scooter","motor","transport"] },
  { emoji: "✈️", keywords: ["samolot","airplane","podróż","travel","lot"] },
  // Sport i aktywność
  { emoji: "⚽", keywords: ["piłka","football","soccer","sport","kopanie"] },
  { emoji: "🏋️", keywords: ["siłownia","gym","sport","trening","fitness"] },
  { emoji: "🏃", keywords: ["bieganie","running","sport","jogging","trening"] },
  { emoji: "🧘", keywords: ["joga","yoga","medytacja","relaks","sport"] },
  { emoji: "🎾", keywords: ["tenis","tennis","sport","rakieta","piłka"] },
  { emoji: "🏊", keywords: ["pływanie","swimming","sport","basen","woda"] },
  // Elektronika i narzędzia
  { emoji: "💡", keywords: ["żarówka","bulb","light","elektryczny","dom"] },
  { emoji: "🔋", keywords: ["bateria","battery","elektryczny","ładowanie"] },
  { emoji: "🖨️", keywords: ["drukarka","printer","atrament","tusz","biuro"] },
  { emoji: "📱", keywords: ["telefon","phone","mobile","smartfon","elektronika"] },
  { emoji: "💻", keywords: ["laptop","komputer","elektronika","praca","computer"] },
  { emoji: "🖥️", keywords: ["monitor","komputer","elektronika","desktop"] },
  { emoji: "🎮", keywords: ["gry","games","konsola","rozrywka","controller"] },
  { emoji: "📸", keywords: ["aparat","camera","zdjęcia","foto","photography"] },
  // Dzieci i zabawki
  { emoji: "🧸", keywords: ["miś","teddy","zabawka","toy","dziecko","baby"] },
  { emoji: "🍼", keywords: ["butelka","bottle","dziecko","baby","niemowlę"] },
  { emoji: "🧷", keywords: ["agrafka","pin","dziecko","baby","pieluszka","diaper"] },
  { emoji: "🪀", keywords: ["jojo","yoyo","zabawka","toy","dziecko"] },
  { emoji: "🎈", keywords: ["balon","balloon","urodziny","birthday","impreza"] },
  // Biuro i szkoła
  { emoji: "📚", keywords: ["książki","books","nauka","szkoła","education"] },
  { emoji: "✏️", keywords: ["ołówek","pencil","pisanie","szkoła","writing"] },
  { emoji: "📝", keywords: ["notatka","notes","lista","writing","memo"] },
  { emoji: "📦", keywords: ["pudełko","box","opakowanie","package","przesyłka"] },
  { emoji: "🗂️", keywords: ["teczka","folder","dokumenty","biuro","office"] },
  // Zwierzęta i karma
  { emoji: "🐾", keywords: ["łapy","paws","zwierzęta","pets","karma"] },
  { emoji: "🐶", keywords: ["pies","dog","zwierzę","pet","szczeniak"] },
  { emoji: "🐱", keywords: ["kot","cat","zwierzę","pet","kociak"] },
  { emoji: "🐰", keywords: ["królik","rabbit","bunny","zwierzę","pet"] },
  { emoji: "🐠", keywords: ["rybka","fish","akwarium","zwierzę","pet"] },
  { emoji: "🦜", keywords: ["papuga","parrot","ptak","zwierzę","pet"] },
  { emoji: "🦮", keywords: ["pies","guide dog","zwierzę","pet","karma"] },
  // Prezenty i okazje
  { emoji: "🎁", keywords: ["prezent","gift","opakowanie","urodziny","birthday"] },
  { emoji: "🎀", keywords: ["wstążka","ribbon","dekoracja","prezent","gift"] },
  { emoji: "🎉", keywords: ["impreza","party","konfetti","świętowanie","celebration"] },
  { emoji: "🎊", keywords: ["impreza","party","konfetti","sylwester","celebration"] },
  // Inne przydatne
  { emoji: "⚡", keywords: ["energia","energy","elektryczność","szybko","prąd"] },
  { emoji: "🔑", keywords: ["klucz","key","zamek","bezpieczeństwo","security"] },
  { emoji: "🪑", keywords: ["krzesło","chair","meble","furniture","dom"] },
  { emoji: "🛋️", keywords: ["sofa","couch","meble","furniture","salon"] },
  { emoji: "🛏️", keywords: ["łóżko","bed","sypialnia","bedroom","meble"] },
  { emoji: "🚿", keywords: ["prysznic","shower","łazienka","bathroom","kąpiel"] },
  { emoji: "🛁", keywords: ["wanna","bath","łazienka","bathroom","kąpiel"] },
  { emoji: "🪞", keywords: ["lustro","mirror","łazienka","bathroom","odbicie"] },
  { emoji: "🧺", keywords: ["kosz","basket","pranie","laundry","pralnia"] },
  { emoji: "🌍", keywords: ["globus","globe","świat","world","ekologia"] },
  { emoji: "♻️", keywords: ["recykling","recycling","ekologia","green","środowisko"] },
  { emoji: "🛍️", keywords: ["torba","bag","zakupy","shopping","sklep"] },
  { emoji: "💳", keywords: ["karta","card","płatność","bank","finance"] },
  { emoji: "💰", keywords: ["pieniądze","money","kasa","cash","finanse"] },
  { emoji: "🎯", keywords: ["cel","target","dążenie","sport","precise"] },
  { emoji: "🔨", keywords: ["młotek","hammer","narzędzie","tool","naprawa"] },
  { emoji: "🪚", keywords: ["piła","saw","narzędzie","tool","drewno"] },
  { emoji: "⚙️", keywords: ["koło zębate","gear","ustawienia","settings","mechanika"] },
  { emoji: "🧲", keywords: ["magnes","magnet","metalowy","przyciąganie","tool"] },
  { emoji: "🪜", keywords: ["drabina","ladder","narzędzie","tool","dom"] },
  { emoji: "🌡️", keywords: ["termometr","thermometer","temperatura","pogoda","zdrowie"] },
  { emoji: "🌤️", keywords: ["słońce","sun","pogoda","weather","letni"] },
  { emoji: "❄️", keywords: ["śnieg","snow","zimno","cold","zima","winter"] },
  { emoji: "🌧️", keywords: ["deszcz","rain","pogoda","weather","jesień"] },
  { emoji: "🎵", keywords: ["muzyka","music","dźwięk","sound","piosenka"] },
  { emoji: "📺", keywords: ["telewizor","tv","elektronika","rozrywka","ogladanie"] },
];

export function CategoryManager({ categories }: CategoryManagerProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📦");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("📦");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => { await createCategory(newName.trim(), newEmoji); });
    setNewName(""); setNewEmoji("📦"); setAdding(false);
  }

  function startEdit(c: CategoryWithUsage) {
    if (!c.id) return;
    setEditingId(c.id); setEditName(c.name); setEditEmoji(c.emoji);
  }

  function handleUpdate() {
    if (!editingId || !editName.trim()) { setEditingId(null); return; }
    startTransition(async () => { await updateCategory(editingId, editName.trim(), editEmoji); });
    setEditingId(null);
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteCategory(id); });
  }

  const base = categories.filter((c) => c.isBase);
  const custom = categories.filter((c) => !c.isBase);

  const rowStyle = (i: number, total: number) => ({
    borderBottom: i < total - 1 ? "1px solid var(--border)" : undefined,
  });

  const inputStyle = {
    backgroundColor: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "2px 6px",
    color: "var(--text-primary)",
  };

  return (
    <div>
      {/* Custom */}
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-muted)", margin: 0 }}>
          Własne kategorie
        </h2>
        <button
          onClick={() => setAdding(true)}
          disabled={isPending}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium focus:outline-none disabled:opacity-40"
          style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Nowa kategoria
        </button>
      </div>

      {adding && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg mb-3 border" style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--accent-blue)" }}>
          <EmojiPicker value={newEmoji} onChange={setNewEmoji} />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setAdding(false); }}
            placeholder="Nazwa kategorii"
            className="mono text-sm focus:outline-none flex-1"
            style={{ ...inputStyle, minWidth: 160 }}
            autoFocus
          />
          <button onClick={handleCreate} disabled={!newName.trim() || isPending} className="p-1.5 focus:outline-none disabled:opacity-40" style={{ color: "var(--accent-blue)" }}>
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          </button>
          <button onClick={() => setAdding(false)} className="p-1.5 focus:outline-none" style={{ color: "var(--text-muted)" }}>
            <X size={15} />
          </button>
        </div>
      )}

      <div className="mb-8" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {custom.length === 0 ? (
          <p className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Brak własnych kategorii. Kliknij „Nowa kategoria" by dodać.
          </p>
        ) : custom.map((c, i) => (
          <div
            key={c.id ?? c.name}
            className="flex items-center gap-3 px-4 py-2"
            style={{ ...rowStyle(i, custom.length), opacity: isPending ? 0.6 : 1, transition: "opacity 0.15s" }}
          >
            {editingId === c.id && c.id ? (
              <>
                <EmojiPicker value={editEmoji} onChange={setEditEmoji} />
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(); if (e.key === "Escape") setEditingId(null); }}
                  className="flex-1 mono text-sm focus:outline-none"
                  style={{ ...inputStyle, minWidth: 120 }}
                  autoFocus
                />
                <button onClick={handleUpdate} disabled={isPending} className="p-1 focus:outline-none disabled:opacity-40" style={{ color: "var(--accent-blue)" }}>
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
                <button onClick={() => setEditingId(null)} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }}><X size={13} /></button>
              </>
            ) : (
              <>
                <span className="text-base w-6 text-center">{c.emoji}</span>
                <span className="mono text-sm flex-1" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {c.usageCount > 0 ? `${c.usageCount} ${c.usageCount === 1 ? "produkt" : "produkty"}` : "nieużywana"}
                </span>
                {c.isOwn && c.id && (
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => startEdit(c)} disabled={isPending} className="p-1 focus:outline-none disabled:opacity-40" style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDelete(c.id!)} disabled={isPending} className="p-1 focus:outline-none disabled:opacity-40" style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Base (read-only) */}
      <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 8 }}>
        Kategorie podstawowe
      </h2>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Wbudowane kategorie z automatycznym rozpoznawaniem słów kluczowych — tylko do odczytu.
      </p>
      <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {base.map((c, i) => (
          <div key={c.name} className="flex items-center gap-3 px-4 py-2" style={rowStyle(i, base.length)}>
            <span className="text-base w-6 text-center">{c.emoji}</span>
            <span className="mono text-sm flex-1" style={{ color: "var(--text-primary)" }}>{c.name}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {c.usageCount > 0 ? `${c.usageCount} ${c.usageCount === 1 ? "produkt" : "produkty"}` : "—"}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
        Zmiana nazwy własnej kategorii aktualizuje produkty w Twoim katalogu, ale nie produkty już dodane do list zakupów.
      </p>
    </div>
  );
}

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? EMOJI_DATA.filter((e) =>
        e.keywords.some((k) => k.includes(search.toLowerCase()))
      )
    : EMOJI_DATA;

  useEffect(() => {
    if (!open) { setSearch(""); setCustom(""); return; }
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xl w-9 h-9 rounded flex items-center justify-center focus:outline-none"
        style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)" }}
        title="Wybierz emoji"
      >
        {value}
      </button>

      {open && (
        <div
          className="absolute z-30 rounded-lg shadow-xl"
          style={{
            top: "100%",
            left: 0,
            marginTop: 4,
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            width: 308,
          }}
        >
          {/* Search */}
          <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Szukaj emoji…"
              className="w-full text-sm focus:outline-none bg-transparent mono"
              style={{ color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
            />
          </div>

          {/* Grid */}
          <div
            style={{ maxHeight: 240, overflowY: "auto", padding: 6 }}
          >
            {filtered.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>Brak wyników</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2 }}>
                {filtered.map((e) => (
                  <button
                    key={e.emoji}
                    type="button"
                    onClick={() => { onChange(e.emoji); setOpen(false); }}
                    className="text-lg w-8 h-8 rounded flex items-center justify-center focus:outline-none"
                    style={{
                      backgroundColor: value === e.emoji ? "var(--bg-hover)" : undefined,
                      transition: "background-color 0.1s",
                    }}
                    onMouseEnter={(el) => { el.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                    onMouseLeave={(el) => { el.currentTarget.style.backgroundColor = value === e.emoji ? "var(--bg-hover)" : ""; }}
                    title={e.keywords[0]}
                  >
                    {e.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom input */}
          <div className="p-2 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                maxLength={2}
                placeholder="Wpisz własne…"
                className="flex-1 text-sm text-center focus:outline-none mono rounded"
                style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", padding: "2px 6px", color: "var(--text-primary)" }}
              />
              <button
                type="button"
                disabled={!custom.trim()}
                onClick={() => { if (custom.trim()) { onChange(custom.trim()); setOpen(false); } }}
                className="px-2 py-1 rounded text-xs focus:outline-none disabled:opacity-40"
                style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
