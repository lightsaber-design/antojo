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
//  - Pedidos online oficiales del restaurante (Toast / Square / web propia,
//    ch:"toast"/"square"/"web"). OJO: el precio de pedido online puede ser de
//    recogida; no garantiza el precio en mesa (ej. Handsome Burger marca
//    "Pickup Only").
//  - Plataformas de delivery (ch:"deliveroo"): precio de entrega a domicilio,
//    puede ser mayor que en local. (Carol, 30 oct 2026: los precios de pedido
//    online tambien se muestran, indicando el canal.)
//  - Foto de la carta en el local publicada por terceros (ch:"foto"), con la
//    fecha de la foto indicada en el comentario del local.
// Carol, 30 oct 2026: un plato solo queda pendiente tras agotar fuentes
// (web oficial, pedido online, plataformas de delivery, cartas de terceros).
// Restaurantes y valoraciones: Yelp, oct 2026 (rating:null = sin ficha Yelp).
// Historico (opcional, campo hist): observaciones anteriores del mismo plato,
// [{price, chk, src, ch}] de mas antigua a mas reciente; la ficha muestra la
// evolucion ("antes EUR X -> ahora EUR Y"). Idea de PriceBite (GPL-3.0: solo
// ideas, sin codigo). Ver NOTICE.md.
// 30 oct 2026 (3a iteracion, a peticion de Carol): categoria SUSHI cargada con
// precios reales (Eatokyo, Takara y Musashi amplian su carta; se suman Izushi,
// Kyodai x2 y Yamamori). Banyi cerro en nov 2025 (HappyCow): en 3-4 Bedford Row
// abrio Izushi (izushi.ie), asi que sus 2 pendientes se retiran con el local.
// Yamamori: su web oficial no publica la carta con precios; se usa la carta
// recopilada por FreeFromly (ch:"agregador"), terceros, sin fecha de carta.
// pipeline/revalidate.js: cola de revalidacion a 90 dias, primero lo mas buscado.
// pipeline/extract-menu.js: candidatos de platos desde la web oficial de un
// local (metodologia adaptada de amsterdam-menus, MIT). Nada entra sin revision.
const VERIFIED = "2026-10-30";
const FRESH_DAYS = 90; // regla de Carol: un precio guardado se revalida a los 90 dias
const SRC_BUNSEN = "https://order.toasttab.com/online/bunsen-dame-53-dame-st-dublin-2-d02-v525"; // pedido online oficial Bunsen (tienda Dame St; misma carta en las 4 sucursales)
const SRC_DASH = "https://www.dashburger.ie/menu/";
const SRC_MADEGG = "https://www.madegg.ie/menu/";
const SRC_WOW = "https://wowburger.ie/";
const SRC_BOBOS = "https://bobos.ie/wp-content/uploads/2026/10/Bobos-Menu.pdf";
function dish(name, price, src, ch, hist) { var d = { name: name, price: price, src: src, chk: VERIFIED, ch: ch }; if (hist) d.hist = hist; return d; }
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
const SRC_KYODAI = "https://www.kyodai.ie/menu-1?menu=menu"; // carta oficial Kyodai (misma en las 2 sucursales)
const KYODAI_DISHES = [
  dish("California Roll (8 piezas)", 11.80, SRC_KYODAI, "carta"),
  dish("Ebi Tempura Masago Roll (8 piezas)", 12.80, SRC_KYODAI, "carta"),
  dish("Spider Floss Roll", 13.80, SRC_KYODAI, "carta"),
  dish("Rainbow Roll", 19.80, SRC_KYODAI, "carta")
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
  { id:"eatokyo", name:"Eatokyo", cat:"ramen", cats:["ramen","sushi"], rating:4.6, reviews:50, band:"€€",
    address:"51 Wellington Quay, Temple Bar, Dublin 2", lat:53.3459999, lon:-6.26264,
    source:"https://www.yelp.com/biz/eatokyo-dublin",
    dishes:[
      dish("Chicken Ramen", 17.50, "https://eatokyo.ie/eatokyo-temple-bar/", "carta"),
      dish("Chicken Gyoza", 7.90, "https://eatokyo.ie/eatokyo-temple-bar/", "carta"),
      // Sushi (misma carta oficial):
      dish("Salmon Roll (8 piezas)", 7.90, "https://eatokyo.ie/eatokyo-temple-bar/", "carta"),
      dish("Spicy Tuna Roll (8 piezas)", 7.90, "https://eatokyo.ie/eatokyo-temple-bar/", "carta"),
      dish("California (8 piezas)", 9.50, "https://eatokyo.ie/eatokyo-temple-bar/", "carta"),
      dish("Ebi Tempura Masago (8 piezas)", 10.50, "https://eatokyo.ie/eatokyo-temple-bar/", "carta")
    ]},
  { id:"takara", name:"Takara", cat:"ramen", cats:["ramen","sushi"], rating:4.5, reviews:16, band:"€€",
    address:"37 Abbey Street Upper, Dublin 1", lat:53.3444426, lon:-6.2596904,
    source:"https://www.yelp.com/biz/takara-dublin",
    dishes:[
      dish("Tonkotsu Original Ramen", 13.45, "https://takara.ie/takara/takeaway", "web"),
      dish("Chicken Miso Ramen", 13.45, "https://takara.ie/takara/takeaway", "web"),
      // Sushi (mismo pedido online oficial):
      dish("Salmon Roll (8 piezas)", 6.00, "https://takara.ie/takara/takeaway", "web"),
      dish("Tuna Roll (8 piezas)", 6.00, "https://takara.ie/takara/takeaway", "web"),
      dish("California (8 piezas)", 8.50, "https://takara.ie/takara/takeaway", "web"),
      dish("Spicy Salmon Roll (8 piezas)", 9.20, "https://takara.ie/takara/takeaway", "web"),
      dish("Chicken Katsu Roll (8 piezas)", 8.50, "https://takara.ie/takara/takeaway", "web")
    ]},
  { id:"maneki", name:"Maneki", cat:"ramen", rating:4.4, reviews:11, band:"€€",
    address:"43 Dawson Street, Dublin 2", lat:53.34086, lon:-6.25862,
    source:"https://www.yelp.com/biz/maneki-dublin",
    dishes:[
      dish("Tonkotsu Ramen/Udon", 19.50, "https://maneki.ie/menus/", "carta"),
      dish("Chicken Katsu Curry Donburi", 18.00, "https://maneki.ie/menus/", "carta")
    ]},
  { id:"musashi-capel", name:"Musashi", cat:"ramen", cats:["ramen","sushi"], rating:4.1, reviews:163, band:"€€",
    address:"15 Capel Street, Dublin 1", lat:53.34695, lon:-6.26807,
    source:"https://www.yelp.com/biz/musashi-dublin",
    dishes:[
      // Musashi no sirve ramen (carta oficial); platos reales verificados:
      dish("California Roll (8 piezas)", 7.50, "https://musashidublin.com/capel-street/doc/menu.pdf", "pdf"),
      dish("Musashi Yaki Soba", 14.50, "https://musashidublin.com/capel-street/doc/menu.pdf", "pdf"),
      // Sushi (mismo PDF oficial):
      dish("Salmon Roll (8 piezas)", 5.99, "https://musashidublin.com/capel-street/doc/menu.pdf", "pdf"),
      dish("Spicy Tuna Roll (8 piezas)", 6.99, "https://musashidublin.com/capel-street/doc/menu.pdf", "pdf"),
      dish("Ebi Tempura Masago Roll (8 piezas)", 7.99, "https://musashidublin.com/capel-street/doc/menu.pdf", "pdf"),
      dish("Rainbow Roll (8 piezas)", 18.99, "https://musashidublin.com/capel-street/doc/menu.pdf", "pdf")
    ]},
  { id:"ramen-bar", name:"The Ramen Bar", cat:"ramen", rating:4.1, reviews:173, band:"€€",
    address:"51 William Street S, Dublin 2", lat:53.3416, lon:-6.26274,
    source:"https://www.yelp.com/biz/the-ramen-bar-dublin",
    dishes:[
      dish("Torishio Ramen", 17.50, "https://theramenbar.ie/wp-content/uploads/2026/05/235815-Kokoro-Sushi-Dinner-Menu.pdf", "pdf"),
      dish("Tonkotsu Red (spicy)", 18.50, "https://theramenbar.ie/wp-content/uploads/2026/05/235815-Kokoro-Sushi-Dinner-Menu.pdf", "pdf")
    ]},
  { id:"zakura", name:"Zakura Noodle & Sushi", cat:"ramen", rating:4.2, reviews:90, band:"€€",
    address:"13 Wexford Street, Dublin 2", lat:53.3369221, lon:-6.2654230,
    source:"https://www.yelp.com/biz/zakura-noodle-and-sushi-dublin",
    dishes:[
      // Zakura no lista bao buns; ramen via Deliveroo (precio de entrega):
      dish("Chicken Ramen", 19.80, "https://deliveroo.ie/menu/dublin/dublin-2/zakura-lunch-wexford-st", "deliveroo"),
      dish("Chilli Chicken Ramen", 21.00, "https://deliveroo.ie/menu/dublin/dublin-2/zakura-lunch-wexford-st", "deliveroo")
    ]},
  // Banyi Japanese Dining CERRO en nov 2025 (HappyCow: "Reported closed
  // November 2025"; postcard.inc: "Permanently Closed"). En su direccion,
  // 3-4 Bedford Row, abrio Izushi (izushi.ie), que queda cargado abajo en SUSHI.
  // Se retiran sus 2 platos pendientes: ya no hay nada que verificar.
  // ---- SUSHI: locales dedicados anadidos el 30 oct 2026 ----
  { id:"izushi", name:"Izushi Izakaya", cat:"sushi", rating:null, reviews:0, band:"€€",
    address:"3-4 Bedford Row, Temple Bar, Dublin 2", lat:53.345919, lon:-6.261906,
    source:"https://www.izushi.ie/",
    dishes:[
      dish("Rainbow Roll", 18.90, "https://www.izushi.ie/", "carta"),
      dish("Dragon Roll", 18.90, "https://www.izushi.ie/", "carta"),
      dish("Izushi Platter (chef selection)", 21.50, "https://www.izushi.ie/", "carta"),
      dish("Sashimi Platter (chef selection)", 38.90, "https://www.izushi.ie/", "carta")
    ]},
  { id:"kyodai-dame", name:"Kyodai Izakaya (Dame St)", cat:"sushi", rating:null, reviews:0, band:"€€",
    address:"First Floor, 32 Dame Street, Dublin 2", lat:53.3442137, lon:-6.2634147,
    source:"https://www.kyodai.ie/",
    dishes:KYODAI_DISHES },
  { id:"kyodai-eden", name:"Kyodai Izakaya (Eden Quay)", cat:"sushi", rating:null, reviews:0, band:"€€",
    address:"10 Eden Quay, North City, Dublin 1", lat:53.3479555, lon:-6.2578862,
    source:"https://www.kyodai.ie/",
    dishes:KYODAI_DISHES },
  { id:"yamamori-south", name:"Yamamori South City", cat:"sushi", rating:null, reviews:0, band:"€€",
    address:"71/72 South Great George's Street, Dublin 2", lat:53.3428358, lon:-6.2646782,
    source:"https://www.yamamori.ie/southcity",
    dishes:[
      // Su web oficial no publica precios; carta recopilada por FreeFromly
      // (terceros, leida de la carta del restaurante, sin fecha de carta):
      dish("Salmon Roll", 14.25, "https://freefromly.com/restaurant/yamamori-south-city-dublin", "agregador"),
      dish("Salmon & Avocado Roll", 14.75, "https://freefromly.com/restaurant/yamamori-south-city-dublin", "agregador"),
      dish("California Roll", 17.75, "https://freefromly.com/restaurant/yamamori-south-city-dublin", "agregador"),
      dish("Spicy Bluefin Tuna Roll", 19.25, "https://freefromly.com/restaurant/yamamori-south-city-dublin", "agregador"),
      dish("Rainbow Roll", 27.95, "https://freefromly.com/restaurant/yamamori-south-city-dublin", "agregador")
    ]},
  { id:"little-kitchen", name:"The Little Kitchen", cat:"brunch", rating:4.7, reviews:47, band:"€€",
    address:"129 Leeson Street Upper, Dublin", lat:53.33036, lon:-6.25152,
    source:"https://www.yelp.com/biz/the-little-kitchen-dublin",
    dishes:[
      // Sin carta de brunch online; platos reales de su carta de mediodia:
      dish("Seafood Chowder", 9.50, "https://www.thelittlekitchen.ie/lunch-menu", "carta"),
      dish("The Little Kitchen Fish Pie", 14.50, "https://www.thelittlekitchen.ie/lunch-menu", "carta")
    ]},
  { id:"tang", name:"Tang", cat:"brunch", rating:4.7, reviews:77, band:"€€",
    address:"23 Dawson Street, Dublin 2", lat:53.3394928, lon:-6.2588516,
    source:"https://www.yelp.com/biz/tang-dublin",
    dishes:[
      // Su pedido online oficial solo lista el menu de mediodia:
      dish("Half Bean & Half Chicken Flatbread", 8.95, "https://tangfood.clickandcollection.com/menus/lunch", "web"),
      dish("Selection of Daily Salads", 8.50, "https://tangfood.clickandcollection.com/menus/lunch", "web")
    ]},
  { id:"bread41", name:"Bread 41", cat:"brunch", rating:4.7, reviews:96, band:"€€",
    address:"41 Pearse St, Dublin 2", lat:53.344757, lon:-6.251778,
    source:"https://www.yelp.com/biz/bread-41-dublin",
    dishes:[
      dish("Croissant", 3.50, "https://bread41.ie/menu/", "carta"),
      dish("Almond Croissant", 5.10, "https://bread41.ie/menu/", "carta")
    ]},
  { id:"stage-door", name:"Stage Door Café", cat:"brunch", rating:4.6, reviews:149, band:"€€",
    address:"11-12 E Essex St, Temple Bar, Dublin 2", lat:53.34522, lon:-6.26599,
    source:"https://www.yelp.com/biz/stage-door-caf%C3%A9-dublin",
    dishes:[
      // Foto de la carta en el local (subida por usuarios, oct 2026):
      dish("Irish Breakfast", 14.95, "https://restaurantguru.com/Stage-Door-Cafe-Dublin/menu", "foto"),
      dish("Scrambled Eggs & Bacon", 12.95, "https://restaurantguru.com/Stage-Door-Cafe-Dublin/menu", "foto")
    ]},
  { id:"two-pups", name:"Two Pups Coffee", cat:"brunch", rating:4.6, reviews:65, band:"€",
    address:"74 Francis Street, Dublin 8", lat:53.3392392, lon:-6.2735820,
    source:"https://www.yelp.com/biz/two-pups-coffee-dublin",
    dishes:[
      // Su pedido online oficial lista cafeteria y bolleria, no brunch de carta:
      dish("BLT Bagel (takeaway)", 9.95, "https://order.toasttab.com/online/two-pups-francis-street", "toast"),
      dish("Croissant", 3.60, "https://order.toasttab.com/online/two-pups-francis-street", "toast")
    ]},
  { id:"lovinspoon", name:"The Lovinspoon", cat:"brunch", rating:4.6, reviews:132, band:"€",
    address:"13 N Frederick Street, Dublin 1", lat:53.355713, lon:-6.264602,
    source:"https://www.yelp.com/biz/the-lovinspoon-dublin",
    dishes:[
      // Foto de la pizarra del local (menu-pick, foto de ago 2026):
      dish("The Big (Full Irish Breakfast)", 11.50, "https://lovinspoon.menu-pick.com/menu", "foto"),
      dish("Pancakes with Bacon & Maple Syrup", 9.50, "https://lovinspoon.menu-pick.com/menu", "foto")
    ]},
  { id:"beanhive", name:"Beanhive", cat:"brunch", rating:4.6, reviews:148, band:"€€",
    address:"26 Dawson Street, Dublin 2", lat:53.339829, lon:-6.258777,
    source:"https://www.yelp.com/biz/beanhive-dublin",
    dishes:[
      // No sirven porridge; platos reales de su carta:
      dish("Breakfast Buzz (wrap)", 11.00, "https://www.beanhive.ie/menu", "carta"),
      dish("Irish Breakfast", 15.00, "https://www.beanhive.ie/menu", "carta")
    ]},
  { id:"alma", name:"Alma", cat:"brunch", rating:4.7, reviews:15, band:"€€",
    address:"12 S Circular Rd, Dublin 8", lat:53.33258, lon:-6.26911,
    source:"https://www.yelp.com/biz/alma-dublin",
    dishes:[
      // Pedido online oficial (Square, recogida); no hay benedictinos ni tostada de ricotta:
      dish("Alma's Poached Eggs", 16.40, "https://alma-cafe-limited.square.site/", "square"),
      dish("Dulce de Leche Pancakes", 16.20, "https://alma-cafe-limited.square.site/", "square")
    ]
  }
];
const DUBLIN_CENTER = { lat: 53.3498, lon: -6.2603 };
