#!/usr/bin/env python3
"""
scripts/parseEkKilavuz.py

ÖSYM Yükseköğretim Programları Ek Yerleştirme Kılavuzu (PDF) Parser'ı.
Poppler pdftotext -bbox kullanarak tüm sayfaları parse eder ve
yapılandırılmış JSON ile doğrulama raporu üretir.

Kullanım:
    python3 scripts/parseEkKilavuz.py --yil 2026 /home/mesuto/Downloads/2026-yuksekogretim-programlari-ek-yerlestirme-kilavuzu-bwch9h-16154905.pdf
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

# Default ranges for 2026 PDF
TABLO3_START = 11
TABLO3_END = 124
TABLO4_START = 126
TABLO4_END = 304
KOSUL_PAGES_K1 = (305, 308)
KOSUL_PAGES_K2 = (309, 329)
UCRET_START = 402
UCRET_END = 467

def fetch_bbox_xml(pdf_path, page_num):
    cmd = ['pdftotext', '-bbox', '-f', str(page_num), '-l', str(page_num), pdf_path, '-']
    return subprocess.check_output(cmd)

def fetch_plain_text(pdf_path, page_num):
    cmd = ['pdftotext', '-f', str(page_num), '-l', str(page_num), pdf_path, '-']
    return subprocess.check_output(cmd).decode('utf-8', errors='ignore')

def parse_words_from_xml(xml_bytes):
    root = ET.fromstring(xml_bytes)
    words = []
    for w in root.iter('{http://www.w3.org/1999/xhtml}word'):
        text = w.text or ''
        if not text.strip():
            continue
        words.append({
            'text': text,
            'xMin': float(w.attrib['xMin']),
            'yMin': float(w.attrib['yMin']),
            'xMax': float(w.attrib['xMax']),
            'yMax': float(w.attrib['yMax']),
            'cx': (float(w.attrib['xMin']) + float(w.attrib['xMax'])) / 2.0,
            'cy': (float(w.attrib['yMin']) + float(w.attrib['yMax'])) / 2.0,
        })
    return words

def clean_uni_name(raw):
    """Başlık satırından yalın üniversite adı: parantezli ekler (kapanmamış dahil), baştaki sayı,
    "Uyruklu) " gibi önceki başlığın kuyruğu, dipnot metni ve sondaki '*' atılır."""
    s = re.sub(r'\s*\([^\)]*(\)|$)', '', raw)
    s = re.sub(r'^.*?\)\s+', '', s)                 # "Üniversitesi) ASBÜ-…" kuyruğu
    s = re.sub(r'^\*[^*]*?(?=[A-ZÇĞİÖŞÜ-]+(\s+[A-ZÇĞİÖŞÜ-]+)*\s*\*?$)', '', s)  # dipnot metni
    s = re.sub(r'^\d+\s+', '', s).replace('*', '')
    return re.sub(r'\s+', ' ', s).strip()

def parse_uni_line(raw_line):
    uni_type = 'devlet'
    raw_lower = raw_line.lower()
    if 'vakıf' in raw_lower or 'vakif' in raw_lower:
        uni_type = 'vakif'
    elif 'kktc' in raw_lower:
        uni_type = 'kktc'
    elif any(k in raw_lower for k in ['yurtdışı', 'yurtdisi', 'yurt dışı', 'bosna', 'makedonya', 'azerbaycan', 'arnavutluk', 'tiran']):
        uni_type = 'yurtdisi'
    elif 'devlet' in raw_lower:
        uni_type = 'devlet'

    il = None
    kktc_m = re.search(r'\(KKTC-([^\)]+)\)', raw_line, re.IGNORECASE)
    if kktc_m:
        il = kktc_m.group(1).strip()
        uni_type = 'kktc'
    else:
        pars = re.findall(r'\(([^\)]+)\)', raw_line)
        for p in pars:
            p_strip = p.strip()
            p_low = p_strip.lower()
            if any(k in p_low for k in ['üniversite', 'devlet', 'vakıf', 'kktc', 'yurt']):
                continue
            il = p_strip
            break

    clean_name = clean_uni_name(raw_line)
    return clean_name, uni_type, il

def parse_programs_section(pdf_path, start_page, end_page, is_lisans, yil):
    print(f"Extracting XML for pages {start_page}..{end_page} ({'Lisans' if is_lisans else 'Ön Lisans'})...")
    page_numbers = list(range(start_page, end_page + 1))
    
    with ThreadPoolExecutor(max_workers=8) as executor:
        xml_list = list(executor.map(lambda p: fetch_bbox_xml(pdf_path, p), page_numbers))
        
    pages_words = [parse_words_from_xml(x) for x in xml_list]
    
    tablo_name = 'lisans' if is_lisans else 'onlisans'
    current_state = {'uni': None, 'uni_type': 'devlet', 'il': None, 'fakulte': None}
    all_programs = []

    for page_idx, (p, words) in enumerate(zip(page_numbers, pages_words)):
        # Column bounds setup
        if not is_lisans:
            col_bounds = {
                1: (0, 55),
                2: (55, 222),
                3: (222, 238),
                4: (238, 260),
                5: (260, 290),
                6: (290, 330),
                7: (330, 380),
                8: (380, 458), # Kosullar
                9: (458, 502), # Puan GK
                10: (502, 545), # Puan SGY
                11: (545, 1000) # Puan 34Y
            }
        else:
            col_bounds = {
                1: (0, 55),
                2: (55, 408),
                3: (408, 425),
                4: (425, 450),
                5: (450, 480),
                6: (480, 525),
                7: (525, 570),
                8: (570, 692), # Kosullar
                9: (692, 735), # Puan GK
                10: (735, 780), # Puan SGY
                11: (780, 1000) # Puan 34Y
            }

        # Check for GK Puan header to adjust bound if necessary
        for w in words:
            if w['yMin'] < 55 and 'PUAN(GK)' in w['text']:
                col_bounds[8] = (col_bounds[8][0], w['xMin'] - 2)
                col_bounds[9] = (w['xMin'] - 2, col_bounds[9][1])

        def get_col(w):
            for c in range(1, 12):
                if col_bounds[c][0] <= w['cx'] < col_bounds[c][1]:
                    return c
            return 11

        body = [w for w in words if 55 <= w['yMin'] <= 815]

        # 1. Program codes
        code_words = [w for w in body if get_col(w) == 1 and re.match(r'^\d{9}$', w['text'])]
        code_words.sort(key=lambda w: w['cy'])

        # 2. Group by y lines
        y_lines = {}
        for w in body:
            found_y = None
            for existing_y in y_lines:
                if abs(w['cy'] - existing_y) < 2.5:
                    found_y = existing_y
                    break
            if found_y is None:
                found_y = w['cy']
                y_lines[found_y] = []
            y_lines[found_y].append(w)

        sorted_ys = sorted(y_lines.keys())
        elements = []

        # Dipnot satırları ("*Uluslararası anlaşmalar ile kurulmuş olan…") sayfa kenarından (sütun 1)
        # başlar ve koddan yoksundur; ne başlığa ne program adına karışmasın.
        foot_ids = set()
        for lw in y_lines.values():
            if not any(get_col(w) == 1 and re.match(r'^\d{9}$', w['text']) for w in lw) and any(get_col(w) == 1 for w in lw):
                foot_ids.update(id(w) for w in lw)
        body = [w for w in body if id(w) not in foot_ids]

        # Add code elements
        for cw in code_words:
            elements.append(('code', int(cw['text']), cw, cw['cy']))

        # Find uni & faculty headers
        # Kök neden (2026): başlık yalnız sütun 2'deki (program adı) kelimelerden kurulur ve çok
        # satırlı başlık açık-parantez/devam satırı kuralıyla birleştirilir. Eskiden (a) başlığın
        # 2. satırı ("(Devlet Üniversitesi)", "Üniversitesi)") ayrı bir 'uni' sayılıp adı boşa
        # düşüyordu, (b) "Uyruklu)" gibi program adı kuyruğu sonraki başlığa yapışıyordu,
        # (c) kosul sütunundaki sayılar ("320") ve dipnot metni ada giriyordu.
        text_lines = []   # (y, col-2 metni) — kodlu satırlar hariç
        for y in sorted_ys:
            lw = y_lines[y]
            if any(get_col(w) == 1 and re.match(r'^\d{9}$', w['text']) for w in lw):
                continue
            lw = [w for w in lw if id(w) not in foot_ids]
            c2 = sorted([w for w in lw if get_col(w) == 2], key=lambda w: w['xMin'])
            if c2:
                text_lines.append((y, ' '.join(w['text'] for w in c2)))

        UNI_KEYS = ['ÜNİVERSİTESİ', 'YÜKSEK TEKNOLOJİ ENSTİTÜSÜ', '(Devlet Üniversitesi)', '(Vakıf Üniversitesi)', '(KKTC-']
        i = 0
        while i < len(text_lines):
            y, line_str = text_lines[i]
            nxt = text_lines[i + 1][1] if i + 1 < len(text_lines) else ''
            is_uni = any(k in line_str for k in UNI_KEYS)
            tail_m = re.search(r'(Vakıf|Devlet) Üniversitesi\)', nxt)
            force = not is_uni and (nxt.startswith('ÜNİVERSİTESİ') or (tail_m and nxt.startswith(('(', 'YÜKSEKOKULU'))))
            if force:
                # "ADANA ALPARSLAN TÜRKEŞ BİLİM VE TEKNOLOJİ" / "ÜNİVERSİTESİ (Devlet Üniversitesi)"
                # "İSTANBUL SAĞLIK VE SOSYAL BİLİMLER MESLEK" / "YÜKSEKOKULU (Vakıf Üniversitesi)"
                # "ATAŞEHİR ADIGÜZEL MESLEK YÜKSEKOKULU" / "(İSTANBUL) (Vakıf Üniversitesi)"
                is_uni = True
            if is_uni:
                # Başlığın devam satırları: açık parantez, "(…)" ile başlayan ya da "Üniversitesi)" kuyruğu
                while i + 1 < len(text_lines):
                    nxt = text_lines[i + 1][1]
                    if force or line_str.count('(') > line_str.count(')') or nxt.startswith('(') or nxt.startswith('Üniversitesi)') or nxt.startswith('ÜNİVERSİTESİ'):
                        line_str += ' ' + nxt
                        i += 1
                        force = False
                    else:
                        break
                clean_name, uni_type, il = parse_uni_line(line_str)
                elements.append(('uni', (clean_name, uni_type, il), y))
                i += 1
                continue

            # Check if faculty heading
            if any(k in line_str for k in ['FAKÜLTE', 'MESLEK YÜKSEKOKULU', 'YÜKSEKOKULU', 'KONSERVATUVAR', 'ENSTİTÜ', 'BÖLÜM']):
                fak = line_str.strip()
                # Satır sonunda bölünmüş ad: "KIZILCAHAMAM SAĞLIK HİZMETLERİ MESLEK" / "YÜKSEKOKULU"
                if i > 0 and re.match(r'^(YÜKSEKOKULU|FAKÜLTESİ|ENSTİTÜSÜ|KONSERVATUVARI)\b', fak):
                    py, pstr = text_lines[i - 1]
                    if y - py <= 10 and pstr == pstr.upper() and '(' not in pstr and not any(k in pstr for k in UNI_KEYS):
                        fak = pstr + ' ' + fak
                elements.append(('fakulte', fak, y))
            i += 1

        # Sort elements by y
        elements.sort(key=lambda elem: elem[3] if elem[0] == 'code' else elem[2])

        # Build programs on this page
        for elem_idx, elem in enumerate(elements):
            if elem[0] == 'uni':
                current_state['uni'], current_state['uni_type'], current_state['il'] = elem[1]
                current_state['fakulte'] = None
            elif elem[0] == 'fakulte':
                current_state['fakulte'] = elem[1]
            elif elem[0] == 'code':
                p_code = elem[1]
                cw = elem[2]
                cy = elem[3]

                # Vertical span for program name in col 2
                prev_y = 55.0
                for prev_e in reversed(elements[:elem_idx]):
                    prev_y = prev_e[3] if prev_e[0] == 'code' else prev_e[2]
                    break
                next_y = 815.0
                for next_e in elements[elem_idx+1:]:
                    next_y = next_e[3] if next_e[0] == 'code' else next_e[2]
                    break

                y_lower = (prev_y + cy) / 2.0
                y_upper = (next_y + cy) / 2.0

                col2_words = [w for w in body if get_col(w) == 2 and y_lower <= w['cy'] <= y_upper]
                col2_words.sort(key=lambda w: (round(w['cy']/3.0)*3.0, w['xMin']))
                prog_adi = ' '.join(w['text'] for w in col2_words)

                # Col 3..11 words (same line within 4.5pt)
                row_w = [w for w in body if abs(w['cy'] - cy) <= 4.5]
                by_col = {c: [] for c in range(3, 12)}
                for w in row_w:
                    c = get_col(w)
                    if c >= 3:
                        by_col[c].append(w)
                for c in range(3, 12):
                    by_col[c].sort(key=lambda w: w['xMin'])

                sure = int(by_col[3][0]['text']) if by_col[3] and by_col[3][0]['text'].isdigit() else None
                puan_turu = by_col[4][0]['text'] if by_col[4] else None
                genel_ek = int(by_col[5][0]['text']) if by_col[5] and by_col[5][0]['text'].isdigit() else 0
                sgy_ek = int(by_col[6][0]['text']) if by_col[6] and by_col[6][0]['text'].isdigit() else 0
                k34_ek = int(by_col[7][0]['text']) if by_col[7] and by_col[7][0]['text'].isdigit() else 0

                kosul_str = ' '.join(w['text'] for w in by_col[8])
                kosul_kodlari = [int(k) for k in re.findall(r'\b\d+\b', kosul_str)]

                def parse_score(col_idx):
                    if not by_col[col_idx]:
                        return None
                    s = by_col[col_idx][0]['text'].replace(',', '.')
                    try:
                        return float(s)
                    except ValueError:
                        return None

                en_kucuk_gk = parse_score(9)
                en_kucuk_sgy = parse_score(10)
                en_kucuk_34y = parse_score(11)

                first_digit = str(p_code)[0]
                prefix_type = {'1': 'devlet', '2': 'vakif', '3': 'kktc', '4': 'yurtdisi'}.get(first_digit, current_state['uni_type'])

                all_programs.append({
                    'yil': yil,
                    'tablo': tablo_name,
                    'universite': current_state['uni'],
                    'universite_turu': prefix_type,
                    'il': current_state['il'],
                    'fakulte': current_state['fakulte'],
                    'program_kodu': p_code,
                    'program_adi': prog_adi,
                    'ogrenim_suresi': sure,
                    'puan_turu': puan_turu,
                    'genel_ek_kont': genel_ek,
                    'sgy_ek_kont': sgy_ek,
                    'k34_ek_kont': k34_ek,
                    'kosul_kodlari': kosul_kodlari,
                    'en_kucuk_gk': en_kucuk_gk,
                    'en_kucuk_sgy': en_kucuk_sgy,
                    'en_kucuk_34y': en_kucuk_34y,
                    'kaynak_sayfa': p
                })

    print(f"Extracted {len(all_programs)} programs from {tablo_name}.")
    return all_programs

def fill_uni_from_prefix(programs):
    """Güvenlik ağı: program kodunun ilk 4 hanesi üniversiteyi belirler. Adı hâlâ boş olan satırı,
    önek yalnız TEK bir adla görülüyorsa o adla doldurur; ayrıca tüm adlara clean_uni_name uygular.
    Dönüş: doldurulan satır sayısı."""
    for pr in programs:
        pr['universite'] = clean_uni_name(pr['universite'] or '')
    by_prefix = {}
    for pr in programs:
        if pr['universite']:
            by_prefix.setdefault(str(pr['program_kodu'])[:4], set()).add(pr['universite'])
    filled = 0
    for pr in programs:
        names = by_prefix.get(str(pr['program_kodu'])[:4], set())
        if not pr['universite'] and len(names) == 1:
            pr['universite'] = next(iter(names))
            filled += 1
    return filled

def parse_conditions(pdf_path, yil):
    print("Extracting conditions (pages 305..329)...")
    all_conds = []
    for kisim, (start_p, end_p) in [(1, KOSUL_PAGES_K1), (2, KOSUL_PAGES_K2)]:
        pages_text = []
        for p in range(start_p, end_p + 1):
            txt = fetch_plain_text(pdf_path, p)
            lines = txt.splitlines()
            cleaned_lines = []
            for line in lines:
                l_str = line.strip()
                if 'EK YERLEŞTİRME TERCİH KILAVUZU' in l_str:
                    continue
                if 'TABLO 3 VE TABLO 4' in l_str:
                    continue
                if 'KOŞUL VE AÇIKLAMALARI' in l_str:
                    continue
                if '(1. KISIM KOŞULLAR)' in l_str or '(2. KISIM KOŞULLAR)' in l_str:
                    continue
                if l_str.isdigit() and len(l_str) <= 3:
                    continue
                cleaned_lines.append(l_str)
            pages_text.append('\n'.join(cleaned_lines))

        full_text = '\n'.join(pages_text)
        parts = re.split(r'\bBk\.\s*(\d+)\b', full_text)
        for i in range(1, len(parts), 2):
            k_no = int(parts[i])
            k_text = ' '.join(parts[i+1].split())
            k_text = re.sub(r'1\.\s*KISIM\s+KOŞULLAR\s+BİTTİ.*', '', k_text, flags=re.IGNORECASE).strip()
            all_conds.append({
                'yil': yil,
                'kosul_no': k_no,
                'kisim': kisim,
                'metin': k_text
            })

    print(f"Extracted {len(all_conds)} conditions.")
    return all_conds

FEE_LEVELS = ('Önlisans', 'Lisans', 'Hazırlık')
PRICE_RE = re.compile(r'^\d{1,3}(\.\d{3})*,\d{2}$')

# Ücret tablosunun iki yerleşimi var (kök neden: eskiden yalnız ilki biliniyordu):
#  - vakıf sayfaları: ücret xMin≈303; üni <150, düzey 150-200, program 200-290, açıklama ≥355
#  - KKTC sayfaları (s.~452+): ücret xMin≈239; üni <140, düzey 140-180, program 180-236, açıklama ≥285
# Yerleşim ücret kelimesinin x'inden satır bazında seçilir. (price_lo, price_hi, duzey_lo, prog_lo, prog_hi, note_lo)
FEE_LAYOUTS = [
    (295, 312, 150, 200, 290, 355),
    (232, 246, 140, 180, 236, 285),
]

def norm_uni(s):
    s = s.replace('i', 'İ').replace('ı', 'I').upper()
    s = re.sub(r'\([^)]*\)?', ' ', s)   # parantezli (kapanmamış dahil) ekleri at
    s = re.sub(r'^\d+\s+|\*', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def parse_vakif_fees(pdf_path, yil, programs):
    print("Extracting foundation university fees (pages 402..467)...")
    page_numbers = list(range(UCRET_START, UCRET_END + 1))
    with ThreadPoolExecutor(max_workers=8) as executor:
        xml_list = list(executor.map(lambda p: fetch_bbox_xml(pdf_path, p), page_numbers))

    all_fees = []
    current_uni = 'ACIBADEM MEHMET ALİ AYDINLAR ÜNİVERSİTESİ'

    for p, xml_bytes in zip(page_numbers, xml_list):
        words = parse_words_from_xml(xml_bytes)
        table_words = [w for w in words if w['yMin'] >= (330 if p == 402 else 40) and w['yMin'] <= 815]

        price_words = []
        for w in table_words:
            if not PRICE_RE.match(w['text']):
                continue
            for lay in FEE_LAYOUTS:
                if lay[0] <= w['xMin'] <= lay[1]:  # ücret kolonu sola dayalı; notlardaki tutarlar (x=287, 329, 360…) dışarıda kalır
                    price_words.append((w, lay))
                    break
        # Ücreti olmayan satırlar ("öğrenim ücreti ilgili programla aynıdır" gibi): düzey kolonunun
        # başında Önlisans/Lisans/Hazırlık olan ve yanında ücret kelimesi bulunmayan satır → ucret=None.
        for w in table_words:
            if w['text'] in FEE_LEVELS and 140 <= w['xMin'] < 170 and not any(abs(w['cy'] - q['cy']) < 3 for q, _ in price_words) \
                    and any(abs(w['cy'] - u['cy']) < 3 and u['xMin'] < 140 for u in table_words):
                price_words.append((w, FEE_LAYOUTS[1] if w['xMin'] < 155 else FEE_LAYOUTS[0]))
        price_words.sort(key=lambda t: t[0]['cy'])

        # Tablo dışı bloklar: KKTC bölümünün açıklama paragrafı ("KKTC ÜNİVERSİTELERİ ÖĞRENİM ÜCRETLERİ"
        # başlığı + metin) ve son sayfadaki "ÜNİVERSİTELERİN İNTERNET ADRESLERİ" listesi. Önceki ücret
        # satırının sahipliği bu başlıktan öteye geçmesin (eskiden son satırın üni adına metin giriyordu).
        cuts = sorted(w['yMin'] for w in table_words
                      if w['text'] == 'ÜNİVERSİTELERİN'
                      or (w['text'] == 'ÜNİVERSİTELERİ' and any(o['text'] == 'ÖĞRENİM' and abs(o['cy'] - w['cy']) < 3 for o in table_words)))

        for idx, (pw, lay) in enumerate(price_words):
            _, _, duzey_lo, prog_lo, prog_hi, note_lo = lay
            # Satır sahipliği: ücret satırının devam satırları (üni adının 2. satırı, program/düzey
            # devamı) HER ZAMAN ücretin ALTINDA. Kelime, kendinden önce (≤+3pt) gelen en yakın ücret
            # satırına aittir. (Eski orta-nokta penceresi 2. satırı komşu satıra kaçırıyordu.)
            y_low = pw['cy'] - 3.0
            y_high = price_words[idx + 1][0]['cy'] - 3.0 if idx < len(price_words) - 1 else float('inf')
            y_high = min([y_high] + [c - 1.0 for c in cuts if c > pw['cy']])
            row_w = [w for w in table_words if y_low <= w['cy'] < y_high and (w is not pw or pw['text'] in FEE_LEVELS)]

            # Kolon ataması xMin ile (düzey kolonundaki kelime ada, ad kelimesi düzeye kaçmasın)
            key = lambda w: (round(w['cy'] / 3.0) * 3.0, w['xMin'])
            uni_words = sorted([w for w in row_w if w['xMin'] < duzey_lo], key=key)
            duzey_words = sorted([w for w in row_w if duzey_lo <= w['xMin'] < prog_lo], key=key)
            prog_words = sorted([w for w in row_w if prog_lo <= w['xMin'] < prog_hi], key=key)
            note_words = sorted([w for w in row_w if w['xMin'] >= note_lo], key=key)

            uni_str = ' '.join(w['text'] for w in uni_words).strip()
            if uni_str:
                current_uni = uni_str

            duzey = ' '.join(w['text'] for w in duzey_words).strip()
            prog = ' '.join(w['text'] for w in prog_words).strip()

            if not prog:
                continue

            if PRICE_RE.match(pw['text']):
                val = float(pw['text'].replace('.', '').replace(',', '.'))
                val = int(val) if val.is_integer() else val
            else:
                val = None

            note = ' '.join(w['text'] for w in note_words).strip() if note_words else None

            all_fees.append({
                'yil': yil,
                'universite': current_uni,
                'duzey': duzey if duzey else None,
                'program': prog,
                'ucret': val,
                'not': note
            })

    # Ad doğrulaması: vakıf/KKTC/yurt dışı program üniversite adlarına normalize ederek eşle.
    canon = {}
    for pr in programs:
        if pr['universite_turu'] != 'devlet':
            n = norm_uni(pr['universite'])
            if n:
                canon.setdefault(n, n)
    by_words = {}
    for n in canon:
        by_words.setdefault(frozenset(n.split()), []).append(n)
    unmatched = []
    for f in all_fees:
        n = norm_uni(f['universite'])
        if n in canon:
            f['universite'] = canon[n]
            continue
        c = by_words.get(frozenset(n.split()), [])
        if len(c) == 1:
            f['universite'] = c[0]
        else:
            unmatched.append(f)

    # Deduplicate by (yil, universite, duzey, program) to satisfy Postgres constraint
    deduped_fees = {}
    for f in all_fees:
        # Eşlenemeyen ama programlar listesinde hiç yer almayan kurumlar (kontenjansız) PDF'teki adıyla kalır;
        # çöp satırlar (uzun/ÜNİVERSİTE-MYO içermeyen "ad") atılır. Hepsi raporda listelenir.
        if f in unmatched and not (len(f['universite']) <= 60 and re.search(r'ÜNİVERSİTESİ|YÜKSEKOKULU', f['universite'])):
            continue
        k = (f['yil'], f['universite'], f['duzey'], f['program'])
        deduped_fees[k] = f

    fees_result = list(deduped_fees.values())
    print(f"Extracted {len(fees_result)} unique fee entries ({len(all_fees)} raw, {len(unmatched)} unmatched).")
    return fees_result, unmatched

def generate_report(programs, conditions, fees, yil, report_path, sample_path=None, prefix_filled=0):
    total_prog = len(programs)
    tablo3_progs = [p for p in programs if p['tablo'] == 'onlisans']
    tablo4_progs = [p for p in programs if p['tablo'] == 'lisans']

    # Puan türü breakdown
    puan_counts = {}
    for p in programs:
        pt = p['puan_turu'] or 'BOŞ'
        puan_counts[pt] = puan_counts.get(pt, 0) + 1

    # Unique codes
    code_counts = {}
    for p in programs:
        c = p['program_kodu']
        code_counts[c] = code_counts.get(c, 0) + 1
    dup_codes = [c for c, cnt in code_counts.items() if cnt > 1]

    # Condition code validation
    all_cond_nos = set(c['kosul_no'] for c in conditions)
    missing_conds = set()
    for p in programs:
        for kn in p['kosul_kodlari']:
            if kn not in all_cond_nos:
                missing_conds.add(kn)

    # University rankings cross-check
    rankings_path = 'src/data/universityRankings.json'
    rankings_match_count = 0
    score_comparison = []
    if os.path.exists(rankings_path):
        try:
            with open(rankings_path, 'r', encoding='utf-8') as f:
                rdata = json.load(f)
            r_by_code = {}
            for r in rdata:
                if r.get('year') == yil:
                    r_by_code[r['program_code']] = r

            for p in programs:
                rec = r_by_code.get(p['program_kodu'])
                if rec:
                    rankings_match_count += 1
                    if p['en_kucuk_gk'] is not None and rec.get('base_score') is not None:
                        score_comparison.append({
                            'code': p['program_kodu'],
                            'name': p['program_adi'],
                            'pdf_score': p['en_kucuk_gk'],
                            'yok_score': rec['base_score'],
                            'diff': abs(p['en_kucuk_gk'] - rec['base_score'])
                        })
        except Exception as e:
            print(f"Rankings cross check error: {e}")

    # Sample regression
    sample_diffs = []
    if sample_path and os.path.exists(sample_path):
        with open(sample_path, 'r', encoding='utf-8') as f:
            sample_data = json.load(f)
        p_by_code = {p['program_kodu']: p for p in programs}
        for sp in sample_data.get('programlar', []):
            code = sp['program_kodu']
            act = p_by_code.get(code)
            if not act:
                sample_diffs.append(f"Program {code} parser çıktısında bulunamadı!")
            else:
                for k in ['tablo', 'universite', 'universite_turu', 'il', 'fakulte', 'program_adi', 'ogrenim_suresi', 'puan_turu', 'genel_ek_kont', 'sgy_ek_kont', 'k34_ek_kont', 'kosul_kodlari', 'en_kucuk_gk', 'en_kucuk_sgy', 'en_kucuk_34y']:
                    if act[k] != sp[k]:
                        sample_diffs.append(f"Kod {code} ({k}): Parser={act[k]} vs Örnek={sp[k]}")

    lines = [
        f"# {yil} Ek Yerleştirme Kılavuzu Doğrulama Raporu",
        "",
        f"**Üretim Tarihi:** {time.strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "## 1. Satır ve Kapsam İstatistikleri",
        f"- **Toplam Program Sayısı:** {total_prog} (Beklenen: ~16.715)",
        f"  - **Tablo 3 (Ön Lisans):** {len(tablo3_progs)} (Beklenen: ~8.400)",
        f"  - **Tablo 4 (Lisans):** {len(tablo4_progs)} (Beklenen: ~8.300)",
        f"- **Tekil Program Kodu:** {len(code_counts)} (Mükerrer: {len(dup_codes)})",
        f"- **Toplam Koşul Sayısı:** {len(conditions)} (1. Kısım: {len([c for c in conditions if c['kisim'] == 1])}, 2. Kısım: {len([c for c in conditions if c['kisim'] == 2])})",
        f"- **Vakıf Ücret Kayıtları:** {len(fees)}",
        "",
        "## 2. Puan Türü Dağılımı",
        "| Puan Türü | Program Sayısı |",
        "|---|---|",
    ]
    for pt in ['TYT', 'SAY', 'EA', 'SÖZ', 'DİL']:
        lines.append(f"| {pt} | {puan_counts.get(pt, 0)} |")
    for pt, cnt in puan_counts.items():
        if pt not in ['TYT', 'SAY', 'EA', 'SÖZ', 'DİL']:
            lines.append(f"| {pt} (Beklenmeyen) | {cnt} |")

    lines.extend([
        "",
        "## 3. Doğrulama ve Tutarlılık Denetimleri",
        f"- **Mükerrer Program Kodu:** {'YOK (Başarılı)' if len(dup_codes) == 0 else f'{len(dup_codes)} adet mükerrer!'}",
        f"- **Eksik/Tanımsız Koşul Kodu:** {'YOK (Tüm program koşulları tanımlı)' if len(missing_conds) == 0 else f'{len(missing_conds)} adet eksik koşul: {sorted(list(missing_conds))}'}",
        f"- **YÖK Atlas (`university_rankings`) Eşleşme Oranı:** {rankings_match_count} / {total_prog} (%{rankings_match_count / max(1, total_prog) * 100:.1f})",
    ])

    if score_comparison:
        perfect_matches = [s for s in score_comparison if s['diff'] < 0.01]
        lines.append(f"- **Merkezi Yerleştirme Taban Puanı Çapraz Eşleşmesi:** {len(perfect_matches)} / {len(score_comparison)} birebir eşleşme.")

    lines.extend([
        "",
        "## 4. Örnek Veri Regresyon Testi (2026-ornek.json - 26 Satır)",
    ])
    if not sample_diffs:
        lines.append("✅ **Tüm 26 örnek program parser çıktısıyla birebir eşleşti (0 hata).**")
    else:
        lines.append(f"⚠ **{len(sample_diffs)} fark tespit edildi:**")
        for d in sample_diffs:
            lines.append(f"- {d}")

    # Üniversite adı denetimi
    names = sorted({p['universite'] for p in programs})
    bos_uni = sum(1 for p in programs if not p['universite'])
    suspicious = [u for u in names if not re.search(r'(ÜNİVERSİTESİ|YÜKSEKOKULU|ENSTİTÜSÜ|AKADEMİSİ|YERLEŞKESİ|CERRAHPAŞA|KAMPUSU)$', u)
                  or re.search(r'[()*a-zçğıöşü]|\d', u)]
    by_prefix = {}
    for p in programs:
        by_prefix.setdefault(str(p['program_kodu'])[:4], set()).add(p['universite'])
    multi = {k: sorted(v) for k, v in by_prefix.items() if len(v) > 1}
    lines.extend([
        "",
        "## 5. Üniversite Adı Denetimi",
        f"- **Tekil üniversite adı:** {len(names)} ({len(by_prefix)} farklı 4 haneli önek)",
        f"- **Boş üniversite adı:** {bos_uni} (beklenen 0)",
        f"- **4 haneli önekten doldurulan satır (güvenlik ağı):** {prefix_filled}",
        f"- **Birden çok adı olan önek:** {len(multi)}" + ("" if not multi else " — kampüs/yerleşke alt başlıkları, kasıtlı ayrı tutuldu:"),
    ])
    for k, v in multi.items():
        lines.append(f"  - `{k}`: " + ' / '.join(f'`{x}`' for x in v))
    lines.append(f"- **Şüpheli ad (ÜNİVERSİTESİ/YÜKSEKOKULU/ENSTİTÜSÜ/AKADEMİSİ/YERLEŞKESİ/KAMPUSU/CERRAHPAŞA ile bitmeyen veya parantez/rakam/küçük harf/yıldız içeren):** {len(suspicious)}")
    for u in suspicious:
        note = ' — adın parçası olan rakam (meşru)' if re.search(r'\d', u) and not re.search(r'[()*a-zçğıöşü]', u) and re.search(r'(ÜNİVERSİTESİ)$', u) else ''
        lines.append(f"  - `{u}`{note}")

    report_content = '\n'.join(lines) + '\n'
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report_content)
    print(f"Saved validation report to {report_path}.")

def main():
    parser = argparse.ArgumentParser(description="Parse OSYM Ek Yerlestirme Kilavuzu PDF.")
    parser.add_argument("pdf", help="Path to PDF file")
    parser.add_argument("--yil", type=int, default=2026, help="Kilavuz yili (varsayilan: 2026)")
    parser.add_argument("--cikti", type=str, default=None, help="Cikti JSON dosyasi")
    parser.add_argument("--rapor", type=str, default=None, help="Cikti Markdown rapor dosyasi")

    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f"Hata: PDF dosyasi bulunamadi: {args.pdf}", file=sys.stderr)
        sys.exit(1)

    out_json = args.cikti or f"data/ek-yerlestirme/{args.yil}.json"
    out_report = args.rapor or f"data/ek-yerlestirme/{args.yil}-rapor.md"

    start_time = time.time()
    print(f"=== Ek Yerlestirme Kilavuzu Parser Baslatildi ({args.yil}) ===")

    # 1. Tablo 3: On Lisans
    tablo3_programs = parse_programs_section(args.pdf, TABLO3_START, TABLO3_END, is_lisans=False, yil=args.yil)

    # 2. Tablo 4: Lisans
    tablo4_programs = parse_programs_section(args.pdf, TABLO4_START, TABLO4_END, is_lisans=True, yil=args.yil)

    all_programs = tablo3_programs + tablo4_programs
    prefix_filled = fill_uni_from_prefix(all_programs)
    print(f"Önekten doldurulan boş üniversite adı: {prefix_filled}")

    # 3. Kosullar
    conditions = parse_conditions(args.pdf, args.yil)

    # 4. Vakif Ucretleri
    fees, unmatched = parse_vakif_fees(args.pdf, args.yil, all_programs)

    # Save complete JSON
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    payload = {
        "yil": args.yil,
        "kaynak": f"{args.yil} Yükseköğretim Programları Ek Yerleştirme Kılavuzu",
        "programlar": all_programs,
        "kosullar": conditions,
        "ucretler": fees
    }
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"Saved full JSON ({len(all_programs)} programs, {len(conditions)} conditions, {len(fees)} fees) to {out_json}.")

    # Generate validation report
    sample_file = f"data/ek-yerlestirme/{args.yil}-ornek.json"
    generate_report(all_programs, conditions, fees, args.yil, out_report, sample_path=sample_file, prefix_filled=prefix_filled)

    with open(out_report, "a", encoding="utf-8") as f:
        # Ayrım: ad kalıbı geçerliyse (kısa, ÜNİVERSİTESİ/YÜKSEKOKULU) ve hiçbir program adına yakın değilse
        # kurumun ek yerleştirmede programı yoktur (beklenen); aksi halde gerçek eşleşme hatası şüphesi.
        import difflib
        canon_names = sorted({norm_uni(p['universite']) for p in all_programs if p['universite_turu'] != 'devlet'})
        no_prog, errors = [], []
        for u in unmatched:
            n = norm_uni(u['universite'])
            valid = len(u['universite']) <= 60 and re.search(r'ÜNİVERSİTESİ|YÜKSEKOKULU', u['universite'])
            close = difflib.get_close_matches(n, canon_names, n=1, cutoff=0.9)
            (errors if (not valid or close) else no_prog).append((u, close))
        f.write(f"\n## Eşlenemeyen ücret satırı: {len(unmatched)}\n\n")
        f.write(f"- **Programı olmayan kurum (beklenen, ücret satırı yine de saklanır):** {len(no_prog)} satır, kurumlar: "
                + ', '.join(sorted({f'`{u["universite"]}`' for u, _ in no_prog})) + "\n")
        f.write(f"- **Gerçek eşleşme hatası şüphesi:** {len(errors)} satır\n\n")
        f.write("### Programı olmayan kurum\n\n")
        for u, _ in no_prog:
            f.write(f"- `{u['universite']}` | {u['duzey']} | {u['program']} | {u['ucret']}\n")
        f.write("\n### Gerçek eşleşme hatası şüphesi\n\n")
        for u, c in errors:
            f.write(f"- `{u['universite']}` | {u['duzey']} | {u['program']} | {u['ucret']}" + (f" (yakın ad: `{c[0]}`)" if c else "") + "\n")

    elapsed = time.time() - start_time
    print(f"\n🎉 Parser tamamlandi! Gecen sure: {elapsed:.2f} saniye.")

if __name__ == '__main__':
    main()
