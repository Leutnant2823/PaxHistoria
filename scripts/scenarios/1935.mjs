// Scenario "1935": the world on 1 December 1935, built from the 1930 basemap.
// The 1930 file lacks the Russian SFSR, so uncovered land is filled from ADM0_FALLBACK.
// See build-map.mjs for how these tables are used.

// Owners of the 1930 polygons (by NAME), adjusted to December 1935.
const OWNER_BY_NAME = {
  Afghanistan: "AFG", Albania: "ALB", Algeria: "FRA", "American Samoa": "USA", Angola: "POR",
  Anguilla: "GBR", Annam: "FRA", "Antigua and Barbuda": "GBR", Argentina: "ARG", Australia: "AUS",
  Austria: "AUT", Barbados: "GBR", Belgium: "BEL", "Rwanda (Belgium)": "BEL", "Zaire (Belgium)": "BEL",
  Belize: "GBR", Bhutan: "BHU", Bolivia: "BOL", Botswana: "GBR", Brazil: "BRA", Brunei: "GBR",
  Bulgaria: "BUL", Burundi: "BEL", Canada: "CAN", Ceylon: "GBR", "Rapa Nui": "CHL", Chile: "CHL",
  "Chinese Warlords": "CHN", "Cochin China": "FRA", Colombia: "COL", "Costa Rica": "CRI", Cuba: "CUB",
  Czechoslovakia: "CZE", Denmark: "DEN", Dominica: "GBR", "Dominican Republic": "DOM",
  "Dutch East Indies": "NED", "East Prussia": "GER", Ecuador: "ECU", "El Salvador": "ESA",
  "Emirate of Bin Shal'an": "SAU", "Empire of Japan": "JAP", "Equatorial Guinea": "ESP", Eritrea: "ITA",
  Estonia: "EST", Ethiopia: "ETH", "Far Eastern SSR": "SOV", Fiji: "GBR", Finland: "FIN",
  "Syria (France)": "FRA", "French Equatorial Africa": "FRA", "French West Africa": "FRA",
  "French Somaliland": "FRA", "French Cameroons": "FRA", France: "FRA", "French Guiana": "FRA",
  "French Indo-China": "FRA", "Gambia, The": "GBR", Germany: "GER", Ghana: "GBR", Grenada: "GBR",
  Guadeloupe: "FRA", Guatemala: "GUA", "Guinea-Bissau": "POR", Guyana: "GBR", Hail: "SAU", Haiti: "HAI",
  Hejaz: "SAU", Honduras: "HON", Hungary: "HUN", Iceland: "ISL", Iran: "IRN", Italy: "ITA",
  "Italian Somaliland": "ITA", "Libya (IT)": "ITA", "Dodecanese Islands": "ITA", Jamaica: "GBR",
  Kenya: "GBR", Latvia: "LAT", Lesotho: "GBR", Liberia: "LBR", Lithuania: "LIT", Luxembourg: "LUX",
  "Madagascar (France)": "FRA", Malawi: "GBR", Malaysia: "GBR", Manchuria: "MAN", Martinique: "FRA",
  Mexico: "MEX", Mongolia: "MON", Montserrat: "GBR", Morocco: "FRA", Mozambique: "POR", Nepal: "NEP",
  Netherlands: "NED", "Netherlands Antilles": "NED", "New Zealand": "NZL", Nicaragua: "NIC",
  Nigeria: "GBR", Niue: "NZL", Norway: "NOR", Panama: "PAN", "Papua New Guinea": "AUS",
  Paraguay: "PAR", Peru: "PRU", Philippines: "USA", Poland: "POL", Portugal: "POR", "Puerto Rico": "USA",
  "Rattanakosin Kingdom": "SIA", "Republic of Turkey": "TUR", Turkey: "TUR", "Rio De Oro": "ESP",
  Romania: "ROM", "Saint Barthelemy": "FRA", "Saint Kitts and Nevis": "GBR", "Saint Lucia": "GBR",
  "Saint Martin": "FRA", "Saint Vincent and the Grenadines": "GBR", Samoa: "NZL", "Sierra Leone": "GBR",
  Spain: "ESP", "Spanish Sahara": "ESP", Sudan: "GBR", Suriname: "NED", Swaziland: "GBR", Sweden: "SWE",
  Switzerland: "SUI", Tibet: "TIB", Togo: "FRA", Tonga: "GBR", Trinidad: "GBR", Tunisia: "FRA",
  Azerbaijan: "SOV", Armenia: "SOV", Georgia: "SOV", Uganda: "GBR", "Union of South Africa": "SAF",
  "Hong Kong": "GBR", "British Raj": "GBR", "Mesopotamia (GB)": "IRQ", "Dominion of Newfoundland": "NFL",
  "British Somaliland": "GBR", Egypt: "EGY", "Mandatory Palestine (GB)": "GBR", "Muscat and Oman": "GBR",
  "Trucial Oman": "GBR", Qatar: "GBR", "United Kingdom of Great Britain and Ireland": "GBR",
  "United States": "USA", "United States Virgin Islands": "USA", Uruguay: "URU", Venezuela: "VEN",
  "Wallis and Futuna Islands": "FRA", "White Russia": "SOV", Xinjiang: "CHN", Yemen: "YEM",
  Yugoslavia: "YUG", Zambia: "GBR", Zimbabwe: "GBR", Greece: "GRE", Danzig: "DAN",
  "Tanzania, United Republic of": "GBR",
};

// Whole modern countries whose 1935 owner is fixed regardless of the overlay.
const ADM0_OWNER = {
  DEU: "GER", AUT: "AUT", TUR: "TUR", YEM: "YEM", MCO: "FRA", HUN: "HUN", IRL: "IRE", ISL: "ISL", GRC: "GRE", ALB: "ALB",
  KOR: "JAP", PRK: "JAP", TWN: "JAP", MNG: "MON", IRQ: "IRQ", EGY: "EGY", SAU: "SAU",
  LBY: "ITA", ERI: "ITA", SOM: "ITA", ETH: "ETH", SOL: "GBR", DJI: "FRA",
  SYR: "FRA", LBN: "FRA", ISR: "GBR", PSX: "GBR", JOR: "GBR", KWT: "GBR", QAT: "GBR", BHR: "GBR", ARE: "GBR", OMN: "GBR",
  CYP: "GBR", CYN: "GBR", ESB: "GBR", WSB: "GBR", MLT: "GBR", GIB: "GBR",
  IND: "GBR", PAK: "GBR", BGD: "GBR", MMR: "GBR", LKA: "GBR", KAS: "GBR", MYS: "GBR", SGP: "GBR", BRN: "GBR",
  HKG: "GBR", MAC: "POR", TLS: "POR", VNM: "FRA", LAO: "FRA", KHM: "FRA", IDN: "NED", PHL: "USA",
  MAR: "FRA", DZA: "FRA", TUN: "FRA", SAH: "ESP", GNQ: "ESP",
  NAM: "SAF", ZAF: "SAF", AUS: "AUS", NZL: "NZL", PNG: "AUS", NRU: "AUS", WSM: "NZL",
  FSM: "JAP", MHL: "JAP", PLW: "JAP", MNP: "JAP", GUM: "USA", USG: "USA",
  TZA: "GBR", RWA: "BEL", BDI: "BEL", COD: "BEL", KEN: "GBR", UGA: "GBR", SDN: "GBR", SDS: "GBR",
  GRL: "DEN", FRO: "DEN", SJM: "NOR", ALD: "FIN", KAB: "SOV",
  SVK: "CZE", CZE: "CZE",
  PCN: "GBR", SYC: "GBR", KIR: "GBR", VGB: "GBR", CYM: "GBR", BMU: "GBR", SHN: "GBR", MUS: "GBR",
  JEY: "GBR", GGY: "GBR", IMN: "GBR", IOT: "GBR", NFK: "AUS", COK: "NZL", SLB: "GBR", TUV: "GBR", MDV: "GBR",
  FLK: "GBR", VUT: "GBR", NCL: "FRA", SPM: "FRA", PYF: "FRA", COM: "FRA", CLP: "FRA", ABW: "NED",
  STP: "POR", CPV: "POR", BHS: "GBR", TCA: "GBR", JAM: "GBR", TTO: "GBR", VIR: "USA", PRI: "USA",
};

// Province-level corrections.
const ADM1_OWNER = {
  MAR: { "Tanger - Tétouan": "ESP", "Taza - Al Hoceima - Taounate": "ESP" },
  TUR: { Hatay: "FRA" },
  RUS: { Tuva: "TUV", Kaliningrad: "GER" },
  // Aden colony and protectorate.
  YEM: { "`Adan": "GBR", Lahij: "GBR", Abyan: "GBR", Shabwah: "GBR", Hadramawt: "GBR", "Al Mahrah": "GBR", "Al Dali'": "GBR" },
  CAN: { "Newfoundland and Labrador": "NFL" },
};

// Same grouping as 1911 (Montenegro split along the old sanjak border).
const CUSTOM_GROUPS = {
  MNE: [
    { name: "Санджак (Плевля)", members: ["Pljevlja", "Bijelo Polje", "Berane", "Rožaje", "Plav"] },
    { name: "Черногория", members: "*" },
  ],
};

// Land the 1930 basemap leaves uncovered.
const ADM0_FALLBACK = {
  RUS: "SOV", UKR: "SOV", BLR: "SOV", KAZ: "SOV", UZB: "SOV", TKM: "SOV", KGZ: "SOV", TJK: "SOV",
  GEO: "SOV", ARM: "SOV", AZE: "SOV", MDA: "SOV", CHN: "CHN", SAU: "SAU", YEM: "GBR", GBR: "GBR",
  SWE: "SWE", HRV: "YUG", FRO: "DEN", NOR: "NOR",
};

const RENAME = {
  "Калининградская область": "Восточная Пруссия (Кёнигсберг)",
  "Варминско-Мазурское воеводство": "Восточная Пруссия (Алленштайн)",
  "Поморское воеводство": "Померания (Штольп)", "Великопольское воеводство": "Пограничная марка Позен-Западная Пруссия",
  "Силезское воеводство": "Верхняя Силезия (Глейвиц)",
  "Западно-Поморское воеводство": "Померания (Штеттин)",
  "Нижнесилезское воеводство": "Нижняя Силезия (Бреслау)",
  "Любушское воеводство": "Бранденбург (Франкфурт-на-Одере)",
  "Опольское воеводство": "Верхняя Силезия (Оппельн)",
  "Нижняя Саксония": "Ганновер и Брауншвейг", "Северный Рейн-Вестфалия": "Рейнская провинция и Вестфалия",
  "Мекленбург-Передняя Померания": "Мекленбург и Передняя Померания", "Саксония-Анхальт": "Провинция Саксония и Анхальт",
  "Рейнланд-Пфальц": "Пфальц и Рейнгессен", "Баден-Вюртемберг": "Баден и Вюртемберг",
  "Саар": "Саарская область",
  "Санкт-Петербург": "Ленинград", "Волгоградская область": "Сталинградский край",
  "Самарская область": "Куйбышевский край", "Нижегородская область": "Горьковский край",
  "Тверская область": "Калининская область", "Стамбул": "Стамбул",
};

function post(pieces) {
  for (const p of pieces) {
    if (RENAME[p.name]) p.name = RENAME[p.name];
    // Split pieces carry a direction suffix; German pieces get the historical name.
    const m = /^(.*) \((север|юг|запад|восток)\)$/.exec(p.name);
    if (m && p.owner === "GER" && RENAME[m[1]]) p.name = RENAME[m[1]];
    if (p.owner === "DAN") p.name = "Вольный город Данциг";
  }
}

// [name, lon, lat, capitalOf?]. Names as of December 1935.
const CITIES = [
  ["Берлин", 13.4, 52.52, "GER"], ["Гамбург", 9.99, 53.55], ["Мюнхен", 11.58, 48.14], ["Кёльн", 6.96, 50.94],
  ["Франкфурт-на-Майне", 8.68, 50.11], ["Дрезден", 13.74, 51.05], ["Бреслау", 17.04, 51.11], ["Кёнигсберг", 20.51, 54.71],
  ["Штеттин", 14.55, 53.43], ["Киль", 10.13, 54.32], ["Вильгельмсхафен", 8.12, 53.53], ["Лейпциг", 12.37, 51.34],
  ["Штутгарт", 9.18, 48.78], ["Ганновер", 9.73, 52.37], ["Нюрнберг", 11.08, 49.45], ["Саарбрюккен", 7.0, 49.23],
  ["Эссен", 7.01, 51.46], ["Данциг", 18.65, 54.35, "DAN"],
  ["Лондон", -0.13, 51.51, "GBR"], ["Манчестер", -2.24, 53.48], ["Ливерпуль", -2.98, 53.41], ["Глазго", -4.25, 55.86],
  ["Эдинбург", -3.19, 55.95], ["Белфаст", -5.93, 54.6], ["Портсмут", -1.09, 50.8], ["Скапа-Флоу", -3.1, 58.9],
  ["Дублин", -6.26, 53.35, "IRE"],
  ["Париж", 2.35, 48.86, "FRA"], ["Марсель", 5.37, 43.3], ["Лион", 4.84, 45.76], ["Бордо", -0.58, 44.84],
  ["Лилль", 3.06, 50.63], ["Страсбург", 7.75, 48.58], ["Мец", 6.18, 49.12], ["Брест", -4.49, 48.39], ["Тулон", 5.93, 43.12],
  ["Москва", 37.62, 55.75, "SOV"], ["Ленинград", 30.32, 59.94], ["Киев", 30.52, 50.45], ["Харьков", 36.23, 49.99],
  ["Одесса", 30.73, 46.48], ["Минск", 27.56, 53.9], ["Сталинград", 44.5, 48.71], ["Севастополь", 33.52, 44.62],
  ["Тифлис", 44.79, 41.72], ["Баку", 49.87, 40.41], ["Ташкент", 69.24, 41.3], ["Свердловск", 60.6, 56.84],
  ["Новосибирск", 82.92, 55.03], ["Иркутск", 104.28, 52.29], ["Хабаровск", 135.07, 48.48], ["Владивосток", 131.89, 43.12],
  ["Горький", 44.0, 56.33], ["Мурманск", 33.08, 68.97], ["Архангельск", 40.52, 64.54],
  ["Варшава", 21.01, 52.23, "POL"], ["Краков", 19.94, 50.06], ["Львов", 24.03, 49.84], ["Вильно", 25.28, 54.69],
  ["Познань", 16.93, 52.41], ["Гдыня", 18.53, 54.52], ["Катовице", 19.02, 50.26],
  ["Прага", 14.42, 50.08, "CZE"], ["Брно", 16.61, 49.2], ["Братислава", 17.11, 48.15],
  ["Вена", 16.37, 48.21, "AUT"], ["Будапешт", 19.04, 47.5, "HUN"],
  ["Рим", 12.5, 41.9, "ITA"], ["Милан", 9.19, 45.46], ["Турин", 7.69, 45.07], ["Неаполь", 14.27, 40.85],
  ["Венеция", 12.33, 45.44], ["Палермо", 13.36, 38.12], ["Генуя", 8.93, 44.41], ["Таранто", 17.24, 40.47],
  ["Триест", 13.78, 45.65], ["Фиуме", 14.44, 45.33],
  ["Белград", 20.46, 44.82, "YUG"], ["Загреб", 15.98, 45.81], ["Сараево", 18.41, 43.86], ["Скопье", 21.43, 42.0],
  ["Бухарест", 26.1, 44.43, "ROM"], ["Клуж", 23.59, 46.77], ["Кишинёв", 28.86, 47.01], ["Черновцы", 25.94, 48.29],
  ["София", 23.32, 42.7, "BUL"], ["Варна", 27.91, 43.21], ["Афины", 23.73, 37.98, "GRE"], ["Салоники", 22.94, 40.64],
  ["Тирана", 19.82, 41.33, "ALB"], ["Анкара", 32.85, 39.93, "TUR"], ["Стамбул", 28.98, 41.01], ["Измир", 27.14, 38.42],
  ["Эрзурум", 41.28, 39.9],
  ["Мадрид", -3.7, 40.42, "ESP"], ["Барселона", 2.17, 41.39], ["Севилья", -5.98, 37.39], ["Бильбао", -2.93, 43.26],
  ["Тетуан", -5.37, 35.57], ["Лиссабон", -9.14, 38.72, "POR"],
  ["Амстердам", 4.9, 52.37, "NED"], ["Роттердам", 4.48, 51.92], ["Брюссель", 4.35, 50.85, "BEL"], ["Антверпен", 4.4, 51.22],
  ["Льеж", 5.57, 50.63], ["Люксембург", 6.13, 49.61, "LUX"], ["Берн", 7.45, 46.95, "SUI"], ["Цюрих", 8.54, 47.38],
  ["Копенгаген", 12.57, 55.68, "DEN"], ["Стокгольм", 18.07, 59.33, "SWE"], ["Осло", 10.75, 59.91, "NOR"],
  ["Хельсинки", 24.94, 60.17, "FIN"], ["Выборг", 28.73, 60.71], ["Таллин", 24.75, 59.44, "EST"], ["Рига", 24.11, 56.95, "LAT"],
  ["Каунас", 23.9, 54.9, "LIT"], ["Мемель", 21.13, 55.71], ["Рейкьявик", -21.9, 64.15, "ISL"],
  ["Каир", 31.24, 30.04, "EGY"], ["Александрия", 29.92, 31.2], ["Хартум", 32.53, 15.5], ["Алжир", 3.06, 36.75],
  ["Тунис", 10.18, 36.81], ["Рабат", -6.84, 34.02], ["Касабланка", -7.59, 33.57], ["Триполи", 13.19, 32.89],
  ["Бенгази", 20.07, 32.12], ["Асмэра", 38.93, 15.33], ["Могадишо", 45.34, 2.05], ["Аддис-Абеба", 38.75, 9.03, "ETH"],
  ["Дэссе", 39.63, 11.13], ["Харэр", 42.12, 9.31], ["Мэкэле", 39.47, 13.5], ["Джибути", 43.15, 11.59],
  ["Монровия", -10.8, 6.3, "LBR"], ["Дакар", -17.44, 14.69], ["Лагос", 3.38, 6.45], ["Аккра", -0.19, 5.6],
  ["Леопольдвиль", 15.31, -4.32], ["Луанда", 13.23, -8.84], ["Найроби", 36.82, -1.29], ["Дар-эс-Салам", 39.28, -6.79],
  ["Претория", 28.19, -25.75, "SAF"], ["Кейптаун", 18.42, -33.92], ["Йоханнесбург", 28.05, -26.2], ["Виндхук", 17.08, -22.56],
  ["Тананариве", 47.52, -18.91],
  ["Иерусалим", 35.21, 31.77], ["Хайфа", 34.99, 32.79], ["Дамаск", 36.29, 33.51], ["Бейрут", 35.5, 33.89],
  ["Алеппо", 37.16, 36.2], ["Багдад", 44.36, 33.31, "IRQ"], ["Басра", 47.78, 30.51], ["Мосул", 43.13, 36.34],
  ["Эр-Рияд", 46.72, 24.69, "SAU"], ["Мекка", 39.83, 21.42], ["Сана", 44.21, 15.35, "YEM"], ["Аден", 45.03, 12.79],
  ["Тегеран", 51.39, 35.69, "IRN"], ["Тебриз", 46.29, 38.08], ["Абадан", 48.3, 30.34], ["Кабул", 69.17, 34.53, "AFG"],
  ["Дели", 77.21, 28.61], ["Калькутта", 88.36, 22.57], ["Бомбей", 72.88, 19.08], ["Мадрас", 80.27, 13.08],
  ["Карачи", 67.0, 24.86], ["Рангун", 96.16, 16.84], ["Коломбо", 79.86, 6.93], ["Катманду", 85.32, 27.72, "NEP"],
  ["Пунакха", 89.86, 27.58, "BHU"], ["Лхаса", 91.17, 29.65, "TIB"],
  ["Нанкин", 118.8, 32.06, "CHN"], ["Бэйпин", 116.4, 39.9], ["Шанхай", 121.47, 31.23], ["Кантон", 113.26, 23.13],
  ["Ухань", 114.3, 30.59], ["Чунцин", 106.55, 29.56], ["Сиань", 108.94, 34.34], ["Яньань", 109.49, 36.6],
  ["Тяньцзинь", 117.2, 39.13], ["Циндао", 120.38, 36.07], ["Урумчи", 87.62, 43.83], ["Гонконг", 114.17, 22.3],
  ["Синьцзин", 125.32, 43.88, "MAN"], ["Мукден", 123.43, 41.8], ["Харбин", 126.63, 45.75], ["Порт-Артур", 121.26, 38.81],
  ["Улан-Батор", 106.92, 47.92, "MON"], ["Кызыл", 94.45, 51.72, "TUV"],
  ["Токио", 139.69, 35.69, "JAP"], ["Осака", 135.5, 34.69], ["Куре", 132.57, 34.25], ["Кэйдзё (Сеул)", 126.98, 37.57],
  ["Тайхоку", 121.56, 25.03],
  ["Бангкок", 100.5, 13.76, "SIA"], ["Сайгон", 106.7, 10.78], ["Ханой", 105.85, 21.03], ["Сингапур", 103.82, 1.35],
  ["Батавия", 106.85, -6.21], ["Манила", 120.98, 14.6],
  ["Канберра", 149.13, -35.28, "AUS"], ["Сидней", 151.21, -33.87], ["Мельбурн", 144.96, -37.81], ["Порт-Морсби", 147.18, -9.44],
  ["Веллингтон", 174.78, -41.29, "NZL"],
  ["Вашингтон", -77.04, 38.91, "USA"], ["Нью-Йорк", -74.01, 40.71], ["Чикаго", -87.63, 41.88], ["Сан-Франциско", -122.42, 37.77],
  ["Сан-Диего", -117.16, 32.72], ["Гонолулу", -157.86, 21.31], ["Новый Орлеан", -90.07, 29.95],
  ["Оттава", -75.7, 45.42, "CAN"], ["Монреаль", -73.57, 45.5], ["Ванкувер", -123.12, 49.28], ["Галифакс", -63.57, 44.65],
  ["Сент-Джонс", -52.71, 47.56, "NFL"],
  ["Мехико", -99.13, 19.43, "MEX"], ["Гавана", -82.38, 23.13, "CUB"], ["Гватемала", -90.51, 14.63, "GUA"],
  ["Тегусигальпа", -87.21, 14.07, "HON"], ["Сан-Сальвадор", -89.19, 13.69, "ESA"], ["Манагуа", -86.25, 12.11, "NIC"],
  ["Сан-Хосе", -84.09, 9.93, "CRI"], ["Панама", -79.52, 8.98, "PAN"], ["Порт-о-Пренс", -72.34, 18.54, "HAI"],
  ["Сьюдад-Трухильо", -69.93, 18.49, "DOM"], ["Богота", -74.07, 4.71, "COL"], ["Каракас", -66.9, 10.48, "VEN"],
  ["Кито", -78.47, -0.18, "ECU"], ["Лима", -77.04, -12.05, "PRU"], ["Ла-Пас", -68.15, -16.5, "BOL"],
  ["Рио-де-Жанейро", -43.17, -22.91, "BRA"], ["Сан-Паулу", -46.63, -23.55], ["Асунсьон", -57.58, -25.26, "PAR"],
  ["Монтевидео", -56.16, -34.9, "URU"], ["Буэнос-Айрес", -58.38, -34.6, "ARG"], ["Сантьяго", -70.67, -33.45, "CHL"],
];

export default {
  id: "1935",
  basemap: "world_1930",
  source:
    "Borders: aourednik/historical-basemaps (world_1930, GPL-3.0) adjusted to December 1935; provinces: Natural Earth admin-1 (public domain).",
  uncoveredAsUnknown: true,
  // Owners kept as separate provinces even when their share of a province is small.
  KEEP_SMALL_OWNERS: ["DAN"],
  OWNER_BY_NAME,
  ADM0_OWNER,
  ADM1_OWNER,
  ADM0_FALLBACK,
  CUSTOM_GROUPS,
  post,
  CITIES,
};
