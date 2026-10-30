// Antojo - datos de demostracion (piloto Dublin centro)
// Restaurantes reales (fuente: Yelp, oct 2026). Precios de platos: MUESTRA,
// pendientes de verificacion (regla de frescura de 90 dias del plan Antojo).
const VENUES = [
  { id:"bunsen-anne", name:"Bunsen", cat:"hamburguesas", rating:4.6, reviews:82, band:"€€",
    address:"3 Anne Street S, Dublin 2", lat:53.341241, lon:-6.2601001,
    source:"https://www.yelp.com/biz/bunsen-dublin",
    dishes:[
      { name:"Hamburguesa doble con queso", price:12.50 },
      { name:"Hamburguesa clásica", price:10.50 }
    ]},
  { id:"bunsen-essex", name:"Bunsen (Temple Bar)", cat:"hamburguesas", rating:4.6, reviews:227, band:"€€",
    address:"22 Essex Street E, Temple Bar, Dublin 2", lat:53.3455885, lon:-6.2645026,
    source:"https://www.yelp.com/biz/bunsen-dublin-2",
    dishes:[
      { name:"Cheeseburger", price:10.95 },
      { name:"Hamburguesa doble", price:12.95 }
    ]},
  { id:"sheehans", name:"Sheehans", cat:"hamburguesas", rating:4.6, reviews:192, band:"€€",
    address:"17 Chatham Street, Dublin 2", lat:53.340967, lon:-6.26178,
    source:"https://www.yelp.com/biz/sheehans-dublin",
    dishes:[
      { name:"Hamburguesa de la casa", price:13.95 },
      { name:"Hamburguesa con bacon", price:14.95 }
    ]},
  { id:"mad-egg", name:"Mad Egg", cat:"hamburguesas", rating:4.5, reviews:29, band:"€",
    address:"Charlotte Way, Dublin 2", lat:53.333786, lon:-6.264654,
    source:"https://www.yelp.com/biz/mad-egg-dublin",
    dishes:[
      { name:"Hamburguesa de pollo frito", price:11.50 },
      { name:"Tenders de pollo", price:9.50 }
    ]},
  { id:"chimac", name:"Chimac", cat:"hamburguesas", rating:4.4, reviews:11, band:"€€",
    address:"76 Aungier St, Dublin 2", lat:53.34107, lon:-6.26577,
    source:"https://www.yelp.com/biz/chimac-dublin",
    dishes:[
      { name:"Sándwich de pollo coreano", price:12.00 },
      { name:"Pollo frito coreano", price:13.50 }
    ]},
  { id:"eatokyo", name:"Eatokyo", cat:"ramen", rating:4.6, reviews:50, band:"€€",
    address:"51 Wellington Quay, Temple Bar, Dublin 2", lat:53.3459999, lon:-6.26264,
    source:"https://www.yelp.com/biz/eatokyo-dublin",
    dishes:[
      { name:"Ramen tonkotsu", price:15.50 },
      { name:"Gyozas", price:7.50 }
    ]},
  { id:"takara", name:"Takara", cat:"ramen", rating:4.5, reviews:16, band:"€€",
    address:"37 Abbey Street Upper, Dublin 1", lat:53.3444426, lon:-6.2596904,
    source:"https://www.yelp.com/biz/takara-dublin",
    dishes:[
      { name:"Ramen shoyu", price:14.00 },
      { name:"Ramen miso", price:14.50 }
    ]},
  { id:"maneki", name:"Maneki", cat:"ramen", rating:4.4, reviews:11, band:"€€",
    address:"43 Dawson Street, Dublin 2", lat:53.34086, lon:-6.25862,
    source:"https://www.yelp.com/biz/maneki-dublin",
    dishes:[
      { name:"Ramen tonkotsu", price:15.00 },
      { name:"Katsu curry", price:14.50 }
    ]},
  { id:"musashi-capel", name:"Musashi", cat:"ramen", rating:4.1, reviews:163, band:"€€",
    address:"15 Capel Street, Dublin 1", lat:53.34695, lon:-6.26807,
    source:"https://www.yelp.com/biz/musashi-dublin",
    dishes:[
      { name:"Ramen", price:13.95 },
      { name:"Sushi variado", price:12.50 }
    ]},
  { id:"ramen-bar", name:"The Ramen Bar", cat:"ramen", rating:4.1, reviews:173, band:"€€",
    address:"51 William Street S, Dublin 2", lat:53.3416, lon:-6.26274,
    source:"https://www.yelp.com/biz/the-ramen-bar-dublin",
    dishes:[
      { name:"Ramen clásico", price:14.50 },
      { name:"Ramen picante", price:15.00 }
    ]},
  { id:"zakura", name:"Zakura Noodle & Sushi", cat:"ramen", rating:4.2, reviews:90, band:"€€",
    address:"13 Wexford Street, Dublin 2", lat:53.3369221, lon:-6.2654230,
    source:"https://www.yelp.com/biz/zakura-noodle-and-sushi-dublin",
    dishes:[
      { name:"Ramen", price:14.00 },
      { name:"Bao buns", price:8.50 }
    ]},
  { id:"banyi", name:"Banyi Japanese Dining", cat:"ramen", rating:4.2, reviews:82, band:"€€",
    address:"3-4 Bedford Row, Temple Bar, Dublin 2", lat:53.34601, lon:-6.26198,
    source:"https://www.yelp.com/biz/banyi-japanese-dining-dublin",
    dishes:[
      { name:"Ramen", price:14.50 },
      { name:"Tempura", price:8.00 }
    ]},
  { id:"little-kitchen", name:"The Little Kitchen", cat:"brunch", rating:4.7, reviews:47, band:"€€",
    address:"129 Leeson Street Upper, Dublin", lat:53.33036, lon:-6.25152,
    source:"https://www.yelp.com/biz/the-little-kitchen-dublin",
    dishes:[
      { name:"Huevos benedictinos", price:12.50 },
      { name:"Pancakes", price:10.50 }
    ]},
  { id:"tang", name:"Tang", cat:"brunch", rating:4.7, reviews:77, band:"€€",
    address:"23 Dawson Street, Dublin 2", lat:53.3394928, lon:-6.2588516,
    source:"https://www.yelp.com/biz/tang-dublin",
    dishes:[
      { name:"Tostada de aguacate", price:11.00 },
      { name:"Bowl de desayuno", price:12.50 }
    ]},
  { id:"bread41", name:"Bread 41", cat:"brunch", rating:4.7, reviews:96, band:"€€",
    address:"41 Pearse St, Dublin 2", lat:53.344757, lon:-6.251778,
    source:"https://www.yelp.com/biz/bread-41-dublin",
    dishes:[
      { name:"Croissant", price:4.20 },
      { name:"Tostada de masa madre", price:9.50 }
    ]},
  { id:"stage-door", name:"Stage Door Café", cat:"brunch", rating:4.6, reviews:149, band:"€€",
    address:"11-12 E Essex St, Temple Bar, Dublin 2", lat:53.34522, lon:-6.26599,
    source:"https://www.yelp.com/biz/stage-door-caf%C3%A9-dublin",
    dishes:[
      { name:"Desayuno completo irlandés", price:13.50 },
      { name:"Huevos benedictinos", price:12.00 }
    ]},
  { id:"two-pups", name:"Two Pups Coffee", cat:"brunch", rating:4.6, reviews:65, band:"€",
    address:"74 Francis Street, Dublin 8", lat:53.3392392, lon:-6.2735820,
    source:"https://www.yelp.com/biz/two-pups-coffee-dublin",
    dishes:[
      { name:"Huevos turcos", price:12.00 },
      { name:"Tostada de aguacate", price:10.50 }
    ]},
  { id:"lovinspoon", name:"The Lovinspoon", cat:"brunch", rating:4.6, reviews:132, band:"€",
    address:"13 N Frederick Street, Dublin 1", lat:53.355713, lon:-6.264602,
    source:"https://www.yelp.com/biz/the-lovinspoon-dublin",
    dishes:[
      { name:"Desayuno irlandés", price:12.50 },
      { name:"Pancakes", price:9.50 }
    ]},
  { id:"beanhive", name:"Beanhive", cat:"brunch", rating:4.6, reviews:148, band:"€€",
    address:"26 Dawson Street, Dublin 2", lat:53.339829, lon:-6.258777,
    source:"https://www.yelp.com/biz/beanhive-dublin",
    dishes:[
      { name:"Wrap de desayuno", price:9.50 },
      { name:"Porridge", price:6.50 }
    ]},
  { id:"alma", name:"Alma", cat:"brunch", rating:4.7, reviews:15, band:"€€",
    address:"12 S Circular Rd, Dublin 8", lat:53.33258, lon:-6.26911,
    source:"https://www.yelp.com/biz/alma-dublin",
    dishes:[
      { name:"Huevos benedictinos", price:13.00 },
      { name:"Tostada de ricotta", price:11.00 }
    ]}
];
const DUBLIN_CENTER = { lat: 53.3498, lon: -6.2603 };
