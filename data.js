// Antojo - base semilla de precios reales (piloto Dublin centro)
//
// Categoria semilla: HAMBURGUESAS en el centro de Dublin (D1/D2/D8).
// Cada precio verificado lleva: src (URL de la fuente oficial), chk (fecha de
// verificacion) y ch (canal: carta web oficial, PDF oficial, pedido online
// oficial del restaurante). Nada de precios inventados: si no hay fuente,
// el plato queda con price:null y la interfaz muestra "sin precio verificado".
//
// Regla de frescura (Carol, 11 sep 2026): un precio guardado hay que
// revalidarlo a los 90 dias; si no se puede revalidar, se marca como
// obsoleto y nunca se muestra como vigente. (Carol, 30 oct 2026: los precios
// que llevan mucho tiempo sin refrescar se vuelven a buscar; se revalida por
// antiguedad, empezando por los platos mas buscados.)
//
// Fuentes de esta semilla (leidas el 2026-10-30):
//  - Cartas oficiales en la web del restaurante (ch:"carta")
//  - PDFs de carta publicados por el restaurante (ch:"pdf")
//  - Pedidos online oficiales del restaurante (Toast / web propia, ch:"toast"/"web")
//    OJO: el precio de pedido online puede ser de recogida; no garantiza el
//    precio en mesa (ej. Handsome Burger marca "Pickup Only").
// Restaurantes y valoraciones: Yelp, oct 2026 (rating:null = sin ficha Yelp).
const VERIFIED = "2026-10-30";
const SRC_BUNSEN = "https://order.toasttab.com/online/bunsen-dame-53-dame-st-dublin-2-d02-v525"; // pedido online oficial Bunsen (tienda Dame St; misma carta en las 4 sucursales)
const SRC_DASH = "https://www.dashburger.ie/menu/";
const SRC_MADEGG = "https://www.madegg.ie/menu/";
const SRC_WOW = "https://wowburger.ie/";
const SRC_BOBOS = "https://bobos.ie/wp-content/uploads/2026/10/Bobos-Menu.pdf";
function dish(name, price, src, ch) { return { name: name, price: price, src: src, chk: VERIFIED, ch: ch }; }
function pendiente(name) { return { name: name, price: null }; }
const BUNSEN_DISHES = [
  dish("Hamburger", 9.65, SRC_BUNSEN, "toast"),
  dish("Cheeseburger", 10.95, SRC_BUNSEN, "toast"),
  dish("Double Cheeseburger", 14.75, SRC_BUNSEN, "toast")
];
const DASH_DISHES = [
  dish("Dash Double Smash", 11.95, SRC_DASH, "carta"),
  dish("Bacon Double Smash", 14.00, SRC_DASH, "carta"),
  dish("Triple Smash", 14.00, SRC_DASH, "carta")
];
const MADEGG_DISHES = [
  dish("OG (fried chicken burger)", 14.00, SRC_MADEGG, "carta"),
  dish("Comeback To Me", 14.95, SRC_MADEGG, "carta"),
  dish("Nashville Hot Chick", 14.95, SRC_MADEGG, "carta")
];
const WOW_DISHES = [
  dish("WOW Hamburger", 11.50, SRC_WOW, "web"),
  dish("WOW Cheeseburger", 12.50, SRC_WOW, "web"),
  dish("WOW Bacon Cheeseburger", 13.00, SRC_WOW, "web")
];
const BOBOS_DISHES = [
  dish("Steak Beef Burger", 11.95, SRC_BOBOS, "pdf"),
  dish("The Cheese Burger", 13.45, SRC_BOBOS, "pdf"),
  dish("The Bacon Cheese Burger", 14.95, SRC_BOBOS, "pdf")
];
const VENUES = [
  // ---- HAMBURGUESAS: 20 locales del centro con precios verificados ----
  { id:"bunsen-anne", name:"Bunsen", cat:"hamburguesas", rating:4.6, reviews:82, band:"€€",
    address:"3 Anne Street S, Dublin 2", lat:53.341241, lon:-6.2601001,
    source:"https://www.yelp.com/biz/bunsen-dublin",
    dishes:BUNSEN_DISHES },
  { id:"bunsen-essex", name:"Bunsen (Temple Bar)", cat:"hamburguesas", rating:4.6, reviews:227, band:"€€",
    address:"22 Essex Street E, Temple Bar, Dublin 2", lat:53.3455885, lon:-6.2645026,
    source:"https://www.yelp.com/biz/bunsen-dublin-2",
    dishes:BUNSEN_DISHES },
  { id:"bunsen-dame", name:"Bunsen (Dame St)", cat:"hamburguesas", rating:4.5, reviews:6, band:"€€",
    address:"53 Dame St, Dublin 2", lat:53.34431, lon:-6.2642,
    source:"https://www.yelp.com/biz/bunsen-dublin-9",
    dishes:BUNSEN_DISHES },
  { id:"bunsen-wexford", name:"Bunsen (Wexford St)", cat:"hamburguesas", rating:4.2, reviews:237, band:"€€",
    address:"36 Wexford Street, Dublin 2", lat:53.3372192, lon:-6.2659775,
    source:"https://www.yelp.com/biz/bunsen-dublin-4",
    dishes:BUNSEN_DISHES },
  { id:"handsome-chatham", name:"Handsome Burger", cat:"hamburguesas", rating:null, reviews:0, band:"€",
    address:"2 Chatham Row, Dublin 2", lat:53.3411607, lon:-6.2628223,
    source:null,
    dishes:[
      dish("Handsome Burger", 10.50, "https://order.toasttab.com/online/handsome-burger-dublin", "toast"),
      dish("The Smash Patty", 9.00, "https://order.toasttab.com/online/handsome-burger-dublin", "toast"),
      dish("The B.O.B", 13.00, "https://order.toasttab.com/online/handsome-burger-dublin", "toast"),
      dish("Roost (chicken)", 11.50, "https://order.toasttab.com/online/handsome-burger-dublin", "toast")
    ]},
  { id:"dash-capel", name:"Dash Burger (Capel St)", cat:"hamburguesas", rating:null, reviews:0, band:"€",
    address:"159 Capel St, Dublin 1", lat:53.3468122, lon:-6.2682382,
    source:null,
    dishes:DASH_DISHES },
  { id:"dash-kevin", name:"Dash Burger (Kevin St)", cat:"hamburguesas", rating:null, reviews:0, band:"€",
    address:"Kevin Street Lower, Dublin 8", lat:53.3375189, lon:-6.2665498,
    source:null,
    dishes:DASH_DISHES },
  { id:"madegg-millennium", name:"Mad Egg (Millennium Walkway)", cat:"hamburguesas", rating:null, reviews:0, band:"€",
    address:"6 Jervis House, Millennium Walkway, Dublin 1", lat:53.3472452, lon:-6.2653579,
    source:null,
    dishes:MADEGG_DISHES },
  { id:"mad-egg", name:"Mad Egg (Charlotte Way)", cat:"hamburguesas", rating:4.5, reviews:29, band:"€",
    address:"2 & 3 Charlotte Way, Dublin 2", lat:53.333786, lon:-6.264654,
    source:"https://www.yelp.com/biz/mad-egg-dublin",
    dishes:MADEGG_DISHES },
  { id:"wow-wellington", name:"Wowburger (Wellington Quay)", cat:"hamburguesas", rating:4.3, reviews:52, band:"€",
    address:"11 Wellington Quay, Dublin 2", lat:53.34541, lon:-6.26613,
    source:"https://www.yelp.com/biz/wowburger-dublin",
    dishes:WOW_DISHES },
  { id:"wow-wicklow", name:"Wowburger (Wicklow St)", cat:"hamburguesas", rating:4.0, reviews:18, band:"€€",
    address:"8 Wicklow Street, Dublin 2", lat:53.342907, lon:-6.2605431,
    source:"https://www.yelp.com/biz/wowburger-dublin-2",
    dishes:WOW_DISHES },
  { id:"chimac", name:"Chimac", cat:"hamburguesas", rating:4.4, reviews:11, band:"€€",
    address:"76 Aungier St, Dublin 2", lat:53.34107, lon:-6.26577,
    source:"https://www.yelp.com/biz/chimac-dublin",
    dishes:[
      dish("The Classic (chicken)", 14.95, "https://chimac.ie/pages/menus", "carta"),
      dish("KimCheese", 14.95, "https://chimac.ie/pages/menus", "carta"),
      dish("K-BBQ", 14.95, "https://chimac.ie/pages/menus", "carta")
    ]},
  { id:"bobos-dame", name:"Bóbós (Dame St)", cat:"hamburguesas", rating:3.9, reviews:166, band:"€€",
    address:"50-51 Dame Street, Dublin 2", lat:53.3443268, lon:-6.263885,
    source:"https://www.yelp.com/biz/b%C3%B3b%C3%B3s-burgers-restaurant-dublin",
    dishes:BOBOS_DISHES },
  { id:"bobos-abbey", name:"Bóbós (Abbey St)", cat:"hamburguesas", rating:null, reviews:0, band:"€€",
    address:"74 Middle Abbey Street, Dublin 1", lat:53.3481528, lon:-6.2603793,
    source:null,
    dishes:BOBOS_DISHES },
  { id:"elephant-castle", name:"Elephant & Castle", cat:"hamburguesas", rating:4.0, reviews:389, band:"€€",
    address:"18 Temple Bar, Dublin 2", lat:53.3456, lon:-6.26247,
    source:"https://www.yelp.com/biz/elephant-and-castle-dublin",
    dishes:[
      dish("Elephant Burger", 19.95, "https://elephantandcastle.ie/wp-content/uploads/2025/05/EC_Main_Menu_MAY25.pdf", "pdf"),
      dish("Vintage Cheddar & Streaky Bacon Burger", 17.95, "https://elephantandcastle.ie/wp-content/uploads/2025/05/EC_Main_Menu_MAY25.pdf", "pdf"),
      dish("Homemade Veggie Burger", 16.95, "https://elephantandcastle.ie/wp-content/uploads/2025/05/EC_Main_Menu_MAY25.pdf", "pdf")
    ]},
  { id:"brannigans", name:"Brannigans", cat:"hamburguesas", rating:4.6, reviews:94, band:"€",
    address:"9 Cathedral Street, Dublin 1", lat:53.3503792, lon:-6.2597544,
    source:"https://www.yelp.com/biz/brannigans-dublin",
    dishes:[
      dish("Prime Irish Beef Burger", 17.95, "https://brannigansbar.ie/menu/", "carta"),
      dish("Cajun Chicken Burger", 17.95, "https://brannigansbar.ie/menu/", "carta")
    ]},
  { id:"darkey-kellys", name:"Darkey Kelly's", cat:"hamburguesas", rating:4.6, reviews:344, band:"€€",
    address:"Copper Alley, Fishamble Street, Dublin 8", lat:53.3439088, lon:-6.2700871,
    source:"https://www.yelp.com/biz/darkey-kellys-dublin",
    dishes:[
      dish("Classic Dublin Burger", 17.95, "https://darkeykellys.ie/food-menu/", "carta"),
      dish("Dublin Mountain Burger", 19.95, "https://darkeykellys.ie/food-menu/", "carta"),
      dish("Crispy Chicken Burger", 17.95, "https://darkeykellys.ie/food-menu/", "carta")
    ]},
  { id:"sheehans", name:"Sheehans", cat:"hamburguesas", rating:4.6, reviews:192, band:"€€",
    address:"17 Chatham Street, Dublin 2", lat:53.340967, lon:-6.26178,
    source:"https://www.yelp.com/biz/sheehans-dublin",
    dishes:[
      dish("The Banjo Beef Burger", 19.95, "https://sheehanspub.ie/food-menu/", "carta"),
      dish("Buttered Chicken Burger", 19.95, "https://sheehanspub.ie/food-menu/", "carta")
    ]},
  { id:"bison", name:"Bison Bar & BBQ", cat:"hamburguesas", rating:4.1, reviews:131, band:"€€",
    address:"11 Wellington Quay, Dublin 2", lat:53.34544, lon:-6.26616,
    source:"https://www.yelp.com/biz/bison-bar-and-bbq-dublin",
    dishes:[
      dish("Bacon Cheese Burger", 18.50, "https://bisonbar.ie/food/", "carta"),
      dish("Buttermilk Chicken Burger", 18.70, "https://bisonbar.ie/food/", "carta"),
      dish("Grilled Halloumi Burger", 17.25, "https://bisonbar.ie/food/", "carta")
    ]},
  { id:"bank-college-green", name:"The Bank on College Green", cat:"hamburguesas", rating:4.4, reviews:471, band:"€€€",
    address:"20-22 College Green, Dublin 2", lat:53.3443, lon:-6.26148,
    source:"https://www.yelp.com/biz/the-bank-on-college-green-dublin",
    dishes:[
      dish("Prime Angus 8oz Beef Burger", 23.00, "https://www.bankoncollegegreen.com/wp-content/uploads/Dinner-PDF.pdf", "pdf")
    ]},
  // ---- RAMEN y BRUNCH: locales reales; precios pendientes de verificacion ----
  { id:"eatokyo", name:"Eatokyo", cat:"ramen", rating:4.6, reviews:50, band:"€€",
    address:"51 Wellington Quay, Temple Bar, Dublin 2", lat:53.3459999, lon:-6.26264,
    source:"https://www.yelp.com/biz/eatokyo-dublin",
    dishes:[ pendiente("Ramen tonkotsu"), pendiente("Gyozas") ]},
  { id:"takara", name:"Takara", cat:"ramen", rating:4.5, reviews:16, band:"€€",
    address:"37 Abbey Street Upper, Dublin 1", lat:53.3444426, lon:-6.2596904,
    source:"https://www.yelp.com/biz/takara-dublin",
    dishes:[ pendiente("Ramen shoyu"), pendiente("Ramen miso") ]},
  { id:"maneki", name:"Maneki", cat:"ramen", rating:4.4, reviews:11, band:"€€",
    address:"43 Dawson Street, Dublin 2", lat:53.34086, lon:-6.25862,
    source:"https://www.yelp.com/biz/maneki-dublin",
    dishes:[ pendiente("Ramen tonkotsu"), pendiente("Katsu curry") ]},
  { id:"musashi-capel", name:"Musashi", cat:"ramen", rating:4.1, reviews:163, band:"€€",
    address:"15 Capel Street, Dublin 1", lat:53.34695, lon:-6.26807,
    source:"https://www.yelp.com/biz/musashi-dublin",
    dishes:[ pendiente("Ramen"), pendiente("Sushi variado") ]},
  { id:"ramen-bar", name:"The Ramen Bar", cat:"ramen", rating:4.1, reviews:173, band:"€€",
    address:"51 William Street S, Dublin 2", lat:53.3416, lon:-6.26274,
    source:"https://www.yelp.com/biz/the-ramen-bar-dublin",
    dishes:[ pendiente("Ramen clásico"), pendiente("Ramen picante") ]},
  { id:"zakura", name:"Zakura Noodle & Sushi", cat:"ramen", rating:4.2, reviews:90, band:"€€",
    address:"13 Wexford Street, Dublin 2", lat:53.3369221, lon:-6.2654230,
    source:"https://www.yelp.com/biz/zakura-noodle-and-sushi-dublin",
    dishes:[ pendiente("Ramen"), pendiente("Bao buns") ]},
  { id:"banyi", name:"Banyi Japanese Dining", cat:"ramen", rating:4.2, reviews:82, band:"€€",
    address:"3-4 Bedford Row, Temple Bar, Dublin 2", lat:53.34601, lon:-6.26198,
    source:"https://www.yelp.com/biz/banyi-japanese-dining-dublin",
    dishes:[ pendiente("Ramen"), pendiente("Tempura") ]},
  { id:"little-kitchen", name:"The Little Kitchen", cat:"brunch", rating:4.7, reviews:47, band:"€€",
    address:"129 Leeson Street Upper, Dublin", lat:53.33036, lon:-6.25152,
    source:"https://www.yelp.com/biz/the-little-kitchen-dublin",
    dishes:[ pendiente("Huevos benedictinos"), pendiente("Pancakes") ]},
  { id:"tang", name:"Tang", cat:"brunch", rating:4.7, reviews:77, band:"€€",
    address:"23 Dawson Street, Dublin 2", lat:53.3394928, lon:-6.2588516,
    source:"https://www.yelp.com/biz/tang-dublin",
    dishes:[ pendiente("Tostada de aguacate"), pendiente("Bowl de desayuno") ]},
  { id:"bread41", name:"Bread 41", cat:"brunch", rating:4.7, reviews:96, band:"€€",
    address:"41 Pearse St, Dublin 2", lat:53.344757, lon:-6.251778,
    source:"https://www.yelp.com/biz/bread-41-dublin",
    dishes:[ pendiente("Croissant"), pendiente("Tostada de masa madre") ]},
  { id:"stage-door", name:"Stage Door Café", cat:"brunch", rating:4.6, reviews:149, band:"€€",
    address:"11-12 E Essex St, Temple Bar, Dublin 2", lat:53.34522, lon:-6.26599,
    source:"https://www.yelp.com/biz/stage-door-caf%C3%A9-dublin",
    dishes:[ pendiente("Desayuno completo irlandés"), pendiente("Huevos benedictinos") ]},
  { id:"two-pups", name:"Two Pups Coffee", cat:"brunch", rating:4.6, reviews:65, band:"€",
    address:"74 Francis Street, Dublin 8", lat:53.3392392, lon:-6.2735820,
    source:"https://www.yelp.com/biz/two-pups-coffee-dublin",
    dishes:[ pendiente("Huevos turcos"), pendiente("Tostada de aguacate") ]},
  { id:"lovinspoon", name:"The Lovinspoon", cat:"brunch", rating:4.6, reviews:132, band:"€",
    address:"13 N Frederick Street, Dublin 1", lat:53.355713, lon:-6.264602,
    source:"https://www.yelp.com/biz/the-lovinspoon-dublin",
    dishes:[ pendiente("Desayuno irlandés"), pendiente("Pancakes") ]},
  { id:"beanhive", name:"Beanhive", cat:"brunch", rating:4.6, reviews:148, band:"€€",
    address:"26 Dawson Street, Dublin 2", lat:53.339829, lon:-6.258777,
    source:"https://www.yelp.com/biz/beanhive-dublin",
    dishes:[ pendiente("Wrap de desayuno"), pendiente("Porridge") ]},
  { id:"alma", name:"Alma", cat:"brunch", rating:4.7, reviews:15, band:"€€",
    address:"12 S Circular Rd, Dublin 8", lat:53.33258, lon:-6.26911,
    source:"https://www.yelp.com/biz/alma-dublin",
    dishes:[ pendiente("Huevos benedictinos"), pendiente("Tostada de ricotta") ]}
];
const DUBLIN_CENTER = { lat: 53.3498, lon: -6.2603 };
