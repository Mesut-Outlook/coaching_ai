import asyncio
import json
import os
import sys
import httpx

SEARCH_URL = "https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search"

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

async def fetch_all_yokatlas():
    print("Connecting directly to YÖK Atlas REST API...")
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
        
        # Build normalized records
        normalized_records = []
        program_codes = set()
        count_2025 = 0
        count_2025_ranking = 0
        
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
            
            # ÖNEMLİ — YÖK Atlas alan→yıl eşleşmesi:
            # API'nin ETİKETSİZ alanları (minPuan/basariSirasi/kontenjan) son TAMAMLANAN
            # yerleştirme yılını (= 2025) taşır; item["yil"]=2026 sadece tercih KILAVUZU yılıdır.
            # suffix 1/2/3 ise sırasıyla 2024/2023/2022'dir. (2026 yerleştirmesi henüz yapılmadı,
            # o yıl için kayıt oluşturulmaz.) Doğrulama: coordination.md / Koç Tıp İng. Burslu kod 203910699.

            # Year 2025 (last completed placement — unlabeled/current fields)
            p_2025 = to_float(item.get("minPuan"))
            r_2025 = to_int(item.get("basariSirasi"))
            q_2025 = to_int(item.get("kontenjan"))
            if p_2025 is not None or r_2025 is not None:
                count_2025 += 1
                if r_2025 is not None:
                    count_2025_ranking += 1
                rec_2025 = dict(base_meta)
                rec_2025.update({
                    "year": 2025,
                    "base_score": p_2025,
                    "base_ranking": r_2025,
                    "quota": q_2025
                })
                normalized_records.append(rec_2025)

            # Year 2024 (History 1)
            p_2024 = to_float(item.get("minPuan1"))
            r_2024 = to_int(item.get("basariSirasi1"))
            q_2024 = to_int(item.get("gk1"))
            if p_2024 is not None or r_2024 is not None:
                rec_2024 = dict(base_meta)
                rec_2024.update({
                    "year": 2024,
                    "base_score": p_2024,
                    "base_ranking": r_2024,
                    "quota": q_2024
                })
                normalized_records.append(rec_2024)

            # Year 2023 (History 2)
            p_2023 = to_float(item.get("minPuan2"))
            r_2023 = to_int(item.get("basariSirasi2"))
            q_2023 = to_int(item.get("gk2"))
            if p_2023 is not None or r_2023 is not None:
                rec_2023 = dict(base_meta)
                rec_2023.update({
                    "year": 2023,
                    "base_score": p_2023,
                    "base_ranking": r_2023,
                    "quota": q_2023
                })
                normalized_records.append(rec_2023)

            # Year 2022 (History 3)
            p_2022 = to_float(item.get("minPuan3"))
            r_2022 = to_int(item.get("basariSirasi3"))
            q_2022 = to_int(item.get("gk3"))
            if p_2022 is not None or r_2022 is not None:
                rec_2022 = dict(base_meta)
                rec_2022.update({
                    "year": 2022,
                    "base_score": p_2022,
                    "base_ranking": r_2022,
                    "quota": q_2022
                })
                normalized_records.append(rec_2022)

        print("\n--- A1c YÖK ATLAS STATS ---")
        print(f"Total raw programs fetched: {len(all_raw_items)}")
        print(f"Unique program codes (kilavuzKodu): {len(program_codes)}")
        print(f"Total 2025 records: {count_2025}")
        print(f"2025 ranking fill rate: {count_2025_ranking} / {count_2025} ({count_2025_ranking / count_2025 * 100:.2f}%)")
        print(f"Total normalized multi-year records (2022-2025): {len(normalized_records)}")
        
        # Save to src/data/universityRankings.json
        os.makedirs("src/data", exist_ok=True)
        out_file = "src/data/universityRankings.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(normalized_records, f, ensure_ascii=False, separators=(',', ':'))
            
        print(f"\nSaved full YÖK Atlas dataset to {out_file} successfully.")

if __name__ == '__main__':
    asyncio.run(fetch_all_yokatlas())
