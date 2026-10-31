[out:json][timeout:60];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food|pub|bar)$"]["menu"](53.18,-6.55,53.63,-6.04);
  nwr["amenity"~"^(restaurant|cafe|fast_food|pub|bar)$"]["contact:menu"](53.18,-6.55,53.63,-6.04);
);
out tags id;
