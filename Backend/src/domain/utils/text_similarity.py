"""
Utilidades de similitud de texto para comparaciones descriptivas.
Funciones puras sin dependencias de infraestructura.
"""
import unicodedata
from difflib import SequenceMatcher


def normalizar_acentos(texto: str) -> str:
    """Elimina acentos y diacríticos de un texto para comparación."""
    if not texto:
        return ""
    # NFD descompone caracteres (é → e + ́), luego filtramos los diacríticos
    nfkd = unicodedata.normalize('NFKD', texto)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))

def calcular_similitud_texto(texto1: str, texto2: str) -> float:
    """
    Calcula la similitud entre dos textos usando SequenceMatcher.
    Retorna un valor entre 0 y 100 (porcentaje de similitud).
    """
    if not texto1 or not texto2:
        return 0.0

    # Normalizar textos: minúsculas y sin espacios extras
    t1 = " ".join(texto1.lower().split())
    t2 = " ".join(texto2.lower().split())

    # Calcular similitud
    ratio = SequenceMatcher(None, t1, t2).ratio()
    return ratio * 100

def calcular_similitud_palabras(texto1: str, texto2: str) -> float:
    """
    Calcula similitud basada en palabras compartidas usando el coeficiente de Jaccard.
    Retorna un valor entre 0 y 100 (porcentaje de similitud).

    Esta métrica es más robusta para textos con palabras en diferente orden.
    Ejemplo: "PAGO TC MASTER" vs "MASTER TC PAGO" → alta similitud
    """
    if not texto1 or not texto2:
        return 0.0

    # Normalizar y extraer palabras
    palabras1 = set(texto1.lower().split())
    palabras2 = set(texto2.lower().split())

    # Eliminar palabras muy cortas (1-2 caracteres) que no aportan significado
    palabras1 = {p for p in palabras1 if len(p) > 2}
    palabras2 = {p for p in palabras2 if len(p) > 2}

    if not palabras1 or not palabras2:
        return 0.0

    # Coeficiente de Jaccard: |intersección| / |unión|
    comunes = palabras1.intersection(palabras2)
    union = palabras1.union(palabras2)

    return (len(comunes) / len(union)) * 100

def calcular_similitud_hibrida(texto1: str, texto2: str) -> float:
    """
    Combina similitud de palabras (Jaccard) y similitud de secuencia (SequenceMatcher).

    Pesos:
    - 60% similitud de palabras (más importante para coincidencias conceptuales)
    - 40% similitud de secuencia (importante para orden y estructura)

    Retorna un valor entre 0 y 100 (porcentaje de similitud).
    """
    sim_palabras = calcular_similitud_palabras(texto1, texto2)
    sim_secuencia = calcular_similitud_texto(texto1, texto2)

    # Peso: 60% palabras, 40% secuencia
    return (sim_palabras * 0.6) + (sim_secuencia * 0.4)
