import argparse
import asyncio
import json
import os
import sys
import httpx

SEARCH_URL = "https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search"

# Anchor programs to verify no year-shift occurs before overwriting data
# format: (program_code, program_name_sub, expected_suffix1_ranking, expected_suffix1_score)
ANCHOR_PROGRAMS = [
    (203910699, "Koç Tıp İngilizce Burslu", 43, 550.89027),
    (203110477, "Medipol Tıp İngilizce Burslu", 38, 551.13218),
    (203910363, "Koç Bilgisayar İngilizce Burslu", 113, 547.69436),
]

def derive_fee_type(burs_orani, birim_adi, uni_turu):
    if burs_orani and str(burs_orani).strip():
        return str(burs_orani).strip()
    bol = (birim_adi or "").lower()
    if 'burslu' in bol:
        return 'Burslu'
    if '%50 indirimli' in bol or '50% indirimli' in bol:
        return '%50 İndirimli'
    if '%25 indirimli' in bol or '25% indirimli' in bol:
        return '%25 İndirimli'
    if '%75 indirimli' in bol or '75% indirimli' in bol:
        return '%75 İndirimli'
    if 'ücretli' in bol:
        return 'Ücretli'
    if uni_turu == 'DEVLET':
        return 'Ücretsiz'
    if uni_turu in ['VAKIF', 'KKTC', 'YURTDISI VAKIF']:
        return 'Ücretli'
    return 'Ücretsiz'

def to_float(val):
    if val is None or val == "":
        return None
    try:
        f = float(val)
        return f if f != 0 else None
    except (ValueError, TypeError):
        return None

def to_int(val):
    if val is None or val == "":
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None

async def fetch_page(client, page, size=100):
    payload = {
        "filters": {},
        "page": page,
        "size": size,
        "sortBy": "basariSirasi",
        "direction": "ASC"
    }
    response = await client.post(SEARCH_URL, json=payload, timeout=20.0)
    response.raise_for_status()
    return response.json()

def verify_anchor_guard(all_raw_items, son_yil, existing_json_path):
    print("\n--- ÇAPA GUARD'I (Anchor Guard) KONTROLÜ ---")
    raw_by_code = {}
    for item in all_raw_items:
        code = to_int(item.get("kilavuzKodu"))
        if code:
            raw_by_code[code] = item

    # Compare with existing data file if available
    existing_by_code_and_year = {}
    if os.path.exists(existing_json_path):
        try:
            with open(existing_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for r in data:
                    c = r.get("program_code")
                    y = r.get("year")
                    if c and y:
                        existing_by_code_and_year[(c, y)] = r
        except Exception as e:
            print(f"Uyarı: Mevcut dosya okunamadı ({e}), statik çapa değerleri kullanılacak.")

    baseline_year = son_yil - 1
    failures = []

    for code, label, exp_rank, exp_score in ANCHOR_PROGRAMS:
        item = raw_by_code.get(code)
        if not item:
            failures.append(f"Program {code} ({label}) çekilen API verisinde bulunamadı!")
            continue

        actual_rank1 = to_int(item.get("basariSirasi1"))
        actual_score1 = to_float(item.get("minPuan1"))

        # Target comparison: either from existing baseline or static fallback
        target_rank = exp_rank
        target_score = exp_score

        if (code, baseline_year) in existing_by_code_and_year:
            base_rec = existing_by_code_and_year[(code, baseline_year)]
            target_rank = base_rec.get("base_ranking") or exp_rank
            target_score = base_rec.get("base_score") or exp_score

        rank_match = (actual_rank1 == target_rank)
        score_match = (actual_score1 is not None and abs(actual_score1 - target_score) < 0.05)

        current_rank = to_int(item.get("basariSirasi"))
        current_score = to_float(item.get("minPuan"))

        print(f"Çapa program {code} [{label}]:")
        print(f"  API etiketsiz ({son_yil}): Sıra={current_rank}, Puan={current_score}")
        print(f"  API suffix1 ({baseline_year}): Sıra={actual_rank1} (beklenen: {target_rank}), Puan={actual_score1} (beklenen: {target_score})")

        if not (rank_match and score_match):
            failures.append(
                f"Program {code} ({label}) suffix1 değerleri {baseline_year} ile uyuşmuyor! "
                f"Sıra: {actual_rank1} vs {target_rank}, Puan: {actual_score1} vs {target_score}"
            )

    if failures:
        print("\n❌ ÇAPA GUARD'I BAŞARISIZ OLDU! Yıl kayması veya beklenmeyen API formatı tespit edildi:", file=sys.stderr)
        for fail in failures:
            print(f"  - {fail}", file=sys.stderr)
        raise RuntimeError("Çapa guard'ı doğrulamayı geçemedi! Dosyaya yazma işlemi durduruldu.")

    print(f"✅ ÇAPA GUARD'I BAŞARIYLA GEÇTİ: Tüm çapa programların suffix1 değerleri {baseline_year} verisiyle birebir tutuyor.")


async def fetch_all_yokatlas(son_yil=2026):
    print(f"Connecting directly to YÖK Atlas REST API (Hedef Son Yerleştirme Yılı: {son_yil})...")
    limits = httpx.Limits(max_keepalive_connections=20, max_connections=30)
    async with httpx.AsyncClient(limits=limits, headers={"User-Agent": "Mozilla/5.0"}) as client:
        first_resp = await fetch_page(client, 0, size=100)
        total_elements = first_resp.get("totalElements", 0)
        total_pages = first_resp.get("totalPages", 0)
        print(f"Total YÖK Atlas elements: {total_elements}, Total pages (size=100): {total_pages}")
        
        all_raw_items = list(first_resp.get("content", []))
        
        # Concurrent batch fetching
        batch_size = 15
        for i in range(1, total_pages, batch_size):
            end_page = min(i + batch_size, total_pages)
            tasks = [fetch_page(client, p, size=100) for p in range(i, end_page)]
            print(f"Fetching pages {i} to {end_page - 1}...")
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for res in results:
                if isinstance(res, Exception):
                    print(f"Warning: Batch fetch error: {res}", file=sys.stderr)
                else:
                    all_raw_items.extend(res.get("content", []))
                    
        print(f"Raw items fetched: {len(all_raw_items)}")

        out_file = "src/data/universityRankings.json"

        # Çapa Guard'ı kontrolü — başarısız olursa dosya yazılmadan durur
        verify_anchor_guard(all_raw_items, son_yil, out_file)
        
        # Build normalized records
        normalized_records = []
        program_codes = set()
        count_son_yil = 0
        count_son_yil_ranking = 0
        count_by_year = {}
        
        for item in all_raw_items:
            program_code = to_int(item.get("kilavuzKodu"))
            if program_code:
                program_codes.add(program_code)
                
            uni_name = item.get("universiteAdi")
            uni_type = item.get("universiteTuru")
            city = item.get("uniIlAdi")
            faculty = item.get("fymkAdi")
            program_name = item.get("birimAdi")
            degree_level = item.get("birimTuruAdi")
            education_type = item.get("ogrenimTuruAdi")
            score_type = item.get("puanTuru")
            fee_type = derive_fee_type(item.get("bursOraniAdi"), program_name, uni_type)
            
            base_meta = {
                "program_code": program_code,
                "university": uni_name,
                "university_type": uni_type,
                "city": city,
                "faculty": faculty,
                "program": program_name,
                "degree_level": degree_level,
                "fee_type": fee_type,
                "education_type": education_type,
                "score_type": score_type,
            }
            
            # YÖK Atlas alan → yıl eşleşmesi:
            # - Etiketsiz alanlar: son tamamlanan yerleştirme yılı (son_yil, örn. 2026)
            # - suffix1: son_yil - 1 (örn. 2025)
            # - suffix2: son_yil - 2 (örn. 2024)
            # - suffix3: son_yil - 3 (örn. 2023)

            # Year son_yil (current/unlabeled fields)
            p_curr = to_float(item.get("minPuan"))
            r_curr = to_int(item.get("basariSirasi"))
            q_curr = to_int(item.get("kontenjan"))
            if p_curr is not None or r_curr is not None:
                count_son_yil += 1
                if r_curr is not None:
                    count_son_yil_ranking += 1
                rec_curr = dict(base_meta)
                rec_curr.update({
                    "year": son_yil,
                    "base_score": p_curr,
                    "base_ranking": r_curr,
                    "quota": q_curr
                })
                normalized_records.append(rec_curr)
                count_by_year[son_yil] = count_by_year.get(son_yil, 0) + 1

            # Year son_yil - 1 (History 1)
            p_1 = to_float(item.get("minPuan1"))
            r_1 = to_int(item.get("basariSirasi1"))
            q_1 = to_int(item.get("gk1"))
            if p_1 is not None or r_1 is not None:
                y = son_yil - 1
                rec_1 = dict(base_meta)
                rec_1.update({
                    "year": y,
                    "base_score": p_1,
                    "base_ranking": r_1,
                    "quota": q_1
                })
                normalized_records.append(rec_1)
                count_by_year[y] = count_by_year.get(y, 0) + 1

            # Year son_yil - 2 (History 2)
            p_2 = to_float(item.get("minPuan2"))
            r_2 = to_int(item.get("basariSirasi2"))
            q_2 = to_int(item.get("gk2"))
            if p_2 is not None or r_2 is not None:
                y = son_yil - 2
                rec_2 = dict(base_meta)
                rec_2.update({
                    "year": y,
                    "base_score": p_2,
                    "base_ranking": r_2,
                    "quota": q_2
                })
                normalized_records.append(rec_2)
                count_by_year[y] = count_by_year.get(y, 0) + 1

            # Year son_yil - 3 (History 3)
            p_3 = to_float(item.get("minPuan3"))
            r_3 = to_int(item.get("basariSirasi3"))
            q_3 = to_int(item.get("gk3"))
            if p_3 is not None or r_3 is not None:
                y = son_yil - 3
                rec_3 = dict(base_meta)
                rec_3.update({
                    "year": y,
                    "base_score": p_3,
                    "base_ranking": r_3,
                    "quota": q_3
                })
                normalized_records.append(rec_3)
                count_by_year[y] = count_by_year.get(y, 0) + 1

        print(f"\n--- YÖK ATLAS STATS (son-yil={son_yil}) ---")
        print(f"Total raw programs fetched: {len(all_raw_items)}")
        print(f"Unique program codes (kilavuzKodu): {len(program_codes)}")
        print(f"Total {son_yil} records: {count_son_yil}")
        print(f"{son_yil} ranking fill rate: {count_son_yil_ranking} / {count_son_yil} ({count_son_yil_ranking / count_son_yil * 100:.2f}%)")
        for y, count in sorted(count_by_year.items()):
            print(f"Year {y}: {count} records")
        print(f"Total normalized multi-year records: {len(normalized_records)}")
        
        # Save to src/data/universityRankings.json
        os.makedirs("src/data", exist_ok=True)
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(normalized_records, f, ensure_ascii=False, separators=(',', ':'))
            
        print(f"\nSaved full YÖK Atlas dataset to {out_file} successfully.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Fetch and normalize university rankings from YOK Atlas API.")
    parser.add_argument("--son-yil", type=int, default=2026, help="Son tamamlanan yerlesme yili (etiketsiz alanlarin yili, varsayilan 2026)")
    args = parser.parse_args()

    asyncio.run(fetch_all_yokatlas(son_yil=args.son_yil))
