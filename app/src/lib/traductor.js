/**
 * traductor.js
 * ---------------------------------------------------------------------------
 * Traductor por reglas: ESPAÑOL (texto) → GLOSAS de LSM.
 *
 * Una "glosa" es la etiqueta en mayúsculas que representa una seña, por
 * ejemplo  "Me llamo Marlon"  →  YO NOMBRE DT(M-A-R-L-O-N)
 *
 * No depende de React ni del navegador: lo usan igual el widget (React) y
 * los scripts de Node que generan el dataset. Así lo que ves en pantalla y
 * lo que se guarda en el dataset salen exactamente del mismo código.
 *
 * Pasos por cada oración (ver traducirOracion):
 *   1. Separar signos de puntuación y aplicar expresiones multipalabra.
 *   2. Partir en palabras.
 *   3. Resolver tildes diacríticas (él/el, qué/que, sí/si...).
 *   4. Quitar palabras vacías (artículos, ser/estar, preposiciones...).
 *   5. Lematizar y buscar en el léxico → glosa.  Si no existe → dactilología.
 *   6. Insertar sujeto implícito (tengo → YO TENER).
 *   7. Reordenar: tiempo al inicio, NO al final, interrogativos al final.
 */

import {
  MULTIPALABRA,
  DIACRITICOS,
  INTERROGATIVO_SIN_TILDE,
  PALABRAS_VACIAS,
  IRREGULARES,
  SUFIJOS_VERBALES,
  CLITICOS,
  GLOSAS_TEMPORALES,
  PERSONA_POR_SUFIJO,
  PERSONA_IRREGULAR,
} from "./recursosLinguisticos.js";

/* ------------------------------------------------------------------------- */
/* Utilidades de texto                                                       */
/* ------------------------------------------------------------------------- */

/** Quita acentos y la tilde de la ñ:  "Señás" → "Senas". */
export function quitarAcentos(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Clave con la que se busca en el léxico: minúsculas y sin acentos. */
export function claveDeBusqueda(palabra) {
  return quitarAcentos(palabra.toLowerCase());
}

/**
 * Separa una palabra en letras para deletrearla con el alfabeto manual
 * (dactilología). Conserva la Ñ y quita los acentos de las vocales.
 *   "Xalapa" → ["X","A","L","A","P","A"]
 */
export function deletrear(palabra) {
  const limpia = palabra
    .toUpperCase()
    .replace(/[^A-ZÑÁÉÍÓÚÜ0-9]/g, "")
    .replace(/[ÁÉÍÓÚÜ]/g, (vocal) => quitarAcentos(vocal));
  return limpia.split("");
}

/* ------------------------------------------------------------------------- */
/* Lematización: palabra → glosa                                             */
/* ------------------------------------------------------------------------- */

/**
 * Busca la glosa de una palabra probando, en orden:
 *   1. la palabra exacta en el léxico
 *   2. verbos irregulares (tengo → tener)
 *   3. plural (documentos → documento)
 *   4. clíticos pegados al verbo (ayudarte → ayudar)
 *   5. terminaciones verbales (necesitas → necesitar)
 *
 * @param {string} clave   palabra en minúsculas y sin acentos
 * @param {object} lexico  { palabra: GLOSA }
 * @returns {{glosa: string, regla: string, persona?: string} | null}
 */
export function lematizar(clave, lexico) {
  // 1. Exacta
  if (lexico[clave]) {
    return { glosa: lexico[clave], regla: "lexico" };
  }

  // 2. Irregular
  if (IRREGULARES[clave] && lexico[IRREGULARES[clave]]) {
    return {
      glosa: lexico[IRREGULARES[clave]],
      regla: "irregular",
      persona: PERSONA_IRREGULAR[clave],
    };
  }

  // 3. Plural: primero "-es" (papeles → papel), luego "-s"
  if (clave.length > 3 && clave.endsWith("es") && lexico[clave.slice(0, -2)]) {
    return { glosa: lexico[clave.slice(0, -2)], regla: "plural" };
  }
  if (clave.length > 2 && clave.endsWith("s") && lexico[clave.slice(0, -1)]) {
    return { glosa: lexico[clave.slice(0, -1)], regla: "plural" };
  }

  // 4. Clítico: solo si lo que queda parece infinitivo o gerundio
  for (const clitico of CLITICOS) {
    if (clave.length > clitico.length + 3 && clave.endsWith(clitico)) {
      const base = clave.slice(0, -clitico.length);
      if (/(ar|er|ir|ando|iendo)$/.test(base)) {
        const resultado = lematizar(base, lexico);
        if (resultado) {
          return { glosa: resultado.glosa, regla: "clitico+" + resultado.regla };
        }
      }
    }
  }

  // 5. Terminación verbal → raíz + ar / er / ir
  for (const sufijo of SUFIJOS_VERBALES) {
    if (clave.length > sufijo.length + 2 && clave.endsWith(sufijo)) {
      const raiz = clave.slice(0, -sufijo.length);
      for (const infinitivo of [raiz + "ar", raiz + "er", raiz + "ir"]) {
        if (lexico[infinitivo]) {
          return {
            glosa: lexico[infinitivo],
            regla: "verbo:" + sufijo,
            persona: PERSONA_POR_SUFIJO[sufijo],
          };
        }
      }
    }
  }

  return null; // no se encontró: se deletreará
}

/* ------------------------------------------------------------------------- */
/* Traducción de una oración                                                 */
/* ------------------------------------------------------------------------- */

/**
 * Traduce UNA oración.
 *
 * @param {string} oracion
 * @param {object} diccionario  { glosas, lexico } (ver lsm-diccionario.json)
 * @returns {{
 *   oracion: string,
 *   pregunta: boolean,
 *   tokens: Array<Token>,
 *   glosa: string
 * }}
 *
 * Cada Token es:
 *   { tipo: "sena" | "dactilologia" | "numero",
 *     glosa: "CASA" | "DT(X-A-L-A-P-A)" | "#3",
 *     original: palabra en español,
 *     regla: cómo se obtuvo (lexico, plural, verbo:as, sin-seña...),
 *     cat: categoría gramatical (solo señas),
 *     letras: [...] (solo dactilología y números) }
 */
export function traducirOracion(oracion, diccionario) {
  const { lexico = {}, glosas = {} } = diccionario;
  const esPregunta = /[¿?]/.test(oracion);

  // --- Paso 1: separar puntuación y aplicar expresiones multipalabra -------
  let texto =
    " " +
    oracion
      .toLowerCase()
      .replace(/([¿?¡!.,;:()"])/g, " $1 ")
      .replace(/\s+/g, " ") +
    " ";
  for (const [frase, reemplazo] of MULTIPALABRA) {
    texto = texto.split(" " + frase + " ").join(" " + reemplazo + " ");
  }

  // --- Paso 2: partir en palabras (letras, guion bajo o números) -----------
  const palabras = texto.match(/[a-záéíóúüñ_]+|\d+/gi) || [];

  const tokens = [];
  palabras.forEach((palabraOriginal, posicion) => {
    let palabra = palabraOriginal;

    // --- Paso 3: tildes diacríticas ----------------------------------------
    if (DIACRITICOS[palabra]) {
      palabra = DIACRITICOS[palabra];
    } else if (esPregunta && posicion === 0 && INTERROGATIVO_SIN_TILDE[palabra]) {
      palabra = INTERROGATIVO_SIN_TILDE[palabra];
    }

    const esMarcaInterna = palabra.indexOf("_") > 0; // que_preg, el_pron...

    // Números: se deletrean dígito por dígito
    if (!esMarcaInterna && /^\d+$/.test(palabra)) {
      tokens.push({
        tipo: "numero",
        glosa: "#" + palabra,
        letras: palabra.split(""),
        original: palabraOriginal,
        regla: "numero",
      });
      return;
    }

    const clave = esMarcaInterna ? palabra : claveDeBusqueda(palabra);

    // --- Paso 4: palabras vacías ------------------------------------------
    if (PALABRAS_VACIAS.has(palabra) || PALABRAS_VACIAS.has(clave)) return;

    // --- Paso 5: buscar la seña ---------------------------------------------
    const encontrada = lematizar(clave, lexico);
    if (encontrada) {
      const info = glosas[encontrada.glosa] || {};
      tokens.push({
        tipo: "sena",
        glosa: encontrada.glosa,
        original: palabraOriginal,
        regla: encontrada.regla,
        persona: encontrada.persona,
        cat: info.cat || null,
        nm: info.nm || null,
      });
    } else {
      // Sin seña en el diccionario → dactilología (deletrear)
      const letras = deletrear(palabraOriginal.replace(/_.*/, ""));
      if (letras.length) {
        tokens.push({
          tipo: "dactilologia",
          glosa: "DT(" + letras.join("-") + ")",
          letras,
          original: palabraOriginal,
          regla: "sin-seña",
        });
      }
    }
  });

  // --- Paso 6: sujeto implícito ---------------------------------------------
  // Si no hay ningún pronombre, se agrega antes del primer verbo conjugado.
  const hayPronombre = tokens.some((t) => t.cat === "pronombre");
  if (!hayPronombre) {
    const i = tokens.findIndex((t) => t.persona && glosas[t.persona]);
    if (i >= 0) {
      tokens.splice(i, 0, {
        tipo: "sena",
        glosa: tokens[i].persona,
        original: "(" + tokens[i].original + ")",
        regla: "sujeto-implicito",
        cat: "pronombre",
        nm: null,
      });
    }
  }

  // --- Paso 7: reordenar ------------------------------------------------------
  const tiempo = [];
  const negacion = [];
  const interrogativos = [];
  const resto = [];
  for (const t of tokens) {
    if (t.tipo === "sena" && GLOSAS_TEMPORALES.has(t.glosa)) tiempo.push(t);
    else if (t.tipo === "sena" && t.glosa === "NO") negacion.push(t);
    else if (t.tipo === "sena" && t.cat === "interrogativo") interrogativos.push(t);
    else resto.push(t);
  }
  const ordenados = [...tiempo, ...resto, ...negacion, ...interrogativos];

  // Quitar repeticiones seguidas ("trámites y gestiones" → TRÁMITE)
  const finales = ordenados.filter((t, i) => i === 0 || ordenados[i - 1].glosa !== t.glosa);

  if (esPregunta && finales.length) finales[finales.length - 1].pregunta = true;

  return {
    oracion: oracion.trim(),
    pregunta: esPregunta,
    tokens: finales,
    glosa: finales.map((t) => t.glosa).join(" ") + (esPregunta && finales.length ? " ?" : ""),
  };
}

/* ------------------------------------------------------------------------- */
/* Traducción de un texto completo                                           */
/* ------------------------------------------------------------------------- */

/**
 * Parte el texto en oraciones (por . ! ? ; o salto de línea) y traduce cada una.
 * @returns {Array} una entrada por oración (ver traducirOracion)
 */
export function traducir(texto, diccionario) {
  const oraciones = (texto || "").replace(/\s+/g, " ").match(/[^.!?\n;]+[.!?;]*/g) || [];
  return oraciones
    .map((o) => o.trim())
    .filter((o) => o.replace(/[¿?¡!.,;:\s]/g, "").length > 0)
    .map((o) => traducirOracion(o, diccionario));
}

/* ------------------------------------------------------------------------- */
/* Métrica de evaluación                                                     */
/* ------------------------------------------------------------------------- */

/**
 * WER (Word Error Rate) a nivel glosa: cuántas sustituciones, inserciones y
 * borrados hacen falta para pasar de la hipótesis a la referencia, dividido
 * entre el largo de la referencia. 0 = idénticas.
 *
 * Se calcula con distancia de edición (programación dinámica).
 */
export function wer(hipotesis, referencia) {
  const h = hipotesis.trim().split(/\s+/).filter(Boolean);
  const r = referencia.trim().split(/\s+/).filter(Boolean);
  if (!r.length) return 0;

  // d[i][j] = costo de convertir los primeros j elementos de h en los primeros i de r
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;

  for (let i = 1; i <= r.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      const sustitucion = d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1);
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, sustitucion);
    }
  }
  return d[r.length][h.length] / r.length;
}
