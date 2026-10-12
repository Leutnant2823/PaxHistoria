// Scenario "1911": the world on 1 January 1911, built from the 1914 basemap.
// See build-map.mjs for how these tables are used.

// Owners of the 1914 polygons (by NAME), already adjusted to 1911.
const OWNER_BY_NAME = {
  Abyssinia: "ETH", Afghanistan: "AFG", Albania: "OTT", "American Samoa": "USA",
  Anguilla: "GBR", "Antigua and Barbuda": "GBR", "Arabia (Nejd)": "NEJ", Argentina: "ARG",
  Armenia: "RUS", Australia: "GBR", "Austro-Hungarian Empire": "AUH", Azerbaijan: "RUS",
  Barbados: "GBR", "Belgian Congo": "BEL", Belgium: "BEL", Belize: "GBR", Bhutan: "BHU",
  Bolivia: "BOL", Brazil: "BRA", Brunei: "GBR", Bulgaria: "BUL", Canada: "GBR", Ceylon: "GBR",
  Chile: "CHL", "Rapa Nui": "CHL", Colombia: "COL", "Costa Rica": "CRI", Cuba: "CUB",
  Denmark: "DEN", Dominica: "GBR", "Dominican Republic": "DOM", Ecuador: "ECU",
  "El Salvador": "ESA", "Empire of Japan": "JAP", "Equatorial Guinea": "ESP", Fiji: "GBR",
  Finland: "RUS", "Madagascar (France)": "FRA", Djibouti: "FRA", "French Indochina": "FRA",
  Algeria: "FRA", "French Equatorial Africa": "FRA", "French West Africa": "FRA", France: "FRA",
  "French Guiana": "FRA", "Gambia, The": "GBR", Georgia: "RUS",
  "German E. Africa (Tanganyika)": "GER", "German Empire": "GER",
  "German South-West Africa": "GER", Greece: "GRE", Grenada: "GBR", Guadeloupe: "FRA",
  Guatemala: "GUA", Guyana: "GBR", Haiti: "HAI", Honduras: "HON", Iceland: "DEN",
  Eritrea: "ITA", "Kingdom of Italy": "ITA", Libya: "OTT", "Italian Somaliland": "ITA",
  Kamerun: "GER", Kuwait: "KUW", Lesotho: "GBR", Liberia: "LBR", Luxembourg: "LUX",
  Malaya: "GBR", Malta: "GBR", "Manchu Empire": "QNG", Martinique: "FRA", Mexico: "MEX",
  Mongolia: "QNG", Montenegro: "MNT", Montserrat: "GBR", Morocco: "MOR", Nepal: "NEP",
  Netherlands: "NED", "Netherlands Antilles": "NED", "Netherlands Indies": "NED",
  "New Zealand": "GBR", Nicaragua: "NIC", Niue: "GBR", Norway: "NOR",
  "Ottoman Empire": "OTT", Panama: "PAN", "Papua New Guinea": "GBR", Paraguay: "PAR",
  Persia: "PER", Peru: "PRU", Philippines: "USA", Angola: "POR", Mozambique: "POR",
  Portugal: "POR", "Portuguese Guinea": "POR", "Puerto Rico": "USA", Qatar: "OTT",
  "Rattanakosin Kingdom": "SIA", "Rio De Oro": "ESP", Romania: "ROM", "Sakhalin (RU)": "RUS",
  "Russian Empire": "RUS", "Saint Barthelemy": "FRA", "Saint Kitts and Nevis": "GBR",
  "Saint Lucia": "GBR", "Saint Martin": "FRA", "Saint Vincent and the Grenadines": "GBR",
  Samoa: "GER", Serbia: "SER", "Sierra Leone": "GBR", Spain: "ESP", "Spanish Sahara": "ESP",
  "Spanish Morocco": "MOR", Suriname: "NED", Swaziland: "GBR", Sweden: "SWE",
  Switzerland: "SUI", Tibet: "QNG", Togoland: "GER", Tonga: "GBR", Tunisia: "FRA",
  Uganda: "GBR", "British Raj": "GBR", "Hong Kong": "GBR",
  "United Kingdom of Great Britain and Ireland": "GBR", Malawi: "GBR", Botswana: "GBR",
  "South Africa": "GBR", "Anglo-Egyptian Sudan": "GBR", Egypt: "GBR", "Gold Coast": "GBR",
  Nigeria: "GBR", "British East Africa": "GBR", "British Somaliland": "GBR", Rhodesia: "GBR",
  "British Protectorate": "GBR", "United States": "USA", "United States Virgin Islands": "DEN",
  Uruguay: "URU", Venezuela: "VEN", "Wallis and Futuna Islands": "FRA", Xinjiang: "QNG",
};

// Whole modern countries whose 1911 owner is fixed regardless of the overlay.
const ADM0_OWNER = {
  ALB: "OTT", KOS: "OTT", MKD: "OTT", LBY: "OTT", QAT: "OTT", PSX: "OTT", ISR: "OTT",
  LBN: "OTT", SYR: "OTT", IRQ: "OTT", JOR: "OTT",
  MAR: "MOR", MNG: "QNG", CHN: "QNG", TWN: "JAP", KOR: "JAP", PRK: "JAP",
  FIN: "RUS", ARM: "RUS", GEO: "RUS", AZE: "RUS", KAB: "RUS",
  ISL: "DEN", FRO: "DEN", GRL: "DEN", VIR: "DEN",
  IRL: "GBR", CAN: "GBR", AUS: "GBR", NZL: "GBR", ZAF: "GBR", CYP: "GBR", CYN: "GBR",
  ESB: "GBR", WSB: "GBR", SOL: "GBR", IND: "GBR", PAK: "GBR", BGD: "GBR", MMR: "GBR",
  LKA: "GBR", KAS: "GBR", MYS: "GBR", SGP: "GBR", EGY: "GBR", SDN: "GBR", SDS: "GBR",
  BHR: "GBR", ARE: "GBR", HKG: "GBR", MAC: "POR", SAH: "ESP", USG: "USA", PHL: "USA",
  CLP: "FRA", TUR: "OTT", SJM: "NOR",
  GIB: "GBR", PCN: "GBR", SYC: "GBR", KIR: "GBR", VGB: "GBR", CYM: "GBR", BMU: "GBR",
  SHN: "GBR", MUS: "GBR", JEY: "GBR", GGY: "GBR", IMN: "GBR", IOT: "GBR", NFK: "GBR",
  COK: "GBR", SLB: "GBR", TUV: "GBR", MDV: "GBR", FLK: "GBR", VUT: "GBR",
  NCL: "FRA", SPM: "FRA", PYF: "FRA", COM: "FRA", ABW: "NED", STP: "POR", CPV: "POR",
  ALD: "RUS", MHL: "GER", NRU: "GER", FSM: "GER", PLW: "GER", MNP: "GER", GUM: "USA",
};

// Province-level corrections from 1914 back to 1911.
const ADM1_OWNER = {
  GRC: {
    "Dytiki Makedonia": "OTT", Ipeiros: "OTT", "Kentriki Makedonia": "OTT",
    "Anatoliki Makedonia kai Thraki": "OTT", "Ayion Oros": "OTT", "Voreio Aigaio": "OTT",
    Kriti: "CRT",
  },
  BGR: { Blagoevgrad: "OTT", Kardzhali: "OTT", Smolyan: "OTT", Dobrich: "BUL", Silistra: "BUL" },
  RUS: { Tuva: "QNG", Tyva: "QNG" },
  PNG: {
    "East Sepik": "GER", Sandaun: "GER", Madang: "GER", Morobe: "GER", Manus: "GER",
    "New Ireland": "GER", "East New Britain": "GER", "West New Britain": "GER",
    Bougainville: "GER", "North Solomons": "GER",
  },
};

// Custom province groups (merged before the overlay).
const CUSTOM_GROUPS = {
  MNE: [
    { name: "Новопазарский санджак (север)", members: ["Pljevlja", "Bijelo Polje", "Berane", "Rožaje", "Plav"] },
    { name: "Черногория", members: "*" },
  ],
};
// Post-overlay corrections by province name (Russian), then historical names.
const POST_OWNER = {
  "Территория Бельфор": "FRA", "Мозель (восток)": "GER", "Мозель (запад)": "GER", "Мозель": "GER",
  "Занзибар Центрально-Южный": "GBR", "Пемба Южная": "GBR", "Занзибар Северный": "GBR",
  "Пемба Северная": "GBR", "Занзибар Западный": "GBR",
};
const RENAME = {
  "Нижняя Саксония": "Ганновер", "Северный Рейн-Вестфалия": "Рейнская провинция и Вестфалия",
  "Великопольское воеводство (запад)": "Познань", "Варминско-Мазурское воеводство": "Восточная Пруссия (Алленштайн)",
  "Калининградская область": "Восточная Пруссия (Кёнигсберг)", "Западно-Поморское воеводство": "Померания (Штеттин)",
  "Нижнесилезское воеводство": "Силезия (Бреслау)", "Поморское воеводство": "Западная Пруссия (Данциг)",
  "Любушское воеводство": "Бранденбург (Франкфурт-на-Одере)", "Куявско-Поморское воеводство (запад)": "Западная Пруссия (Бромберг)",
  "Опольское воеводство": "Верхняя Силезия (Оппельн)", "Силезское воеводство (запад)": "Верхняя Силезия (Каттовиц)",
  "Нижний Рейн": "Эльзас (Страсбург)", "Верхний Рейн": "Эльзас (Кольмар)", "Мозель (восток)": "Лотарингия (Мец)",
  "Мозель (запад)": "Лотарингия (Тионвиль)", "Мозель": "Лотарингия (Мец)", "Клайпедский уезд (юг)": "Мемельский край",
  "Мекленбург-Передняя Померания": "Мекленбург и Передняя Померания", "Саксония-Анхальт": "Провинция Саксония и Анхальт",
  "Рейнланд-Пфальц": "Пфальц и Рейнгессен", "Баден-Вюртемберг": "Баден и Вюртемберг", "Тюрингия": "Тюрингские государства",
  "Шлезвиг-Гольштейн": "Шлезвиг-Гольштейн", "Саар": "Саарская область",
  "Ленинградская область": "Санкт-Петербургская губерния", "Кировская область": "Вятская губерния",
  "Ульяновская область": "Симбирская губерния", "Свердловская область": "Пермская губерния (Екатеринбург)",
  "Пермский край": "Пермская губерния", "Волгоградская область": "Саратовская губерния (Царицын)",
  "Нижегородская область": "Нижегородская губерния", "Самарская область": "Самарская губерния",
  "Калужская область": "Калужская губерния", "Тверская область": "Тверская губерния", "Московская область": "Московская губерния",
  "Москва": "Москва", "Санкт-Петербург": "Санкт-Петербург", "Стамбул": "Константинополь",
  "Северная Осетия": "Терская область (Владикавказ)", "Чечня": "Терская область (Грозный)",
};
// British dominions are separate countries; Papua is administered by Australia (since 1906).
const DOMINIONS = { CAN: "CAN", AUS: "AUS", NZL: "NZL", ZAF: "SAF" };

function post(pieces) {
  for (const p of pieces) {
    if (DOMINIONS[p.adm0] && p.owner === "GBR") p.owner = DOMINIONS[p.adm0];
    if (p.adm0 === "CAN" && p.name === "Ньюфаундленд и Лабрадор") p.owner = "NFL";
    if (p.adm0 === "PNG" && p.owner === "GBR") p.owner = "AUS";
  }
  for (const p of pieces) {
    if (POST_OWNER[p.name]) p.owner = POST_OWNER[p.name];
    if (RENAME[p.name]) p.name = RENAME[p.name];
  }
}

const CITIES = [
  ["Берлин", 13.4, 52.52, "GER"], ["Гамбург", 9.99, 53.55], ["Мюнхен", 11.58, 48.14], ["Кёльн", 6.96, 50.94],
  ["Франкфурт-на-Майне", 8.68, 50.11], ["Дрезден", 13.74, 51.05], ["Бреслау", 17.04, 51.11], ["Кёнигсберг", 20.51, 54.71],
  ["Данциг", 18.65, 54.35], ["Штеттин", 14.55, 53.43], ["Страсбург", 7.75, 48.58], ["Мец", 6.18, 49.12],
  ["Позен", 16.93, 52.41], ["Киль", 10.13, 54.32], ["Вильгельмсхафен", 8.12, 53.53], ["Лейпциг", 12.37, 51.34],
  ["Штутгарт", 9.18, 48.78], ["Ганновер", 9.73, 52.37],
  ["Лондон", -0.13, 51.51, "GBR"], ["Манчестер", -2.24, 53.48], ["Ливерпуль", -2.98, 53.41], ["Глазго", -4.25, 55.86],
  ["Эдинбург", -3.19, 55.95], ["Дублин", -6.26, 53.35], ["Белфаст", -5.93, 54.6], ["Портсмут", -1.09, 50.8],
  ["Париж", 2.35, 48.86, "FRA"], ["Марсель", 5.37, 43.3], ["Лион", 4.84, 45.76], ["Бордо", -0.58, 44.84],
  ["Лилль", 3.06, 50.63], ["Нанси", 6.18, 48.69], ["Верден", 5.38, 49.16], ["Брест", -4.49, 48.39], ["Тулон", 5.93, 43.12],
  ["Санкт-Петербург", 30.32, 59.94, "RUS"], ["Москва", 37.62, 55.75], ["Варшава", 21.01, 52.23], ["Киев", 30.52, 50.45],
  ["Одесса", 30.73, 46.48], ["Рига", 24.11, 56.95], ["Гельсингфорс", 24.94, 60.17], ["Вильна", 25.28, 54.69],
  ["Тифлис", 44.79, 41.72], ["Баку", 49.87, 40.41], ["Харьков", 36.23, 49.99], ["Царицын", 44.5, 48.71],
  ["Севастополь", 33.52, 44.62], ["Ташкент", 69.24, 41.3], ["Омск", 73.37, 54.99], ["Иркутск", 104.28, 52.29],
  ["Владивосток", 131.89, 43.12], ["Казань", 49.11, 55.79], ["Екатеринбург", 60.6, 56.84],
  ["Вена", 16.37, 48.21, "AUH"], ["Будапешт", 19.04, 47.5], ["Прага", 14.42, 50.08], ["Краков", 19.94, 50.06],
  ["Лемберг", 24.03, 49.84], ["Триест", 13.78, 45.65], ["Сараево", 18.41, 43.86], ["Аграм", 15.98, 45.81], ["Пола", 13.85, 44.87],
  ["Рим", 12.5, 41.9, "ITA"], ["Милан", 9.19, 45.46], ["Турин", 7.69, 45.07], ["Неаполь", 14.27, 40.85],
  ["Венеция", 12.33, 45.44], ["Палермо", 13.36, 38.12], ["Генуя", 8.93, 44.41], ["Таранто", 17.24, 40.47],
  ["Константинополь", 28.98, 41.01, "OTT"], ["Смирна", 27.14, 38.42], ["Ангора", 32.85, 39.93], ["Эрзерум", 41.28, 39.9],
  ["Багдад", 44.36, 33.31], ["Басра", 47.78, 30.51], ["Дамаск", 36.29, 33.51], ["Иерусалим", 35.21, 31.77], ["Алеппо", 37.16, 36.2],
  ["Салоники", 22.94, 40.64], ["Адрианополь", 26.56, 41.68], ["Скутари", 19.51, 42.07], ["Ускюб", 21.43, 42.0],
  ["Янина", 20.85, 39.66], ["Мекка", 39.83, 21.42], ["Сана", 44.21, 15.35], ["Триполи", 13.19, 32.89], ["Бенгази", 20.07, 32.12],
  ["Мадрид", -3.7, 40.42, "ESP"], ["Барселона", 2.17, 41.39], ["Севилья", -5.98, 37.39], ["Лиссабон", -9.14, 38.72, "POR"],
  ["Амстердам", 4.9, 52.37, "NED"], ["Роттердам", 4.48, 51.92], ["Брюссель", 4.35, 50.85, "BEL"], ["Антверпен", 4.4, 51.22],
  ["Льеж", 5.57, 50.63], ["Люксембург", 6.13, 49.61, "LUX"], ["Берн", 7.45, 46.95, "SUI"], ["Цюрих", 8.54, 47.38],
  ["Копенгаген", 12.57, 55.68, "DEN"], ["Стокгольм", 18.07, 59.33, "SWE"], ["Христиания", 10.75, 59.91, "NOR"],
  ["Афины", 23.73, 37.98, "GRE"], ["Белград", 20.46, 44.82, "SER"], ["Цетине", 18.92, 42.39, "MNT"], ["София", 23.32, 42.7, "BUL"],
  ["Бухарест", 26.1, 44.43, "ROM"], ["Канея", 24.02, 35.51, "CRT"], ["Рейкьявик", -21.9, 64.15],
  ["Каир", 31.24, 30.04], ["Александрия", 29.92, 31.2], ["Хартум", 32.53, 15.5], ["Алжир", 3.06, 36.75], ["Тунис", 10.18, 36.81],
  ["Фес", -5.0, 34.03, "MOR"], ["Танжер", -5.8, 35.76], ["Агадир", -9.6, 30.42], ["Аддис-Абеба", 38.75, 9.03, "ETH"],
  ["Монровия", -10.8, 6.3, "LBR"], ["Дакар", -17.44, 14.69], ["Кейптаун", 18.42, -33.92], ["Йоханнесбург", 28.05, -26.2],
  ["Дар-эс-Салам", 39.28, -6.79], ["Виндхук", 17.08, -22.56], ["Дуала", 9.7, 4.05], ["Ломе", 1.22, 6.13],
  ["Леопольдвиль", 15.31, -4.32], ["Луанда", 13.23, -8.84], ["Лоренсу-Маркиш", 32.57, -25.97], ["Найроби", 36.82, -1.29],
  ["Тананариве", 47.52, -18.91], ["Лагос", 3.38, 6.45], ["Аккра", -0.19, 5.6],
  ["Тегеран", 51.39, 35.69, "PER"], ["Тебриз", 46.29, 38.08], ["Кабул", 69.17, 34.53, "AFG"], ["Эр-Рияд", 46.72, 24.69, "NEJ"],
  ["Кувейт", 47.98, 29.38, "KUW"], ["Аден", 45.03, 12.79], ["Маскат", 58.41, 23.59],
  ["Калькутта", 88.36, 22.57], ["Дели", 77.21, 28.61], ["Бомбей", 72.88, 19.08], ["Мадрас", 80.27, 13.08], ["Карачи", 67.0, 24.86],
  ["Рангун", 96.16, 16.84], ["Коломбо", 79.86, 6.93], ["Катманду", 85.32, 27.72, "NEP"], ["Пунакха", 89.86, 27.58, "BHU"],
  ["Пекин", 116.4, 39.9, "QNG"], ["Шанхай", 121.47, 31.23], ["Кантон", 113.26, 23.13], ["Нанкин", 118.8, 32.06],
  ["Ханькоу", 114.3, 30.59], ["Мукден", 123.43, 41.8], ["Лхаса", 91.17, 29.65], ["Урга", 106.92, 47.92], ["Кашгар", 75.99, 39.47],
  ["Циндао", 120.38, 36.07], ["Гонконг", 114.17, 22.3], ["Харбин", 126.63, 45.75], ["Порт-Артур", 121.26, 38.81],
  ["Токио", 139.69, 35.69, "JAP"], ["Осака", 135.5, 34.69], ["Кэйдзё (Сеул)", 126.98, 37.57], ["Тайхоку", 121.56, 25.03],
  ["Бангкок", 100.5, 13.76, "SIA"], ["Сайгон", 106.7, 10.78], ["Ханой", 105.85, 21.03], ["Сингапур", 103.82, 1.35],
  ["Батавия", 106.85, -6.21], ["Манила", 120.98, 14.6], ["Сидней", 151.21, -33.87], ["Мельбурн", 144.96, -37.81, "AUS"],
  ["Веллингтон", 174.78, -41.29, "NZL"], ["Претория", 28.19, -25.75, "SAF"], ["Порт-Морсби", 147.18, -9.44],
  ["Вашингтон", -77.04, 38.91, "USA"], ["Нью-Йорк", -74.01, 40.71], ["Чикаго", -87.63, 41.88], ["Сан-Франциско", -122.42, 37.77],
  ["Новый Орлеан", -90.07, 29.95], ["Оттава", -75.7, 45.42, "CAN"], ["Сент-Джонс", -52.71, 47.56, "NFL"], ["Галифакс", -63.57, 44.65], ["Монреаль", -73.57, 45.5], ["Ванкувер", -123.12, 49.28],
  ["Мехико", -99.13, 19.43, "MEX"], ["Гавана", -82.38, 23.13, "CUB"], ["Гватемала", -90.51, 14.63, "GUA"],
  ["Тегусигальпа", -87.21, 14.07, "HON"], ["Сан-Сальвадор", -89.19, 13.69, "ESA"], ["Манагуа", -86.25, 12.11, "NIC"],
  ["Сан-Хосе", -84.09, 9.93, "CRI"], ["Панама", -79.52, 8.98, "PAN"], ["Порт-о-Пренс", -72.34, 18.54, "HAI"],
  ["Санто-Доминго", -69.93, 18.49, "DOM"], ["Богота", -74.07, 4.71, "COL"], ["Каракас", -66.9, 10.48, "VEN"],
  ["Кито", -78.47, -0.18, "ECU"], ["Лима", -77.04, -12.05, "PRU"], ["Ла-Пас", -68.15, -16.5, "BOL"],
  ["Рио-де-Жанейро", -43.17, -22.91, "BRA"], ["Сан-Паулу", -46.63, -23.55], ["Асунсьон", -57.58, -25.26, "PAR"],
  ["Монтевидео", -56.16, -34.9, "URU"], ["Буэнос-Айрес", -58.38, -34.6, "ARG"], ["Сантьяго", -70.67, -33.45, "CHL"],
];

export default {
  id: "1911",
  basemap: "world_1914",
  source: "Borders: aourednik/historical-basemaps (world_1914, GPL-3.0) adjusted to 1911; provinces: Natural Earth admin-1 (public domain).",
  OWNER_BY_NAME,
  ADM0_OWNER,
  ADM1_OWNER,
  CUSTOM_GROUPS,
  post,
  CITIES,
};
