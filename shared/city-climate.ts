export type CityClimateProfile = {
  country: string;
  city: string;
  climateZone: string;
  windExposure: string;
  rainfallExposure: string;
  snow: { groundLoad: number; status: "not-applicable" | "to-confirm" };
  seismic: { zone: string; coefficient?: number; status: "to-confirm" };
  wind: { zone?: string; basicSpeed?: number; pressure?: number; status: "to-confirm" };
  source: string;
  note: string;
};

const CCKP = "https://climateknowledgeportal.worldbank.org/";
const city = (country: string, city: string, climateZone: string, windExposure: string, rainfallExposure: string, note: string): CityClimateProfile => ({ country, city, climateZone, windExposure, rainfallExposure, snow: { groundLoad: 0, status: "to-confirm" }, seismic: { zone: "À déterminer selon le référentiel français sélectionné et l’étude de sol du site", status: "to-confirm" }, wind: { zone: "Référentiel français sélectionné; pression/exposition à confirmer pour le site", status: "to-confirm" }, source: CCKP, note });

export const CITY_CLIMATE_PROFILES: Record<string, CityClimateProfile[]> = {
  "Sénégal": [
    city("Sénégal", "Dakar", "côtier sahélien", "exposition maritime et urbaine", "pluviométrie saisonnière", "Tenir compte de l’exposition côtière, de la corrosion et du site exact."),
    city("Sénégal", "Thiès", "sahélien de transition", "exposition intérieure modérée", "pluviométrie saisonnière", "Confirmer la zone de vent selon l’emplacement et la hauteur du bâtiment."),
    city("Sénégal", "Saint-Louis", "côtier sahélien", "exposition maritime forte", "pluviométrie faible à saisonnière", "Vérifier l’exposition maritime et les effets de corrosion."),
    city("Sénégal", "Touba", "sahélien intérieur", "exposition intérieure", "pluviométrie saisonnière", "Confirmer les paramètres locaux auprès du référentiel applicable."),
    city("Sénégal", "Kaolack", "sahélien intérieur", "exposition intérieure", "pluviométrie saisonnière", "Vérifier le sol et l’agressivité environnementale du site."),
    city("Sénégal", "Ziguinchor", "soudano-guinéen humide", "exposition tropicale et pluvieuse", "pluviométrie élevée saisonnière", "Prendre en compte humidité, pluie et durabilité des matériaux."),
  ],
  "Mauritanie": [
    city("Mauritanie", "Nouakchott", "désertique côtier", "exposition maritime et vents de sable", "pluviométrie très faible", "Vérifier vent, sable, corrosion saline et portance des sols."),
    city("Mauritanie", "Nouadhibou", "désertique côtier", "exposition maritime forte et vents de sable", "pluviométrie très faible", "L’exposition maritime doit être confirmée pour la durabilité et le vent."),
    city("Mauritanie", "Rosso", "sahélien fluvial", "exposition intérieure", "pluviométrie saisonnière", "Vérifier nappe, inondabilité et étude géotechnique."),
    city("Mauritanie", "Kaédi", "sahélien fluvial", "exposition intérieure", "pluviométrie saisonnière", "Vérifier les sols alluviaux et le risque d’eau."),
    city("Mauritanie", "Atar", "désertique intérieur", "vents de sable et forte amplitude thermique", "pluviométrie très faible", "Prendre en compte l’amplitude thermique et les sols arides."),
    city("Mauritanie", "Kiffa", "sahélien aride", "exposition intérieure", "pluviométrie saisonnière", "Confirmer les paramètres de vent et de sol au site."),
  ],
  "Mali": [
    city("Mali", "Bamako", "soudanien de transition", "exposition intérieure", "pluviométrie saisonnière marquée", "Vérifier ruissellement, sols et paramètres de vent locaux."),
    city("Mali", "Sikasso", "soudanien humide", "exposition intérieure", "pluviométrie élevée saisonnière", "Prendre en compte l’humidité, les pluies et la durabilité."),
    city("Mali", "Ségou", "sahélien soudanien", "exposition intérieure", "pluviométrie saisonnière", "Confirmer sol, ruissellement et zone de vent."),
    city("Mali", "Mopti", "sahélien fluvial", "exposition intérieure", "pluviométrie saisonnière", "Vérifier les sols alluviaux et le risque d’eau."),
    city("Mali", "Kayes", "sahélien chaud", "exposition intérieure et thermique", "pluviométrie saisonnière", "Prendre en compte l’amplitude thermique et l’étude géotechnique."),
    city("Mali", "Gao", "sahélien aride", "vents de poussière et forte amplitude thermique", "pluviométrie très faible à saisonnière", "Confirmer les actions de vent et les conditions de sol."),
    city("Mali", "Tombouctou", "désertique sahélien", "vents de sable et forte amplitude thermique", "pluviométrie très faible", "Vérifier les effets de sable, vent et portance du sol."),
  ],
  "Gambie": [
    city("Gambie", "Banjul", "tropical côtier", "exposition maritime et urbaine", "pluviométrie élevée saisonnière", "Vérifier corrosion, pluie intense, vent côtier et sols compressibles."),
    city("Gambie", "Serekunda", "tropical côtier urbanisé", "exposition maritime et urbaine", "pluviométrie élevée saisonnière", "Prendre en compte l’exposition côtière et le drainage du site."),
    city("Gambie", "Brikama", "tropical de transition", "exposition intérieure à influence côtière", "pluviométrie élevée saisonnière", "Confirmer les actions climatiques et le sol local."),
    city("Gambie", "Bakau", "tropical côtier", "exposition maritime forte", "pluviométrie élevée saisonnière", "Vérifier corrosion, vent et pluie selon l’exposition exacte."),
    city("Gambie", "Farafenni", "soudanien sahélien", "exposition intérieure", "pluviométrie saisonnière", "Confirmer la zone de vent et les conditions géotechniques."),
    city("Gambie", "Basse Santa Su", "soudanien humide", "exposition intérieure", "pluviométrie saisonnière", "Prendre en compte humidité, ruissellement et sol."),
  ],
};

export function getCitiesForCountry(country: string): CityClimateProfile[] { return CITY_CLIMATE_PROFILES[country] ?? []; }
export function getCityClimateProfile(country: string, cityName = ""): CityClimateProfile | undefined {
  const cities = getCitiesForCountry(country);
  const requestedCity = cityName.trim();
  if (!requestedCity) return undefined;
  return cities.find(item => item.city.toLocaleLowerCase("fr") === requestedCity.toLocaleLowerCase("fr"));
}
