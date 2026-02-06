import pdfplumber
import re

pdf = r'F:\1. Cloud\4. AI\1. Antigravity\conciliacion\data\Bancolombia\Movimientos\2026-01 FondoRenta.pdf'

with pdfplumber.open(pdf) as p:
    texto = p.pages[0].extract_text()
    lineas = texto.split('\n')
    patron_fecha = re.compile(r'^\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(.+)$')
    patron_valor = re.compile(r'(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)')

    print("EXTRACCION FONDORENTA")
    print("=" * 60)

    n = 0
    for i, lin in enumerate(lineas):
        lin = lin.strip()
        m = patron_fecha.match(lin)
        if not m:
            continue
        dia, mes, anio, resto = m.groups()
        vals = [x.group(1) for x in patron_valor.finditer(resto)]
        if not vals:
            continue

        desc = lineas[i-1].strip() if i > 0 else ''
        if 'fecha' in desc.lower():
            desc = ''
        if i+1 < len(lineas) and lineas[i+1].strip().lower() == 'de ahorros':
            desc = desc + ' de ahorros'

        signo = '-' if '-' in resto else '+'
        n += 1
        print(f"{n}. {dia}/{mes}/{anio} | {desc} | {signo}{vals[-1]}")

    print("=" * 60)
    print(f"Total: {n} registros")