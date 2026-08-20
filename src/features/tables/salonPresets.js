// PORT DIRECTO · TU BODA ORGANIZADA → PLANNER
// Fuente funcional: src/App.jsx del producto original.
// Esta capa conserva los 15 presets Stage 2, sus coordenadas exactReference,
// número de mesas, capacidades base, medidas sugeridas y regla de capacidad.
// Solo se adapta el formato de salida al modelo relacional del SaaS.

export const EXACT_REF = { x:70, y:145, w:1660, h:970 }
export const EXACT_ASPECT = EXACT_REF.h / EXACT_REF.w
export const EXACT_ROOM_WIDTHS = { compact:26, recommended:30, spacious:34, premium:38 }
export const PRESET_STAGE2_ORDER = ["clasica_elegante", "boho_chic", "rustica_campo", "minimalista_moderno", "jardin_romantico", "playa_tropical", "industrial_chic", "vintage_romantico", "glam_lujo", "mediterranea", "japandi", "eco_sustentable", "fiesta_latina", "luces_fairy_noche", "micro_wedding_boutique"]

export function getExactReferenceRoomSize(guestCount=150, roomSizeOption='recommended') {
  const baseW=EXACT_ROOM_WIDTHS[roomSizeOption] || EXACT_ROOM_WIDTHS.recommended
  const guests=Number(guestCount)||150
  const guestBoost=guests>=250?4:guests>=200?2:0
  const W=+(baseW+guestBoost).toFixed(2)
  const H=+(W*EXACT_ASPECT).toFixed(2)
  return {W,H,area:+(W*H).toFixed(0),label:`Plano editable ${W} × ${H} m`}
}

export const SALON_PRESETS = [{"id":"clasica_elegante","label":"Clásica elegante","emoji":"💐","pattern":"symmetric","salon":"salón formal · hotel · ballroom claro","vibe":"Clásico · elegante","space":"Salón formal, hotel o ballroom rectangular","idealPax":"120–250","tip":"Eje central ceremonial, mesa de novios destacada y pista protagonista. Es el preset más equilibrado y protocolar.","image":"/presets/clasica_elegante.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"altar-1","tipo":"altar","box":[785,165,1015,320],"label":"Altar floral"},{"id":"camino-1","tipo":"camino","box":[842,310,958,675],"label":"Camino central","nonPhysical":true},{"id":"sillas-cer-izq","tipo":"sillas_cer","box":[445,318,785,642],"label":"Sillas ceremonia"},{"id":"sillas-cer-der","tipo":"sillas_cer","box":[1015,318,1355,642],"label":"Sillas ceremonia"},{"id":"novios-1","tipo":"novios","box":[720,655,1080,695],"label":"Mesa novios"},{"id":"pista-1","tipo":"pista","box":[710,720,1090,1010],"label":"Pista central"},{"id":"dj-1","tipo":"escenario","box":[720,1018,1080,1090],"label":"DJ / Banda"},{"id":"barra-1","tipo":"bar","box":[1290,590,1600,690],"label":"Bar"},{"id":"buffet-1","tipo":"buffet","box":[200,590,510,690],"label":"Buffet"},{"id":"photobooth-1","tipo":"photobooth","box":[1460,950,1630,1090],"label":"Photo spot"},{"id":"piano-clasico-1","tipo":"piano","box":[610,1018,690,1090],"label":"Piano"},{"id":"cello-clasico-1","tipo":"cello","box":[1110,1018,1160,1090],"label":"Cello"}],"tables":[{"tipo":"round","cx":360,"cy":780,"r":58,"cap":8,"label":""},{"tipo":"round","cx":520,"cy":810,"r":58,"cap":8,"label":""},{"tipo":"round","cx":1280,"cy":780,"r":58,"cap":8,"label":""},{"tipo":"round","cx":1440,"cy":810,"r":58,"cap":8,"label":""},{"tipo":"round","cx":410,"cy":980,"r":58,"cap":8,"label":""},{"tipo":"round","cx":1390,"cy":980,"r":58,"cap":8,"label":""}]},{"id":"boho_chic","label":"Boho chic","emoji":"🌾","pattern":"organic","salon":"jardín · terraza · carpa relajada","vibe":"Boho · orgánico","space":"Jardín, terraza, quinta o carpa relajada","idealPax":"80–180","tip":"Mesas largas, alfombras y lounge bajo para una boda cálida, descontracturada y fotogénica.","image":"/presets/boho_chic.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"altar-textil-1","tipo":"altar","box":[235,210,445,395],"label":"Altar textil"},{"id":"camino-1","tipo":"camino","box":[472,290,568,580],"label":"Camino boho","nonPhysical":true},{"id":"alfombra-1","tipo":"alfombra","box":[600,250,1030,340],"label":"Alfombra","nonPhysical":true},{"id":"alfombra-2","tipo":"alfombra","box":[680,370,1110,460],"label":"Alfombra","nonPhysical":true},{"id":"alfombra-3","tipo":"alfombra","box":[760,490,1190,580],"label":"Alfombra","nonPhysical":true},{"id":"pista-1","tipo":"pista","box":[1120,325,1510,595],"label":"Pista alfombra"},{"id":"barra-1","tipo":"bar","box":[1330,930,1600,1035],"label":"Bar gin"},{"id":"buffet-1","tipo":"buffet","box":[200,930,480,1035],"label":"Mesa dulce"},{"id":"flores-1","tipo":"flores","box":[144,194,216,266],"label":"Plantas","nonPhysical":true},{"id":"flores-2","tipo":"flores","box":[1465,205,1535,275],"label":"Plantas","nonPhysical":true},{"id":"sofa3-boho-1","tipo":"sofa_3","box":[1280,710,1565,755],"label":"Sofá 3 cuerpos"},{"id":"sofa2-boho-1","tipo":"sofa_2","box":[1285,780,1460,825],"label":"Sofá 2 cuerpos"},{"id":"mesita-boho-1","tipo":"mesita","box":[1490,770,1560,840],"label":"Mesita"}],"tables":[{"tipo":"rect_h","box":[230,700,690,765],"cap":16,"label":"Mesa larga"},{"tipo":"rect_h","box":[820,690,1280,755],"cap":16,"label":"Mesa larga"},{"tipo":"rect_h","box":[480,860,940,925],"cap":16,"label":"Mesa larga"},{"tipo":"rect_h","box":[1070,850,1530,915],"cap":16,"label":"Mesa larga"}]},{"id":"rustica_campo","label":"Rústica de campo","emoji":"🪵","pattern":"banquet_rows","salon":"estancia · quincho · jardín amplio","vibe":"Rústico · campo","space":"Estancia, quincho, granero chic o jardín amplio","idealPax":"100–220","tip":"Tablones comunitarios, buffet/parrilla y zona lounge para un clima de campo elegante.","image":"/presets/rustica_campo.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"altar-madera-1","tipo":"altar","box":[770,185,1030,365],"label":"Altar de madera"},{"id":"camino-1","tipo":"camino","box":[840,345,960,650],"label":"Camino rústico","nonPhysical":true},{"id":"sillas-campo-izq","tipo":"sillas_cer","box":[305,360,760,625],"label":"Sillas campo"},{"id":"sillas-campo-der","tipo":"sillas_cer","box":[1040,360,1495,625],"label":"Sillas campo"},{"id":"pista-1","tipo":"pista","box":[720,660,1080,760],"label":"Primer baile"},{"id":"barra-1","tipo":"bar","box":[170,370,350,650],"label":"Bar rústico"},{"id":"buffet-1","tipo":"buffet","box":[1450,370,1630,650],"label":"Parrilla / Buffet"},{"id":"torta-1","tipo":"torta","box":[180,835,420,965],"label":"Mesa dulce"},{"id":"sofa3-rustico-1","tipo":"sofa_3","box":[1440,790,1620,845],"label":"Sofá fogón"},{"id":"mesita-rustica-1","tipo":"mesita","box":[1510,860,1580,930],"label":"Mesita fogón"},{"id":"sofa2-rustico-1","tipo":"sofa_2","box":[1460,995,1625,1045],"label":"Sofá 2 cuerpos"}],"tables":[{"tipo":"rect_h","box":[260,780,530,840],"cap":12,"label":"Comunitaria"},{"tipo":"rect_h","box":[610,780,880,840],"cap":12,"label":"Comunitaria"},{"tipo":"rect_h","box":[960,780,1230,840],"cap":12,"label":"Comunitaria"},{"tipo":"rect_h","box":[1310,780,1580,840],"cap":12,"label":"Comunitaria"},{"tipo":"rect_h","box":[260,925,530,985],"cap":12,"label":"Comunitaria"},{"tipo":"rect_h","box":[610,925,880,985],"cap":12,"label":"Comunitaria"},{"tipo":"rect_h","box":[960,925,1230,985],"cap":12,"label":"Comunitaria"},{"tipo":"rect_h","box":[1310,925,1580,985],"cap":12,"label":"Comunitaria"}]},{"id":"minimalista_moderno","label":"Minimalista moderno","emoji":"◻️","pattern":"banquet_rows","salon":"loft blanco · galería · salón contemporáneo","vibe":"Minimal · moderno","space":"Loft blanco, galería o salón contemporáneo","idealPax":"100–200","tip":"Pocas piezas, mucho aire y líneas limpias. Ideal si querés que el plano se vea editorial y ordenado.","image":"/presets/minimalista_moderno.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"altar-geo-1","tipo":"backing","box":[760,220,1040,285],"label":"Altar geométrico"},{"id":"camino-1","tipo":"camino","box":[860,285,940,620],"label":"Eje central","nonPhysical":true},{"id":"sillas-min-izq","tipo":"sillas_cer","box":[320,310,680,535],"label":"Sillas lineales"},{"id":"sillas-min-der","tipo":"sillas_cer","box":[1170,310,1530,535],"label":"Sillas lineales"},{"id":"pista-1","tipo":"pista","box":[720,650,1080,930],"label":"Pista limpia"},{"id":"dj-1","tipo":"escenario","box":[720,950,1080,1020],"label":"DJ"},{"id":"barra-1","tipo":"bar","box":[1250,250,1550,335],"label":"Bar"},{"id":"buffet-1","tipo":"buffet","box":[250,250,550,335],"label":"Buffet"},{"id":"photobooth-1","tipo":"photobooth","box":[1420,960,1570,1080],"label":"Foto"}],"tables":[{"tipo":"rect_h","box":[260,730,600,790],"cap":12,"label":"Mesa A"},{"tipo":"rect_h","box":[260,880,600,940],"cap":12,"label":"Mesa B"},{"tipo":"rect_h","box":[1200,730,1540,790],"cap":12,"label":"Mesa C"},{"tipo":"rect_h","box":[1200,880,1540,940],"cap":12,"label":"Mesa D"}]},{"id":"jardin_romantico","label":"Jardín romántico","emoji":"🌿","pattern":"organic","salon":"jardín · pérgola · carpa clara","vibe":"Jardín · romántico","space":"Jardín techado, pérgola o carpa clara","idealPax":"100–220","tip":"La vegetación, las luces y el camino floral ordenan el espacio en micro-escenas románticas.","image":"/presets/jardin_romantico.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"pergola-1","tipo":"altar","box":[775,175,1025,350],"label":"Pérgola"},{"id":"camino-floral-1","tipo":"camino","box":[835,300,965,720],"label":"Camino floral","nonPhysical":true},{"id":"pista-1","tipo":"pista","box":[735,725,1065,850],"label":"Pista / brindis"},{"id":"dj-1","tipo":"escenario","box":[735,875,1065,940],"label":"Música acústica"},{"id":"barra-1","tipo":"bar","box":[1315,675,1565,790],"label":"Bar floral"},{"id":"luces-1","tipo":"luces","box":[330,300,1470,390],"label":"Guirnalda","nonPhysical":true},{"id":"luces-2","tipo":"luces","box":[330,920,1470,1010],"label":"Guirnalda","nonPhysical":true},{"id":"flores-1","tipo":"flores","box":[165,195,255,285],"label":"Verde","nonPhysical":true},{"id":"flores-2","tipo":"flores","box":[1545,195,1635,285],"label":"Verde","nonPhysical":true},{"id":"sofa3-jardin-1","tipo":"sofa_3","box":[250,695,470,732],"label":"Sofá jardín"},{"id":"sofa2-jardin-1","tipo":"sofa_2","box":[260,748,380,785],"label":"Sofá 2 cuerpos"},{"id":"mesita-jardin-1","tipo":"mesita","box":[395,742,455,802],"label":"Mesita"},{"id":"piano-jardin-1","tipo":"piano","box":[1075,860,1160,940],"label":"Piano"},{"id":"cello-jardin-1","tipo":"cello","box":[670,860,715,940],"label":"Cello"}],"tables":[{"tipo":"round","cx":420,"cy":410,"r":55,"cap":8,"label":""},{"tipo":"round","cx":590,"cy":520,"r":55,"cap":8,"label":""},{"tipo":"round","cx":1210,"cy":410,"r":55,"cap":8,"label":""},{"tipo":"round","cx":1380,"cy":520,"r":55,"cap":8,"label":""},{"tipo":"round","cx":420,"cy":800,"r":55,"cap":8,"label":""},{"tipo":"round","cx":590,"cy":920,"r":55,"cap":8,"label":""},{"tipo":"round","cx":1210,"cy":800,"r":55,"cap":8,"label":""},{"tipo":"round","cx":1380,"cy":920,"r":55,"cap":8,"label":""},{"tipo":"round","cx":900,"cy":900,"r":55,"cap":8,"label":""}]},{"id":"playa_tropical","label":"Playa tropical","emoji":"🌴","pattern":"organic","salon":"playa · deck · resort frente al mar","vibe":"Tropical · playa","space":"Resort, playa, deck o terraza con vista","idealPax":"80–180","tip":"Altar orientado al horizonte, mesas livianas y barra fresca. Priorizá sombra y circulación informal.","image":"/presets/playa_tropical.jpg","elements":[{"id":"horizonte-mar","tipo":"exterior","box":[90,160,1710,250],"label":"Horizonte / mar","nonPhysical":true},{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"altar-mar-1","tipo":"altar","box":[770,250,1030,380],"label":"Altar al mar"},{"id":"camino-arena-1","tipo":"camino","box":[832,395,968,690],"label":"Camino arena","nonPhysical":true},{"id":"sillas-playa-izq","tipo":"sillas_cer","box":[300,425,745,625],"label":"Sillas playa"},{"id":"sillas-playa-der","tipo":"sillas_cer","box":[1055,425,1500,625],"label":"Sillas playa"},{"id":"pista-1","tipo":"pista","box":[740,760,1060,970],"label":"Dance deck"},{"id":"dj-1","tipo":"escenario","box":[740,990,1060,1060],"label":"DJ sunset"},{"id":"barra-1","tipo":"bar","box":[1340,280,1580,380],"label":"Bar tropical"},{"id":"buffet-1","tipo":"buffet","box":[220,280,460,380],"label":"Ceviche / frutas"},{"id":"palmera-1","tipo":"flores","box":[175,615,245,685],"label":"Palmera","nonPhysical":true},{"id":"palmera-2","tipo":"flores","box":[1555,615,1625,685],"label":"Palmera","nonPhysical":true}],"tables":[{"tipo":"round","cx":340,"cy":820,"r":50,"cap":7,"label":""},{"tipo":"round","cx":520,"cy":920,"r":50,"cap":7,"label":""},{"tipo":"round","cx":1280,"cy":820,"r":50,"cap":7,"label":""},{"tipo":"round","cx":1460,"cy":920,"r":50,"cap":7,"label":""},{"tipo":"round","cx":450,"cy":1040,"r":50,"cap":7,"label":""},{"tipo":"round","cx":1350,"cy":1040,"r":50,"cap":7,"label":""}]},{"id":"industrial_chic","label":"Industrial chic","emoji":"🏙️","pattern":"banquet_rows","salon":"galpón · warehouse · loft urbano","vibe":"Industrial · urbano","space":"Galpón, warehouse, loft o espacio de ladrillo/hierro","idealPax":"120–240","tip":"Pista central, escenario visible, barras laterales y estética fuerte de luces/truss.","image":"/presets/industrial_chic.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"escenario-led-1","tipo":"escenario","box":[680,200,1120,305],"label":"Escenario / LED"},{"id":"pista-1","tipo":"pista","box":[660,390,1140,730],"label":"Pista central"},{"id":"truss-1","tipo":"luces","box":[620,350,1180,370],"label":"Truss de luces","nonPhysical":true},{"id":"barra-1","tipo":"bar","box":[1250,920,1630,1035],"label":"Bar de autor"},{"id":"buffet-1","tipo":"buffet","box":[170,920,550,1035],"label":"Food station"},{"id":"photobooth-1","tipo":"photobooth","box":[1300,190,1585,320],"label":"Neón / foto"}],"tables":[{"tipo":"round","cx":310,"cy":385,"r":50,"cap":8,"label":""},{"tipo":"round","cx":470,"cy":515,"r":50,"cap":8,"label":""},{"tipo":"round","cx":310,"cy":645,"r":50,"cap":8,"label":""},{"tipo":"round","cx":470,"cy":775,"r":50,"cap":8,"label":""},{"tipo":"round","cx":1330,"cy":385,"r":50,"cap":8,"label":""},{"tipo":"round","cx":1490,"cy":515,"r":50,"cap":8,"label":""},{"tipo":"round","cx":1330,"cy":645,"r":50,"cap":8,"label":""},{"tipo":"round","cx":1490,"cy":775,"r":50,"cap":8,"label":""},{"tipo":"rect_h","box":[560,830,1240,895],"cap":18,"label":"Mesa industrial larga"},{"tipo":"rect_h","box":[560,970,1240,1035],"cap":18,"label":"Mesa industrial larga"}]},{"id":"vintage_romantico","label":"Vintage romántico","emoji":"🕯️","pattern":"ring","salon":"salón íntimo · casa antigua · jardín boutique","vibe":"Vintage · íntimo","space":"Casa antigua, salón boutique o jardín pequeño","idealPax":"60–160","tip":"Rincones de fotos, lounge antiguo y mesas pequeñas para una boda familiar y nostálgica.","image":"/presets/vintage_romantico.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"altar-vintage-1","tipo":"altar","box":[785,165,1015,325],"label":"Altar vintage"},{"id":"camino-vintage-1","tipo":"camino","box":[845,315,955,590],"label":"Camino vintage","nonPhysical":true},{"id":"sillas-vintage-izq","tipo":"sillas_cer","box":[290,315,790,570],"label":"Sillas curvas"},{"id":"sillas-vintage-der","tipo":"sillas_cer","box":[1010,315,1510,570],"label":"Sillas curvas"},{"id":"pista-1","tipo":"pista","box":[745,650,1055,845],"label":"Pista"},{"id":"dj-1","tipo":"escenario","box":[745,860,1055,925],"label":"Trío / DJ"},{"id":"photobooth-1","tipo":"photobooth","box":[1365,520,1600,660],"label":"Marco vintage"},{"id":"buffet-1","tipo":"buffet","box":[220,1000,560,1080],"label":"Mesa dulce"},{"id":"barra-1","tipo":"bar","box":[1240,1000,1580,1080],"label":"Champagne"},{"id":"sofa3-vintage-1","tipo":"sofa_3","box":[205,535,395,578],"label":"Sofá antiguo"},{"id":"mesita-vintage-1","tipo":"mesita","box":[270,588,340,658],"label":"Mesita"},{"id":"sofa2-vintage-1","tipo":"sofa_2","box":[210,670,375,718],"label":"Sofá 2 cuerpos"},{"id":"piano-vintage-1","tipo":"piano","box":[650,850,735,925],"label":"Piano"},{"id":"cello-vintage-1","tipo":"cello","box":[1070,850,1125,925],"label":"Cello"}],"tables":[{"tipo":"round","cx":300,"cy":760,"r":52,"cap":7,"label":""},{"tipo":"round","cx":500,"cy":900,"r":52,"cap":7,"label":""},{"tipo":"round","cx":720,"cy":780,"r":52,"cap":7,"label":""},{"tipo":"round","cx":1080,"cy":780,"r":52,"cap":7,"label":""},{"tipo":"round","cx":1300,"cy":900,"r":52,"cap":7,"label":""},{"tipo":"round","cx":1500,"cy":760,"r":52,"cap":7,"label":""},{"tipo":"round","cx":900,"cy":960,"r":52,"cap":7,"label":""}]},{"id":"glam_lujo","label":"Glam lujo","emoji":"✨","pattern":"symmetric","salon":"ballroom premium · boda nocturna · gala","vibe":"Glam · lujo","space":"Ballroom premium, salón oscuro o gala nocturna","idealPax":"150–300","tip":"Gran pista, recorrido de impacto, simetría y elementos dorados/escénicos.","image":"/presets/glam_lujo.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"eje-vertical","tipo":"alfombra","box":[850,160,950,1090],"label":"Eje dorado","nonPhysical":true},{"id":"eje-horizontal","tipo":"alfombra","box":[190,590,1610,690],"label":"Eje dorado","nonPhysical":true},{"id":"escenario-premium-1","tipo":"escenario","box":[635,190,1165,320],"label":"Escenario premium"},{"id":"pista-1","tipo":"pista","box":[650,440,1150,820],"label":"Gran pista"},{"id":"novios-1","tipo":"novios","box":[610,850,1190,920],"label":"Mesa principal"},{"id":"barra-1","tipo":"bar","box":[1260,250,1580,350],"label":"Bar dorado"},{"id":"buffet-1","tipo":"buffet","box":[220,250,540,350],"label":"Caviar / canapés"},{"id":"photobooth-1","tipo":"photobooth","box":[1260,990,1580,1080],"label":"Photocall"},{"id":"sofa3-glam-1","tipo":"sofa_3","box":[235,1005,430,1060],"label":"Sofá VIP"},{"id":"mesita-glam-1","tipo":"mesita","box":[455,1010,515,1070],"label":"Mesita VIP"}],"tables":[{"tipo":"round","cx":270,"cy":430,"r":58,"cap":8,"label":""},{"tipo":"round","cx":460,"cy":420,"r":58,"cap":8,"label":""},{"tipo":"round","cx":270,"cy":720,"r":58,"cap":8,"label":""},{"tipo":"round","cx":460,"cy":735,"r":58,"cap":8,"label":""},{"tipo":"round","cx":1340,"cy":420,"r":58,"cap":8,"label":""},{"tipo":"round","cx":1530,"cy":430,"r":58,"cap":8,"label":""},{"tipo":"round","cx":1340,"cy":735,"r":58,"cap":8,"label":""},{"tipo":"round","cx":1530,"cy":720,"r":58,"cap":8,"label":""},{"tipo":"round","cx":320,"cy":950,"r":58,"cap":8,"label":""},{"tipo":"round","cx":1480,"cy":950,"r":58,"cap":8,"label":""}]},{"id":"mediterranea","label":"Mediterránea","emoji":"🍋","pattern":"ring","salon":"terraza · patio europeo · exterior cálido","vibe":"Mediterráneo · familiar","space":"Terraza, patio europeo, jardín o salón abierto","idealPax":"80–180","tip":"Plaza central, olivos/limoneros y mesas conversacionales para sensación de sobremesa europea.","image":"/presets/mediterranea.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"plaza-central","tipo":"exterior","box":[685,330,1115,760],"label":"Plaza central","nonPhysical":true},{"id":"arco-olivos-1","tipo":"altar","box":[785,180,1015,320],"label":"Arco olivos"},{"id":"camino-olivos-1","tipo":"camino","box":[850,320,950,475],"label":"Camino olivos","nonPhysical":true},{"id":"barra-1","tipo":"bar","box":[1260,230,1585,330],"label":"Aperol / vinos"},{"id":"buffet-1","tipo":"buffet","box":[215,230,540,330],"label":"Antipasti"},{"id":"dj-1","tipo":"escenario","box":[700,1040,1100,1090],"label":"Música italiana"},{"id":"olivo-1","tipo":"flores","box":[166,546,234,614],"label":"Olivo","nonPhysical":true},{"id":"olivo-2","tipo":"flores","box":[1566,546,1634,614],"label":"Olivo","nonPhysical":true},{"id":"sofa3-mediterranea-1","tipo":"sofa_3","box":[235,980,455,1030],"label":"Sofá patio"},{"id":"mesita-mediterranea-1","tipo":"mesita","box":[480,980,545,1045],"label":"Mesita"}],"tables":[{"tipo":"round","cx":350,"cy":400,"r":53,"cap":8,"label":""},{"tipo":"round","cx":520,"cy":570,"r":53,"cap":8,"label":""},{"tipo":"round","cx":350,"cy":760,"r":53,"cap":8,"label":""},{"tipo":"round","cx":520,"cy":930,"r":53,"cap":8,"label":""},{"tipo":"round","cx":1280,"cy":570,"r":53,"cap":8,"label":""},{"tipo":"round","cx":1450,"cy":400,"r":53,"cap":8,"label":""},{"tipo":"round","cx":1450,"cy":760,"r":53,"cap":8,"label":""},{"tipo":"round","cx":1280,"cy":930,"r":53,"cap":8,"label":""},{"tipo":"round","cx":900,"cy":940,"r":53,"cap":8,"label":""},{"tipo":"rect_h","box":[670,805,1130,865],"cap":14,"label":"Mesa familiar"}]},{"id":"japandi","label":"Japandi","emoji":"🎋","pattern":"banquet_rows","salon":"boutique · minimal cálido · ceremonia íntima","vibe":"Japandi · zen","space":"Espacio boutique, minimal cálido o restaurante elegante","idealPax":"50–140","tip":"Simplicidad, mesas lineales y vegetación puntual. Ideal para una boda serena y muy cuidada.","image":"/presets/japandi.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"jardin-zen-1","tipo":"exterior","box":[790,190,1010,555],"label":"Jardín zen","nonPhysical":true},{"id":"altar-simple-1","tipo":"altar","box":[800,190,1000,325],"label":"Altar simple"},{"id":"camino-zen-1","tipo":"camino","box":[852,320,948,570],"label":"Camino zen","nonPhysical":true},{"id":"pista-1","tipo":"pista","box":[720,935,1080,1055],"label":"Espacio ritual"},{"id":"barra-1","tipo":"bar","box":[1280,940,1555,1060],"label":"Bar sake"},{"id":"sofa2-japandi-1","tipo":"sofa_2","box":[260,955,440,1000],"label":"Sofá té"},{"id":"mesita-japandi-1","tipo":"mesita","box":[330,1010,395,1075],"label":"Mesita té"}],"tables":[{"tipo":"rect_h","box":[260,680,510,735],"cap":8,"label":"Mesa baja"},{"tipo":"rect_h","box":[570,680,820,735],"cap":8,"label":"Mesa baja"},{"tipo":"rect_h","box":[970,680,1220,735],"cap":8,"label":"Mesa baja"},{"tipo":"rect_h","box":[1280,680,1530,735],"cap":8,"label":"Mesa baja"},{"tipo":"rect_h","box":[260,840,510,895],"cap":8,"label":"Mesa baja"},{"tipo":"rect_h","box":[570,840,820,895],"cap":8,"label":"Mesa baja"},{"tipo":"rect_h","box":[970,840,1220,895],"cap":8,"label":"Mesa baja"},{"tipo":"rect_h","box":[1280,840,1530,895],"cap":8,"label":"Mesa baja"}]},{"id":"eco_sustentable","label":"Eco sustentable","emoji":"♻️","pattern":"banquet_rows","salon":"jardín · carpa natural · venue sustentable","vibe":"Eco · natural","space":"Jardín, carpa natural o venue sustentable","idealPax":"80–180","tip":"Plantas vivas, estaciones reutilizables, reciclaje/compost y mesas compartidas.","image":"/presets/eco_sustentable.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"altar-vivo-1","tipo":"altar","box":[780,175,1020,325],"label":"Altar vivo"},{"id":"camino-verde-1","tipo":"camino","box":[840,325,960,640],"label":"Camino verde","nonPhysical":true},{"id":"pista-1","tipo":"pista","box":[730,680,1070,930],"label":"Pista natural"},{"id":"dj-1","tipo":"escenario","box":[730,950,1070,1020],"label":"Música solar"},{"id":"buffet-1","tipo":"buffet","box":[190,345,470,470],"label":"Comida km 0"},{"id":"barra-1","tipo":"bar","box":[1330,345,1610,470],"label":"Agua / coctel"},{"id":"reciclaje-1","tipo":"backing","box":[190,520,470,620],"label":"Reciclaje + compost"},{"id":"plantas-regalo-1","tipo":"flores","box":[1330,520,1610,620],"label":"Regalos: plantas","nonPhysical":true}],"tables":[{"tipo":"rect_h","box":[330,720,790,778],"cap":14,"label":"Mesa compartida"},{"tipo":"rect_h","box":[1010,720,1470,778],"cap":14,"label":"Mesa compartida"},{"tipo":"rect_h","box":[330,870,790,928],"cap":14,"label":"Mesa compartida"},{"tipo":"rect_h","box":[1010,870,1470,928],"cap":14,"label":"Mesa compartida"},{"tipo":"rect_h","box":[330,1020,790,1078],"cap":14,"label":"Mesa compartida"},{"tipo":"rect_h","box":[1010,1020,1470,1078],"cap":14,"label":"Mesa compartida"}]},{"id":"fiesta_latina","label":"Fiesta latina","emoji":"🎉","pattern":"ring","salon":"salón social · fiesta con pista central","vibe":"Fiesta · latina","space":"Salón social, club o venue con buena pista","idealPax":"120–250","tip":"La pista domina el centro y todas las mesas miran hacia la celebración. Pensado para energía alta.","image":"/presets/fiesta_latina.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"escenario-fiesta-1","tipo":"escenario","box":[665,190,1135,315],"label":"Banda / DJ visible"},{"id":"pista-1","tipo":"pista","box":[570,365,1230,780],"label":"Pista de fiesta"},{"id":"barra-1","tipo":"bar","box":[190,960,490,1070],"label":"Bar social"},{"id":"buffet-1","tipo":"buffet","box":[1310,960,1610,1070],"label":"Tacos / snacks"},{"id":"photobooth-1","tipo":"photobooth","box":[190,200,450,330],"label":"Photobooth color"},{"id":"luces-1","tipo":"luces","box":[250,290,1550,350],"label":"Guirnalda","nonPhysical":true},{"id":"sofa3-fiesta-1","tipo":"sofa_3","box":[1365,220,1580,265],"label":"Sofá descanso"},{"id":"mesita-fiesta-1","tipo":"mesita","box":[1460,275,1530,345],"label":"Mesita"},{"id":"piano-fiesta-1","tipo":"piano","box":[600,200,685,300],"label":"Teclado / piano"}],"tables":[{"tipo":"round","cx":250,"cy":430,"r":55,"cap":8,"label":""},{"tipo":"round","cx":420,"cy":570,"r":55,"cap":8,"label":""},{"tipo":"round","cx":250,"cy":730,"r":55,"cap":8,"label":""},{"tipo":"round","cx":420,"cy":875,"r":55,"cap":8,"label":""},{"tipo":"round","cx":1380,"cy":570,"r":55,"cap":8,"label":""},{"tipo":"round","cx":1550,"cy":430,"r":55,"cap":8,"label":""},{"tipo":"round","cx":1550,"cy":730,"r":55,"cap":8,"label":""},{"tipo":"round","cx":1380,"cy":875,"r":55,"cap":8,"label":""},{"tipo":"round","cx":690,"cy":940,"r":55,"cap":8,"label":""},{"tipo":"round","cx":1110,"cy":940,"r":55,"cap":8,"label":""}]},{"id":"luces_fairy_noche","label":"Luces fairy / noche","emoji":"💡","pattern":"organic","salon":"jardín nocturno · exterior con guirnaldas","vibe":"Noche · fairy lights","space":"Jardín nocturno, patio o exterior con guirnaldas","idealPax":"100–220","tip":"Las guirnaldas ordenan el plano visualmente y crean rincones cálidos alrededor de la pista.","image":"/presets/luces_fairy_noche.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"altar-luz-1","tipo":"altar","box":[782,185,1018,335],"label":"Altar luz"},{"id":"camino-luz-1","tipo":"camino","box":[842,330,958,610],"label":"Camino luz","nonPhysical":true},{"id":"guirnalda-1","tipo":"luces","box":[210,200,1590,280],"label":"Guirnalda","nonPhysical":true},{"id":"guirnalda-2","tipo":"luces","box":[210,320,1590,400],"label":"Guirnalda","nonPhysical":true},{"id":"guirnalda-3","tipo":"luces","box":[210,440,1590,520],"label":"Guirnalda","nonPhysical":true},{"id":"guirnalda-4","tipo":"luces","box":[210,560,1590,640],"label":"Guirnalda","nonPhysical":true},{"id":"guirnalda-5","tipo":"luces","box":[210,800,1590,880],"label":"Guirnalda","nonPhysical":true},{"id":"guirnalda-6","tipo":"luces","box":[210,920,1590,1000],"label":"Guirnalda","nonPhysical":true},{"id":"pista-1","tipo":"pista","box":[730,700,1070,940],"label":"Pista iluminada"},{"id":"dj-1","tipo":"escenario","box":[730,960,1070,1030],"label":"DJ / luces"},{"id":"barra-1","tipo":"bar","box":[1340,525,1605,645],"label":"Bar noche"},{"id":"photobooth-1","tipo":"photobooth","box":[760,1030,1040,1090],"label":"Foto neón"},{"id":"sofa3-luces-1","tipo":"sofa_3","box":[215,540,435,580],"label":"Sofá cálido"},{"id":"sofa2-luces-1","tipo":"sofa_2","box":[225,610,380,650],"label":"Sofá 2 cuerpos"},{"id":"mesita-luces-1","tipo":"mesita","box":[392,590,455,653],"label":"Mesita"}],"tables":[{"tipo":"round","cx":320,"cy":720,"r":53,"cap":8,"label":""},{"tipo":"round","cx":510,"cy":820,"r":53,"cap":8,"label":""},{"tipo":"round","cx":700,"cy":720,"r":53,"cap":8,"label":""},{"tipo":"round","cx":1100,"cy":720,"r":53,"cap":8,"label":""},{"tipo":"round","cx":1290,"cy":820,"r":53,"cap":8,"label":""},{"tipo":"round","cx":1480,"cy":720,"r":53,"cap":8,"label":""},{"tipo":"round","cx":450,"cy":990,"r":53,"cap":8,"label":""},{"tipo":"round","cx":1350,"cy":990,"r":53,"cap":8,"label":""}]},{"id":"micro_wedding_boutique","label":"Micro wedding boutique","emoji":"🤍","pattern":"banquet_rows","salon":"boda íntima · restaurante · casa privada","vibe":"Boutique · íntimo","space":"Restaurante, casa privada o salón pequeño","idealPax":"20–80","tip":"Mesa imperial, ceremonia cercana y experiencia muy personalizada. Todo queda cerca y cuidado.","image":"/presets/micro_wedding_boutique.jpg","elements":[{"id":"entrada-1","tipo":"entrada","box":[850,1080,950,1115],"label":"Entrada"},{"id":"altar-cercano-1","tipo":"altar","box":[790,195,1010,335],"label":"Ceremonia cercana"},{"id":"camino-intimo-1","tipo":"camino","box":[855,340,945,520],"label":"Camino íntimo","nonPhysical":true},{"id":"sillas-intimas-izq","tipo":"sillas_cer","box":[500,355,785,475],"label":"Sillas íntimas"},{"id":"sillas-intimas-der","tipo":"sillas_cer","box":[1015,355,1300,475],"label":"Sillas íntimas"},{"id":"pista-1","tipo":"pista","box":[720,825,1080,995],"label":"Primer baile"},{"id":"dj-1","tipo":"escenario","box":[720,1015,1080,1080],"label":"Música en vivo"},{"id":"barra-1","tipo":"bar","box":[1300,790,1580,900],"label":"Bar boutique"},{"id":"buffet-1","tipo":"buffet","box":[1300,925,1580,1035],"label":"Mesa dulce"},{"id":"photobooth-1","tipo":"photobooth","box":[220,990,500,1080],"label":"Libro de firmas"},{"id":"sofa3-micro-1","tipo":"sofa_3","box":[235,810,455,855],"label":"Sofá boutique"},{"id":"sofa2-micro-1","tipo":"sofa_2","box":[235,905,405,950],"label":"Sofá 2 cuerpos"},{"id":"mesita-micro-1","tipo":"mesita","box":[420,880,480,940],"label":"Mesita"},{"id":"piano-micro-1","tipo":"piano","box":[635,1000,715,1080],"label":"Piano"},{"id":"cello-micro-1","tipo":"cello","box":[1090,1000,1140,1080],"label":"Cello"}],"tables":[{"tipo":"imperial","box":[530,675,1270,760],"cap":30,"label":"Mesa imperial / 20–45 invitados"}]}]

export const ROOM_SIZE_OPTIONS = {"100":{"compact":{"W":18,"H":13,"label":"Compacto 18 × 13 m"},"recommended":{"W":22,"H":16,"label":"Recomendado 22 × 16 m"},"spacious":{"W":26,"H":18,"label":"Amplio 26 × 18 m"},"premium":{"W":30,"H":20,"label":"Premium 30 × 20 m"}},"150":{"compact":{"W":22,"H":15,"label":"Compacto 22 × 15 m"},"recommended":{"W":26,"H":18,"label":"Recomendado 26 × 18 m"},"spacious":{"W":30,"H":20,"label":"Amplio 30 × 20 m"},"premium":{"W":34,"H":22,"label":"Premium 34 × 22 m"}},"200":{"compact":{"W":26,"H":17,"label":"Compacto 26 × 17 m"},"recommended":{"W":30,"H":20,"label":"Recomendado 30 × 20 m"},"spacious":{"W":34,"H":22,"label":"Amplio 34 × 22 m"},"premium":{"W":38,"H":24,"label":"Premium 38 × 24 m"}},"250":{"compact":{"W":30,"H":19,"label":"Compacto 30 × 19 m"},"recommended":{"W":34,"H":22,"label":"Recomendado 34 × 22 m"},"spacious":{"W":38,"H":24,"label":"Amplio 38 × 24 m"},"premium":{"W":42,"H":26,"label":"Premium 42 × 26 m"}},"300":{"compact":{"W":34,"H":21,"label":"Compacto 34 × 21 m"},"recommended":{"W":38,"H":23,"label":"Recomendado 38 × 23 m"},"spacious":{"W":42,"H":26,"label":"Amplio 42 × 26 m"},"premium":{"W":46,"H":28,"label":"Premium 46 × 28 m"}}}
export const GUEST_COUNT_OPTIONS = [100,150,200,250,300]
export const ROOM_SIZE_OPTION_LABELS = {
  compact:'Compacto',
  recommended:'Recomendado',
  spacious:'Amplio',
  premium:'Premium / gran salón',
}

export const SALON_SHAPES = [
  { id:'rectangle', label:'Rectángulo' },
  { id:'square', label:'Cuadrado' },
  { id:'L', label:'Forma L' },
  { id:'U', label:'Forma U' },
  { id:'oval', label:'Ovalado' },
]

export const L_SHAPE_OPTIONS = [
  { id:'cutTopRight', label:'Recorte arriba derecha' },
  { id:'cutTopLeft', label:'Recorte arriba izquierda' },
  { id:'cutBottomRight', label:'Recorte abajo derecha' },
  { id:'cutBottomLeft', label:'Recorte abajo izquierda' },
]
export const U_SHAPE_OPTIONS = [
  { id:'openTop', label:'U abierta arriba' },
  { id:'openBottom', label:'U abierta abajo' },
  { id:'openLeft', label:'U abierta izquierda' },
  { id:'openRight', label:'U abierta derecha' },
]

export const ELEMENT_CATALOG = [{"id":"novios","label":"Mesa novios","emoji":"💍","w":3.4,"h":0.9,"category":"Principales"},{"id":"presidencial","label":"Presidencial","emoji":"👑","w":5.2,"h":1.0,"category":"Principales"},{"id":"pista","label":"Pista baile","emoji":"💃","w":8,"h":6,"category":"Principales"},{"id":"escenario","label":"DJ / Escenario","emoji":"🎧","w":5,"h":2.5,"category":"Principales"},{"id":"entrada","label":"Entrada","emoji":"🚪","w":3,"h":0.8,"category":"Principales"},{"id":"torta","label":"Mesa de torta","emoji":"🎂","w":2.6,"h":1.5,"category":"Comida y bebida"},{"id":"postres","label":"Mesa dulce","emoji":"🧁","w":3.6,"h":1.4,"category":"Comida y bebida"},{"id":"bar","label":"Barra","emoji":"🍹","w":4,"h":2,"category":"Comida y bebida"},{"id":"cafeteria","label":"Cafetería","emoji":"☕","w":3,"h":1.5,"category":"Comida y bebida"},{"id":"buffet","label":"Buffet","emoji":"🍽️","w":4.6,"h":1.4,"category":"Comida y bebida"},{"id":"bebidas","label":"Bebidas","emoji":"🥂","w":3.2,"h":1.3,"category":"Comida y bebida"},{"id":"catering","label":"Catering","emoji":"👨‍🍳","w":3.8,"h":2,"category":"Comida y bebida"},{"id":"bienvenida","label":"Bienvenida","emoji":"🪧","w":2.8,"h":1.1,"category":"Decoración"},{"id":"regalos","label":"Mesa regalos","emoji":"🎁","w":2.6,"h":1.4,"category":"Decoración"},{"id":"photobooth","label":"Photobooth","emoji":"📸","w":3,"h":2,"category":"Decoración"},{"id":"cabina360","label":"Cabina 360","emoji":"🎥","w":2.6,"h":2.6,"category":"Decoración"},{"id":"activacion","label":"Activación","emoji":"✨","w":4,"h":2.5,"category":"Decoración"},{"id":"arco","label":"Arco floral","emoji":"🌸","w":3.6,"h":0.7,"category":"Decoración"},{"id":"flores","label":"Flores","emoji":"💐","w":1.3,"h":1.3,"category":"Decoración"},{"id":"centro_floral","label":"Centro floral","emoji":"🌷","w":1.6,"h":1.6,"category":"Decoración"},{"id":"backing","label":"Backing fotos","emoji":"✨","w":4.2,"h":0.8,"category":"Decoración"},{"id":"alfombra","label":"Camino / alfombra","emoji":"🟫","w":1.2,"h":7,"category":"Decoración"},{"id":"living","label":"Living lounge","emoji":"🛋️","w":3.8,"h":2.2,"category":"Lounge y música"},{"id":"sofa_2","label":"Sofá 2 cuerpos","emoji":"🛋️","w":2.2,"h":0.9,"category":"Lounge y música"},{"id":"sofa_3","label":"Sofá 3 cuerpos","emoji":"🛋️","w":3.2,"h":1,"category":"Lounge y música"},{"id":"mesita","label":"Mesita lounge","emoji":"◯","w":1,"h":1,"category":"Lounge y música"},{"id":"piano","label":"Piano","emoji":"🎹","w":2.3,"h":1.4,"category":"Lounge y música"},{"id":"cello","label":"Cello","emoji":"🎻","w":0.8,"h":1.4,"category":"Lounge y música"},{"id":"luces","label":"Luces","emoji":"💡","w":4,"h":0.6,"category":"Lounge y música"},{"id":"columnas","label":"Columnas","emoji":"🏺","w":1.2,"h":1.2,"category":"Lounge y música"},{"id":"banios","label":"Baños","emoji":"🚻","w":3,"h":2.5,"category":"Servicios"},{"id":"cocina","label":"Cocina","emoji":"🍽️","w":4,"h":3,"category":"Servicios"},{"id":"guardarropa","label":"Guardarropa","emoji":"🧥","w":3,"h":1.6,"category":"Servicios"},{"id":"proveedores","label":"Proveedores","emoji":"📦","w":3.2,"h":1.6,"category":"Servicios"},{"id":"mozos","label":"Mozos","emoji":"🤵","w":2.8,"h":1.4,"category":"Servicios"},{"id":"salida","label":"Salida","emoji":"🚪","w":3,"h":0.8,"category":"Servicios"},{"id":"emergencia","label":"Emergencia","emoji":"🧯","w":2.6,"h":1,"category":"Servicios"},{"id":"altar","label":"Altar","emoji":"🌸","w":5,"h":3.5,"category":"Ceremonia / zonas"},{"id":"sillas_cer","label":"Sillas ceremonia","emoji":"🪑","w":8,"h":4,"category":"Ceremonia / zonas"},{"id":"camino","label":"Camino central","emoji":"🤍","w":1.2,"h":7,"category":"Ceremonia / zonas"},{"id":"musicos","label":"Músicos ceremonia","emoji":"🎻","w":3,"h":1.4,"category":"Ceremonia / zonas"},{"id":"ninos","label":"Sector niños","emoji":"🧸","w":3.5,"h":2.2,"category":"Ceremonia / zonas"},{"id":"fumadores","label":"Área fumadores","emoji":"🌿","w":3,"h":2,"category":"Ceremonia / zonas"},{"id":"exterior","label":"Zona exterior","emoji":"🌳","w":5,"h":3,"category":"Ceremonia / zonas"}]

// Port directo de Tu Boda Organizada: tipos, capacidades y medidas base.
export const TABLE_VISUAL_TYPES = {
  round: { label:'Redonda', shortLabel:'REDONDA', icon:'○', dbShape:'round', width:1.8, height:1.8, defaultCapacity:10, capacities:[8,10,12] },
  square: { label:'Cuadrada', shortLabel:'CUADRADA', icon:'□', dbShape:'square', width:2.0, height:2.0, defaultCapacity:10, capacities:[8,10,12] },
  rect_h: { label:'Rectangular horizontal', shortLabel:'RECT. H', icon:'━', dbShape:'rectangular', width:5.4, height:0.9, defaultCapacity:20, capacities:[16,20,24,30] },
  rect_v: { label:'Rectangular vertical', shortLabel:'RECT. V', icon:'┃', dbShape:'rectangular', width:0.9, height:5.4, defaultCapacity:20, capacities:[16,20,24,30] },
  imperial: { label:'Imperial', shortLabel:'IMPERIAL', icon:'═', dbShape:'rectangular', width:8.4, height:1.1, defaultCapacity:30, capacities:[24,30,40] },
}

export function nearestGuestOption(value=150) {
  return GUEST_COUNT_OPTIONS.reduce((best,n)=>Math.abs(n-value)<Math.abs(best-value)?n:best,150)
}

export function getRoomSize(guestCount=150, option='recommended') {
  const key=nearestGuestOption(Number(guestCount)||150)
  return ROOM_SIZE_OPTIONS[key]?.[option] || ROOM_SIZE_OPTIONS[150].recommended
}

const pxToPctX=(px)=>((Number(px)-EXACT_REF.x)/EXACT_REF.w)*100
const pxToPctY=(px)=>((Number(px)-EXACT_REF.y)/EXACT_REF.h)*100
const pxWToPct=(px)=>Number(px)/EXACT_REF.w*100
const pxHToPct=(px)=>Number(px)/EXACT_REF.h*100

export function analyzeSalonCapacity({ widthM=26, heightM=18, guestCount=150, tables=[] }={}) {
  const guests=Math.max(0,Number(guestCount)||0)
  const width=Math.max(1,Number(widthM)||26), height=Math.max(1,Number(heightM)||18)
  const area=width*height
  const compact=getRoomSize(guests||150,'compact')
  const recommended=getRoomSize(guests||150,'recommended')
  const compactArea=Number(compact.W)*Number(compact.H)
  const recommendedArea=Number(recommended.W)*Number(recommended.H)
  const seats=(tables||[]).reduce((sum,table)=>sum+Math.max(0,Number(table.capacity)||0),0)
  const missing=Math.max(0,guests-seats)
  const warnings=[]
  let roomStatus='good'
  if(area<compactArea){
    roomStatus='small'
    warnings.push(`El ambiente es pequeño para ${guests} invitados. Como referencia operativa, probá al menos ${compact.W} × ${compact.H} m.`)
  }else if(area<recommendedArea){
    roomStatus='tight'
    warnings.push(`El ambiente puede quedar ajustado para ${guests} invitados. La medida recomendada es ${recommended.W} × ${recommended.H} m.`)
  }
  if(missing>0) warnings.push(`Faltan ${missing} lugares sentados para la cantidad de invitados activos.`)
  return {
    area:+area.toFixed(1), seats, missing, roomStatus,
    compact, recommended,
    enoughSeats:seats>=guests,
    warnings,
  }
}

function rectForItem(item,widthM,heightM,margin=0){
  const cx=(Number(item.pos_x)||50)/100*widthM
  const cy=(Number(item.pos_y)||50)/100*heightM
  const w=Math.max(.1,Number(item.width_m)||1)+margin*2
  const h=Math.max(.1,Number(item.height_m)||1)+margin*2
  return {x1:cx-w/2,y1:cy-h/2,x2:cx+w/2,y2:cy+h/2}
}
function rectsOverlap(a,b){ return !(a.x2<=b.x1 || a.x1>=b.x2 || a.y2<=b.y1 || a.y1>=b.y2) }
function normalizeTableDimensions(visualType,wM,hM){
  if(visualType==='round' || visualType==='square'){
    // Igual que Tu Boda Organizada: una mesa redonda/cuadrada conserva la misma
    // dimensión física en X e Y, independientemente de la relación ancho/largo del salón.
    const suggested=(Math.max(1,Number(wM)||1.8)+Math.max(1,Number(hM)||1.8))/2
    const d=Math.min(2.2,Math.max(1.6,suggested))
    return {w:+d.toFixed(2),h:+d.toFixed(2)}
  }
  return {w:+Math.max(1,Number(wM)||1.8).toFixed(2),h:+Math.max(1,Number(hM)||1.8).toFixed(2)}
}
function dominantTableTemplate(tables=[]){
  const counts=new Map()
  for(const table of tables){
    const key=table.visual_type||'round'
    counts.set(key,(counts.get(key)||0)+1)
  }
  const type=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'round'
  const source=tables.find(table=>(table.visual_type||'round')===type)
  const cfg=TABLE_VISUAL_TYPES[type]||TABLE_VISUAL_TYPES.round
  return {
    visual_type:type,
    shape:type==='round'?'round':type==='square'?'square':'rectangular',
    width_m:Number(source?.width_m)||cfg.width,
    height_m:Number(source?.height_m)||cfg.height,
    capacity:Math.max(1,Number(source?.capacity)||cfg.capacities?.[0]||8),
    room_label:source?.room_label||null,
  }
}
const PRESET_PATTERNS = {
  clasica_elegante:'symmetric', boho_chic:'organic', rustica_campo:'banquet_rows',
  minimalista_moderno:'banquet_rows', jardin_romantico:'organic', playa_tropical:'organic',
  industrial_chic:'banquet_rows', vintage_romantico:'ring', glam_lujo:'symmetric',
  mediterranea:'ring', japandi:'banquet_rows', eco_sustentable:'banquet_rows',
  fiesta_latina:'ring', luces_fairy_noche:'organic', micro_wedding_boutique:'banquet_rows',
}
function presetTableTarget(baseTables=[],guestCount=0){
  // Regla Tu Boda Organizada: el preset SIEMPRE nace con la cantidad de mesas
  // dibujada en su boceto. La cantidad de invitados no reemplaza ese patrón.
  // Si la capacidad del boceto no alcanza, calculamos cuántas mesas extra harían
  // falta y las ofrecemos como una acción posterior ("Agregar mesas faltantes").
  const guests=Math.max(0,Number(guestCount)||0)
  const base=[...(baseTables||[])]
  const usable=base.filter(t=>Number(t.capacity)>0)
  const baseSeats=usable.reduce((s,t)=>s+Math.max(0,Number(t.capacity)||0),0)
  if(!guests || !usable.length){
    return {
      seedTables:base,
      requiredTables:base.length,
      additionalTables:0,
      baseReferenceTables:base.length,
      baseReferenceSeats:baseSeats,
    }
  }
  const template=dominantTableTemplate(usable)
  const extra=Math.max(0,Math.ceil((guests-baseSeats)/Math.max(1,Number(template.capacity)||8)))
  return {
    seedTables:base,
    requiredTables:base.length+extra,
    additionalTables:extra,
    baseReferenceTables:base.length,
    baseReferenceSeats:baseSeats,
  }
}
function elementSafetyMargin(el,pass='normal'){
  if(el?.is_non_physical) return 0
  const type=String(el?.type||'')
  const normal={pista:1.0,entrada:.9,escenario:.9,novios:.7,bar:.65,buffet:.65,banios:.8,torta:.55,photobooth:.55,living:.5,guardarropa:.45,proveedores:.45,mozos:.45}
  const base=normal[type]??.45
  if(pass==='tight') return Math.max(.2,base*.65)
  if(pass==='dense') return Math.max(.12,base*.45)
  return base
}
function candidateScore(pos,pattern,widthM,heightM,elements=[]){
  const cx=widthM/2,cy=heightM/2
  const pista=elements.find(el=>el.type==='pista')
  const px=pista?(Number(pista.pos_x)||50)/100*widthM:cx
  const py=pista?(Number(pista.pos_y)||50)/100*heightM:cy
  const dist=Math.hypot(pos.x-px,pos.y-py)
  if(pattern==='ring'){
    const ideal=Math.max(4.2,Math.min(widthM,heightM)*.28)
    return Math.abs(dist-ideal)*5 + Math.abs(pos.x-cx)*.08 + pos.y*.01
  }
  if(pattern==='symmetric') return Math.abs(pos.y-cy)*.3 + Math.abs(Math.abs(pos.x-cx)-widthM*.28)*2
  if(pattern==='banquet_rows') return pos.y*1.1 + Math.abs(pos.x-cx)*.08
  // orgánico: laterales primero, pero sin mandar todas las mesas al mismo rincón.
  return (widthM/2-Math.abs(pos.x-cx))*1.2 + Math.abs(pos.y-cy)*.2
}
function generateCandidatePositions(widthM,heightM,template,elements=[],pattern='organic',pass='normal'){
  const edge=pass==='normal'?.9:(pass==='tight'?.65:.45)
  const clearance=pass==='normal'?.85:(pass==='tight'?.5:.25)
  const stepScan=pass==='dense'?.5:null
  const stepX=stepScan||Math.max(1.7,Number(template.width_m||1.8)+clearance)
  const stepY=stepScan||Math.max(1.7,Number(template.height_m||1.8)+clearance)
  const minX=edge+Number(template.width_m||1.8)/2,maxX=widthM-edge-Number(template.width_m||1.8)/2
  const minY=edge+Number(template.height_m||1.8)/2,maxY=heightM-edge-Number(template.height_m||1.8)/2
  const positions=[]
  for(let y=minY;y<=maxY+.001;y+=stepY){
    for(let x=minX;x<=maxX+.001;x+=stepX){positions.push({x:+x.toFixed(2),y:+y.toFixed(2)})}
  }
  return positions.sort((a,b)=>candidateScore(a,pattern,widthM,heightM,elements)-candidateScore(b,pattern,widthM,heightM,elements))
}
function tryPlaceMissingTables({tables,elements,widthM,heightM,requiredTables,presetId}){
  const placed=[...(tables||[])]
  if(placed.length>=requiredTables) return placed
  const template=dominantTableTemplate(placed)
  const dims=normalizeTableDimensions(template.visual_type,template.width_m,template.height_m)
  template.width_m=dims.w;template.height_m=dims.h
  const pattern=PRESET_PATTERNS[presetId]||'organic'
  for(const pass of ['normal','tight','dense']){
    if(placed.length>=requiredTables) break
    const blocked=(elements||[]).filter(el=>!el.is_non_physical).map(el=>rectForItem(el,widthM,heightM,elementSafetyMargin(el,pass)))
    const tableMargin=pass==='normal'?.48:(pass==='tight'?.3:.18)
    const candidates=generateCandidatePositions(widthM,heightM,template,elements,pattern,pass)
    for(const pos of candidates){
      if(placed.length>=requiredTables) break
      const candidate={
        pos_x:+(pos.x/widthM*100).toFixed(3),pos_y:+(pos.y/heightM*100).toFixed(3),
        width_m:template.width_m,height_m:template.height_m,
        visual_type:template.visual_type,shape:template.shape,capacity:template.capacity,
        room_label:template.room_label,
        metadata:{generated_for_preset:presetId,placement_pass:pass},
      }
      const rect=rectForItem(candidate,widthM,heightM,tableMargin)
      if(blocked.some(zone=>rectsOverlap(rect,zone))) continue
      if(placed.some(existing=>rectsOverlap(rect,rectForItem(existing,widthM,heightM,tableMargin)))) continue
      placed.push(candidate)
    }
  }
  return placed
}
function summarizePresetPlacement({presetId,baseTables=[],tables=[],elements=[],widthM,heightM,guestCount}){
  const target=presetTableTarget(baseTables,guestCount)
  const seats=(tables||[]).reduce((s,t)=>s+Math.max(0,Number(t.capacity)||0),0)
  const missingTables=Math.max(0,target.requiredTables-(tables||[]).length)
  const addedTables=Math.max(0,(tables||[]).length-target.baseReferenceTables)
  const warnings=[]
  if(missingTables>0) warnings.push(`El boceto trae ${target.baseReferenceTables} mesas. Para ${guestCount} invitados se estiman ${target.requiredTables}; faltan ${missingTables} por agregar sin modificar las mesas originales del preset.`)
  if(seats<guestCount) warnings.push(`La capacidad colocada llega a ${seats} lugares para ${guestCount} invitados activos.`)
  return {
    presetId,
    baseReferenceTables:target.baseReferenceTables,
    baseReferenceSeats:target.baseReferenceSeats,
    requiredTables:target.requiredTables,
    additionalTables:target.additionalTables,
    addedTables,
    placedTables:(tables||[]).length,
    missingTables,
    seats,
    guestCount,
    baseIntact:(tables||[]).length>=target.baseReferenceTables,
    complete:missingTables===0 && seats>=guestCount,
    warnings,
  }
}

export function completePresetTables({presetId,widthM=26,heightM=18,guestCount=150,tableCapacity=8,tables=[],elements=[]}={}){
  const preset=SALON_PRESETS.find(item=>item.id===presetId)||SALON_PRESETS[0]
  // Para calcular cuántas mesas necesita el preset usamos su referencia original,
  // pero para ubicar las faltantes respetamos las mesas que la planner ya movió.
  const baseLayout=buildPresetLayout(preset.id,widthM,heightM,{guestCount,tableCapacity,fillToGuests:false})
  const target=presetTableTarget(baseLayout.tables,guestCount)
  const before=[...(tables||[])]
  const completed=tryPlaceMissingTables({tables:before,elements,widthM,heightM,requiredTables:target.requiredTables,presetId:preset.id})
  const added=completed.slice(before.length)
  return {tables:completed,added,summary:summarizePresetPlacement({presetId:preset.id,baseTables:baseLayout.tables,tables:completed,elements,widthM,heightM,guestCount})}
}

export function buildPresetLayout(presetId, widthM=null, heightM=null, options={}) {
  const preset=SALON_PRESETS.find(item=>item.id===presetId) || SALON_PRESETS[0]
  const guests=Math.max(0,Number(options?.guestCount)||150)
  const roomOption=options?.roomSizeOption || 'recommended'
  const useOriginalSizing=options?.useOriginalSizing !== false
  const originalRoom=getExactReferenceRoomSize(guests,roomOption)
  const width=useOriginalSizing ? originalRoom.W : Math.max(5,Number(widthM)||originalRoom.W)
  const height=useOriginalSizing ? originalRoom.H : Math.max(5,Number(heightM)||originalRoom.H)

  // Port 1:1 del motor exactReference de Tu Boda Organizada.
  // Los elementos y mesas nacen en las mismas coordenadas del JPG de referencia.
  const elements=preset.elements.map((raw,index)=>{
    const box=raw.box||[200,200,400,300]
    const x=pxToPctX(box[0]), y=pxToPctY(box[1])
    const wPct=pxWToPct(box[2]-box[0]), hPct=pxHToPct(box[3]-box[1])
    return {
      sourceId:raw.id||`${preset.id}-element-${index+1}`,
      type:raw.tipo||'activacion',
      label:raw.label||raw.tipo||'Elemento',
      pos_x:+Math.max(0,Math.min(100,x+wPct/2)).toFixed(3),
      pos_y:+Math.max(0,Math.min(100,y+hPct/2)).toFixed(3),
      width_m:+Math.max(.25,(wPct/100)*width).toFixed(2),
      height_m:+Math.max(.20,(hPct/100)*height).toFixed(2),
      rotation:0,
      is_non_physical:Boolean(raw.nonPhysical),
      metadata:{preset_id:preset.id,exact_reference:true,preset_fixed:true},
    }
  })

  const tables=preset.tables.map((raw,index)=>{
    const visualType=raw.tipo||'rect_h'
    let xPct,yPct,wM,hM
    if(visualType==='round'){
      xPct=pxToPctX(raw.cx); yPct=pxToPctY(raw.cy)
      // Igual al exactTables original: el diámetro se calcula con la escala X
      // y se reutiliza en Y para que la mesa sea un círculo real.
      const diameterM=Math.max(.90,((Number(raw.r)||50)*2/EXACT_REF.w)*width)
      wM=diameterM; hM=diameterM
    }else{
      const box=raw.box||[300,700,600,780]
      const wPct=pxWToPct(box[2]-box[0]),hPct=pxHToPct(box[3]-box[1])
      xPct=pxToPctX((box[0]+box[2])/2); yPct=pxToPctY((box[1]+box[3])/2)
      wM=Math.max(.90,(wPct/100)*width);hM=Math.max(.55,(hPct/100)*height)
    }
    return {
      pos_x:+Math.max(0,Math.min(100,xPct)).toFixed(3),
      pos_y:+Math.max(0,Math.min(100,yPct)).toFixed(3),
      width_m:+wM.toFixed(2),height_m:+hM.toFixed(2),
      visual_type:visualType,
      shape:visualType==='round'?'round':visualType==='square'?'square':'rectangular',
      capacity:Number(raw.cap)||(visualType==='round'?8:12),
      room_label:raw.label||null,
      metadata:{preset_id:preset.id,exact_reference:true,preset_key:`exact-${index+1}`},
    }
  })

  const seatedCapacity=tables.reduce((sum,t)=>sum+(Number(t.capacity)||0),0)
  const warnings=[]
  if(seatedCapacity<guests){
    warnings.push(`Este estilo, tal como está armado, queda corto para ${guests} invitados: hoy contempla ${seatedCapacity} asientos. Podés agregar mesas, subir capacidad por mesa, reducir invitados o elegir un estilo con más mesas.`)
  }
  const layoutSummary={
    preset:preset.label,invitados:guests,salon:originalRoom.label,medidas:`${width} × ${height} m`,area:+(width*height).toFixed(0),
    tipoMesa:'Distribución base del estilo',mesasRequeridas:tables.length,mesasGeneradas:tables.length,
    capacidadPorMesa:'editable por mesa',capacidadSentada:seatedCapacity,estado:'listo para editar',alertas:warnings,
    baseReferenceTables:tables.length,baseReferenceSeats:seatedCapacity,requiredTables:tables.length,placedTables:tables.length,
    missingTables:0,seats:seatedCapacity,complete:seatedCapacity>=guests,
  }
  return {preset,elements,tables,salonW:width,salonH:height,room:originalRoom,layoutSummary,overflowTables:seatedCapacity<guests,maxPresetSeats:seatedCapacity}
}

export function shapeClipPath(shape='rectangle', config={}) {
  if(shape==='oval') return 'ellipse(50% 50% at 50% 50%)'
  if(shape==='L') {
    const orientation=config?.L?.orientation||'cutTopRight'
    if(orientation==='cutTopLeft') return 'polygon(35% 0,100% 0,100% 100%,0 100%,0 35%,35% 35%)'
    if(orientation==='cutBottomLeft') return 'polygon(0 0,100% 0,100% 100%,35% 100%,35% 65%,0 65%)'
    if(orientation==='cutBottomRight') return 'polygon(0 0,100% 0,100% 65%,65% 65%,65% 100%,0 100%)'
    return 'polygon(0 0,65% 0,65% 35%,100% 35%,100% 100%,0 100%)'
  }
  if(shape==='U') {
    const orientation=config?.U?.orientation||'openTop'
    if(orientation==='openBottom') return 'polygon(0 0,100% 0,100% 100%,65% 100%,65% 65%,35% 65%,35% 100%,0 100%)'
    if(orientation==='openLeft') return 'polygon(0 0,100% 0,100% 100%,0 100%,0 65%,35% 65%,35% 35%,0 35%)'
    if(orientation==='openRight') return 'polygon(0 0,100% 0,100% 35%,65% 35%,65% 65%,100% 65%,100% 100%,0 100%)'
    return 'polygon(0 0,35% 0,35% 35%,65% 35%,65% 0,100% 0,100% 100%,0 100%)'
  }
  return 'inset(0 round 0px)'
}

export function suggestedCapacity(visualType='round', widthM=1.8, heightM=1.8) {
  // Misma regla operativa de Tu Boda Organizada: ~0,60 m de borde por cubierto.
  const w=Math.max(.6,Number(widthM)||1.8), h=Math.max(.6,Number(heightM)||1.8)
  if(visualType==='round') return Math.max(2,Math.round(Math.PI*w/.6))
  const nH=Math.max(w>=h?1:0,Math.floor(w/.55))
  const nV=Math.max(h>w?1:0,Math.floor(h/.55))
  return Math.max(2,2*nH+2*nV)
}

export function tableMeasuresForCapacity(visualType='round', capacity=10) {
  const c=Math.max(2,Number(capacity)||10)
  if(visualType==='round') {
    const diameter={6:1.2,8:1.5,10:1.8,12:2.2}[c] || +(c*.6/Math.PI).toFixed(1)
    return {width:diameter,height:diameter}
  }
  if(visualType==='square') {
    const side=+(Math.max(1.2,Math.ceil(c/4)*.66)).toFixed(1)
    return {width:side,height:side}
  }
  if(visualType==='rect_h') {
    const length=+(Math.max(1.8,(c-2)/2*.6)).toFixed(1)
    return {width:length,height:.9}
  }
  if(visualType==='rect_v') {
    const length=+(Math.max(1.8,(c-2)/2*.6)).toFixed(1)
    return {width:.9,height:length}
  }
  if(visualType==='imperial') {
    const length=+(Math.max(2.4,(c-2)/2*.6)).toFixed(1)
    return {width:length,height:1.1}
  }
  const cfg=TABLE_VISUAL_TYPES[visualType]||TABLE_VISUAL_TYPES.round
  return {width:cfg.width,height:cfg.height}
}
