/**
 * recursosLinguisticos.js
 * ---------------------------------------------------------------------------
 * Listas de palabras y reglas del español que usa el traductor.
 * Están separadas del algoritmo (traductor.js) para que puedas agregar
 * palabras sin tocar la lógica.
 *
 * Todas estas reglas son HEURÍSTICAS de prototipo: deben revisarse con
 * intérpretes de LSM y personas de la comunidad Sorda.
 */

/**
 * Expresiones de varias palabras que se sustituyen ANTES de separar en
 * palabras. El texto de la derecha usa palabras que sí están en el léxico.
 * Los tokens con guion bajo (ej. "que_preg") son marcas internas para
 * distinguir "qué" (pregunta) de "que" (conjunción).
 */
export const MULTIPALABRA = [
  ["lengua de señas mexicana", "lengua señas mexico"],
  ["lengua de senas mexicana", "lengua señas mexico"],
  ["cómo te llamas", "tu nombre que_preg"],
  ["como te llamas", "tu nombre que_preg"],
  ["cómo se llama", "nombre que_preg"],
  ["como se llama", "nombre que_preg"],
  ["cómo estás", "tu como_preg"],
  ["como estas", "tu como_preg"],
  ["mucho gusto", "gusto"],
  ["hasta luego", "adios"],
  ["nos vemos", "adios"],
  ["por favor", "favor"],
  ["por qué", "porque_preg"],
  ["me llamo", "yo nombre"],
  ["te llamas", "tu nombre"],
  ["se llama", "nombre"],
  ["en línea", "internet"],
  ["en linea", "internet"],
  ["sin embargo", ""],
  ["de acuerdo", "si_afirm"],
  ["buenos días", "bueno dia"],
  ["buenas tardes", "bueno tarde"],
  ["buenas noches", "bueno noche"],
];

/**
 * Palabras cuya tilde cambia el significado (tilde diacrítica).
 * Se revisan antes de quitar los acentos.
 */
export const DIACRITICOS = {
  "él": "el_pron",
  "sí": "si_afirm",
  "sé": "se_v",
  "qué": "que_preg",
  "cómo": "como_preg",
  "cuándo": "cuando_preg",
  "dónde": "donde",
  "quién": "quien",
  "cuál": "cual",
  "cuánto": "cuanto",
  "cuánta": "cuanta",
  "cuántos": "cuantos",
  "cuántas": "cuantas",
};

/**
 * Si la oración es una pregunta y EMPIEZA con una de estas palabras escritas
 * sin tilde (algo muy común al teclear), se trata como interrogativa.
 */
export const INTERROGATIVO_SIN_TILDE = {
  que: "que_preg",
  como: "como_preg",
  cuando: "cuando_preg",
};

/**
 * Palabras funcionales que la LSM no expresa con una seña propia:
 * artículos, cópulas (ser / estar), preposiciones, clíticos, etc.
 */
export const PALABRAS_VACIAS = new Set(
  (
    "el la los las un una unos unas lo al del de a en y e o u ni que para por con " +
    "se le les es son ser estar esta estan está están soy eres somos fue fueron era " +
    "eran sera será estoy estas estamos estado sido siendo muy mas más pero sin sobre " +
    "este esto estos estas ese esa esos esas aquel cual_rel cuyo cuya si como cuando " +
    "ha han he has hemos haber hay también tambien ya solo sólo entre hasta desde según " +
    "segun mediante durante tras ante bajo cada otro otra otros otras mismo misma"
  ).split(/\s+/)
);

/** Verbos irregulares: forma conjugada → infinitivo. */
export const IRREGULARES = {
  voy: "ir", vas: "ir", va: "ir", vamos: "ir", van: "ir", fui: "ir", iba: "ir",
  tengo: "tener", tienes: "tener", tiene: "tener", tenemos: "tener", tienen: "tener", tuve: "tener",
  puedo: "poder", puedes: "poder", puede: "poder", podemos: "poder", pueden: "poder", pude: "poder",
  quiero: "querer", quieres: "querer", quiere: "querer", queremos: "querer", quieren: "querer",
  vengo: "venir", vienes: "venir", viene: "venir", venimos: "venir", vienen: "venir", vine: "venir",
  hago: "hacer", haces: "hacer", hace: "hacer", hacemos: "hacer", hacen: "hacer", hice: "hacer", hizo: "hacer",
  se_v: "saber", sabe: "saber", sabes: "saber", sabemos: "saber", saben: "saber",
  entiendo: "entender", entiendes: "entender", entiende: "entender", entienden: "entender",
  pido: "solicitar", pide: "solicitar", piden: "solicitar",
  oigo: "oir", oye: "oir", oyen: "oir",
  llego: "llegar", llega: "llegar", llegan: "llegar",
};

/**
 * Terminaciones verbales (de la más larga a la más corta). Para lematizar se
 * quita la terminación y se prueba raíz + "ar" / "er" / "ir".
 * Ej.: "necesitas" → "necesit" → "necesitar" ✔
 */
export const SUFIJOS_VERBALES = [
  "aremos", "eremos", "iremos", "abamos", "ieron", "aron", "iendo", "ando", "amos", "emos", "imos",
  "aste", "iste", "aban", "aba", "ado", "ada", "ido", "ida", "ian", "ia", "an", "en", "as", "es",
  "ar", "er", "ir", "o", "a", "e",
];

/** Pronombres pegados al final del verbo: "ayudar-te", "registrar-se". */
export const CLITICOS = ["selo", "sela", "nos", "se", "te", "me", "lo", "la", "le"];

/** Glosas de tiempo que en LSM suelen ir al inicio de la oración. */
export const GLOSAS_TEMPORALES = new Set(["HOY", "AYER", "MAÑANA"]);

/**
 * Sujeto implícito. El español omite el sujeto ("tengo" = "yo tengo"),
 * pero en LSM se suele señalar. Se deduce de la terminación del verbo.
 */
export const PERSONA_POR_SUFIJO = {
  o: "YO",
  as: "TÚ",
  es: "TÚ",
  amos: "NOSOTROS",
  emos: "NOSOTROS",
  imos: "NOSOTROS",
};

/** Sujeto implícito de los verbos irregulares. */
export const PERSONA_IRREGULAR = {
  voy: "YO", tengo: "YO", puedo: "YO", quiero: "YO", vengo: "YO", hago: "YO", se_v: "YO",
  entiendo: "YO", pido: "YO", oigo: "YO", llego: "YO",
  vas: "TÚ", tienes: "TÚ", puedes: "TÚ", quieres: "TÚ", vienes: "TÚ", haces: "TÚ", sabes: "TÚ", entiendes: "TÚ",
  vamos: "NOSOTROS", tenemos: "NOSOTROS", podemos: "NOSOTROS", queremos: "NOSOTROS", venimos: "NOSOTROS",
  hacemos: "NOSOTROS", sabemos: "NOSOTROS",
};
