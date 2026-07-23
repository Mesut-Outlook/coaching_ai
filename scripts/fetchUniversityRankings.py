import os
import sys
import json
import re
import kagglehub
import pandas as pd
from yokatlas_py import YokAtlasClient

def turkish_lower(s):
    if not isinstance(s, str):
        return ""
    replace_map = {'İ': 'i', 'I': 'ı', 'Ş': 'ş', 'Ç': 'ç', 'Ğ': 'ğ', 'Ü': 'ü', 'Ö': 'ö'}
    for k, v in replace_map.items():
        s = s.replace(k, v)
    return s.lower()

def normalize_uni_name(name):
    if not isinstance(name, str):
        return ""
    name = re.sub(r'\(.*?\)', '', name)
    replace_map = {'i': 'İ', 'ı': 'I', 'ş': 'Ş', 'ç': 'Ç', 'ğ': 'Ğ', 'ü': 'Ü', 'ö': 'Ö'}
    for k, v in replace_map.items():
        name = name.replace(k, v)
    name = name.upper()
    name = name.replace('ÜNİVERSİTESİ', '').replace('ÜNİVERSİTE', '')
    name = re.sub(r'[^\w\s]', ' ', name)
    return ' '.join(name.split())

def classify_score_type(row):
    bolum = row['bolum']
    fakulte = row['fakulte']
    
    if 'Yıllık' not in bolum:
        return 'TYT'
    
    bolum_lower = turkish_lower(bolum)
    fakulte_lower = turkish_lower(fakulte)
    
    # DİL
    dil_keywords = [
        'ingilizce öğretmenliği', 'ingiliz dili', 'mütercim', 'tercümanlık', 
        'almanca öğretmenliği', 'alman dili', 'fransızca öğretmenliği', 'fransız dili',
        'arapça öğretmenliği', 'arap dili', 'ispanyol', 'italyan', 'rus dili', 
        'japon dili', 'çin dili', 'kore dili', 'fars dili', 'dilbilimi', 'batı dilleri',
        'doğu dilleri'
    ]
    if any(k in bolum_lower for k in dil_keywords) and 'türk' not in bolum_lower:
        return 'DİL'
        
    # SÖZ
    soz_keywords = [
        'türkçe öğretmenliği', 'türk dili ve edebiyatı', 'tarih öğretmenliği', 'tarih', 
        'coğrafya öğretmenliği', 'coğrafya', 'okul öncesi öğretmenliği', 'özel eğitim öğretmenliği',
        'ilahiyat', 'islami ilimler', 'gastronomi ve mutfak sanatları', 'gazetecilik',
        'radyo', 'televizyon', 'sinema', 'halkla ilişkiler', 'reklamcılık', 'yeni medya ve iletişim',
        'sanat tarihi', 'tiyatro', 'oyunculuk', 'çizgi film', 'animasyon', 'canlandırma',
        'sosyal bilgiler öğretmenliği', 'reklam tasarımı', 'halkbilimi', 'reklamcılık ve halkla ilişkiler'
    ]
    if any(k in bolum_lower for k in soz_keywords):
        return 'SÖZ'
        
    # SAY
    say_keywords = [
        'mühendislik', 'mühendisliği', 'tıp', 'diş hekimliği', 'eczacılık', 'hemşirelik', 'ebelik', 
        'fizyoterapi', 'ergoterapi', 'odyoloji', 'dil ve konuşma terapisi', 
        'matematik', 'fizik', 'kimya', 'biyoloji', 'istatistik', 'moleküler biyoloji', 
        'genetik', 'biyoteknoloji', 'mimarlık', 'peyzaj mimarlığı', 'beslenme ve diyetetik',
        'astronomi', 'uzay bilimleri', 'yapay zeka', 'yazılım', 'fen bilgisi öğretmenliği',
        'ilköğretim matematik öğretmenliği', 'matematik öğretmenliği', 'fizik öğretmenliği',
        'kimya öğretmenliği', 'biyoloji öğretmenliği', 'pilotaj', 'veteriner', 'kentsel tasarım',
        'biyomühendislik', 'biyoenformatik', 'veri bilimi', 'bilgi güvenliği', 'aktüerya',
        'öğretim teknolojileri', 'süt teknolojisi', 'tarımsal', 'organik tarım', 'hayvansal üretim',
        'bitki koruma', 'bahçe bitkileri', 'tarla bitkileri', 'zootekni', 'orman', 'su ürünleri',
        'balıkçılık', 'toprak bilimi', 'besleme'
    ]
    if any(k in bolum_lower for k in say_keywords):
        if 'çevre tasarımı' in bolum_lower:
            return 'EA'
        if 'yönetim bilişim' in bolum_lower:
            return 'EA'
        return 'SAY'
        
    if 'bilişim' in bolum_lower and 'yönetim' not in bolum_lower:
        return 'SAY'
        
    # EA
    ea_keywords = [
        'hukuk', 'psikoloji', 'sosyoloji', 'felsefe', 'işletme', 'iktisat', 'ekonomi',
        'maliye', 'finans', 'siyaset', 'uluslararası ilişkiler', 'kamu yönetimi', 
        'yönetim bilişim sistemleri', 'rehberlik ve psikolojik danışmanlık', 'pdr',
        'sınıf öğretmenliği', 'sosyal hizmet', 'arkeoloji', 'turizm', 'uluslararası ticaret',
        'lojistik', 'iç mimarlık ve çevre tasarımı', 'grafik', 'tasarım', 'moda',
        'insan kaynakları', 'bankacılık', 'sigortacılık', 'pazarlama', 'havacılık yönetimi',
        'sağlık yönetimi', 'spor yönetimi', 'rekreasyon'
    ]
    if any(k in bolum_lower for k in ea_keywords):
        return 'EA'
        
    if any(k in fakulte_lower for k in ['mühendislik', 'fen fakültesi', 'ziraat', 'veteriner', 'orman']):
        return 'SAY'
    if any(k in fakulte_lower for k in ['iktisadi', 'idari', 'işletme', 'hukuk', 'siyasal']):
        return 'EA'
    if any(k in fakulte_lower for k in ['edebiyat', 'iletişim', 'ilahiyat', 'islami']):
        return 'SÖZ'
        
    return 'EA'

turkish_cities = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 'Aydın', 
    'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 
    'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 
    'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin', 'İstanbul', 
    'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 
    'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 
    'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 
    'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 
    'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce', 'Kıbrıs'
]

known_uni_cities = {
    'EGE': 'İzmir', 'DOKUZ EYLÜL': 'İzmir', 'DOKUZ EYLUL': 'İzmir', 'ANADOLU': 'Eskişehir',
    'ESKİŞEHİR OSMANGAZİ': 'Eskişehir', 'ESKISEHIR OSMANGAZI': 'Eskişehir', 'GAZİ': 'Ankara',
    'GAZI': 'Ankara', 'HACETTEPE': 'Ankara', 'BİLKENT': 'Ankara', 'İHSAN DOĞRAMACI BİLKENT': 'Ankara',
    'MIDDLE EAST TECHNICAL': 'Ankara', 'ORTA DOĞU TEKNİK': 'Ankara', 'ÇUKUROVA': 'Adana',
    'CUKUROVA': 'Adana', 'ULUDAĞ': 'Bursa', 'BURSA ULUDAĞ': 'Bursa', 'AKDENİZ': 'Antalya',
    'AKDENIZ': 'Antalya', 'SELÇUK': 'Konya', 'SELCUK': 'Konya', 'KONYA TEKNİK': 'Konya',
    'ERCİYES': 'Kayseri', 'ERCIYES': 'Kayseri', 'ONDOKUZ MAYIS': 'Samsun', 'KARADENİZ TEKNİK': 'Trabzon',
    'KARADENIZ TEKNIK': 'Trabzon', 'DİCLE': 'Diyarbakır', 'DICLE': 'Diyarbakır', 'FIRAT': 'Elazığ',
    'İNÖNÜ': 'Malatya', 'INONU': 'Malatya', 'SÜLEYMAN DEMİREL': 'Isparta', 'PAMUKKALE': 'Denizli',
    'TRAKYA': 'Edirne', 'KAFKAS': 'Kars', 'BOĞAZİÇİ': 'İstanbul', 'BOGAZICI': 'İstanbul',
    'KOÇ': 'İstanbul', 'KOC': 'İstanbul', 'SABANCI': 'İstanbul', 'BAHÇEŞEHİR': 'İstanbul',
    'YEDİTEPE': 'İstanbul', 'ÖZYEĞİN': 'İstanbul', 'OZYEGIN': 'İstanbul', 'KADİR HAS': 'İstanbul',
    'KADIR HAS': 'İstanbul', 'BİLGİ': 'İstanbul', 'İSTANBUL BİLGİ': 'İstanbul', 'GALATASARAY': 'İstanbul',
    'YILDIZ TEKNİK': 'İstanbul', 'YILDIZ TEKNIK': 'İstanbul', 'MARMARA': 'İstanbul',
    'MİMAR SİNAN GÜZEL SANATLAR': 'İstanbul', 'MIMAR SINAN GUZEL SANATLAR': 'İstanbul',
    'İZMİR KAVRAM MESLEK YÜKSEKOKULU': 'İzmir', 'KAVRAM MESLEK YÜKSEKOKULU': 'İzmir',
    'ABDULLAH GÜL': 'Kayseri', 'ARKIN YARATICI SANATLAR VE TASARIM': 'Kıbrıs',
    'GİRNE AMERİKAN': 'Kıbrıs', 'GIRNE AMERIKAN': 'Kıbrıs', 'ULUSLARARASI BALKAN': 'Kuzey Makedonya',
    'ADA KENT': 'Kıbrıs', 'HOCA AHMET YESEVİ ULUSLARARASI TÜRK-KAZAK': 'Kazakistan',
    'HOCA AHMET YESEVI ULUSLARARASI TURK-KAZAK': 'Kazakistan', 'KIRGIZİSTAN-TÜRKİYE MANAS': 'Kırgızistan',
    'KIRGIZISTAN-TURKIYE MANAS': 'Kırgızistan', 'ULUSLARARASI FİNAL': 'Kıbrıs',
    'ULUSLARARASI FINAL': 'Kıbrıs', 'AKDENİZ KARPAZ': 'Kıbrıs', 'AKDENIZ KARPAZ': 'Kıbrıs',
    'ULUSLARARASI SARAYBOSNA': 'Saraybosna', 'YAKIN DOĞU': 'Kıbrıs', 'YAKIN DOGU': 'Kıbrıs',
    'DOĞU AKDENİZ': 'Kıbrıs', 'DOGU AKDENIZ': 'Kıbrıs', 'RAUF DENKTAŞ': 'Kıbrıs',
    'RAUF DENKTAS': 'Kıbrıs', 'GİRNE': 'Kıbrıs', 'GIRNE': 'Kıbrıs', 'LEFKE AVRUPA': 'Kıbrıs'
}

def get_university_type(uni_name, bol_name):
    uni = uni_name.lower()
    bol = bol_name.lower()
    if 'burslu' in bol or 'indirimli' in bol or 'ücretli' in bol:
        return 'Vakıf'
    vakif_unis = ['koç', 'bilkent', 'sabancı', 'bahçeşehir', 'yeditepe', 'özyeğin', 'bilgi', 'kadir has', 'başkent', 'atılım', 'ışık', 'doğuş', 'maltepe', 'halic', 'haliç', 'beykent', 'koc', 'sabanci', 'ozyegin', 'gelisim', 'gelişim', 'altınbaş', 'altinbas', 'ted', 'tobb', 'mev', 'isik', 'dogus', 'ufuk', 'okan', 'ticaret', 'kültür', 'kultur', 'yeniyuzyil', 'yeni yüzyıl', 'khas', 'fatih', 'meliksah', 'zirve', 'gediz', 'turgut', 'canik', 'süleyman şah', 'şifa', 'avrasya', 'nuh naci', 'karatay', 'toros', 'çağ', 'cag', 'yaşar', 'yasar', 'izmir ekonomi', 'tinaztepe', 'tınaztepe', 'demiroğlu', 'demiroglu', 'atlas', 'lokman', 'fenerbahçe', 'fenerbahce', 'istinye', 'biruni', 'bezmialem', 'üsküdar', 'uskudar', 'nişantaşı', 'nisantasi', 'arelim', 'arel', 'medipol', 'acibadem', 'acıbadem', 'rumeli', 'kent', 'galata', 'mudanya', 'kocaeli sağlık', 'antalya belek', 'antalya bilim', 'nuh naci yazgan', 'sanko', 'nisa', 'avrasya', 'kıbrıs', 'kibris', 'lefke', 'doğu akdeniz', 'dogu akdeniz', 'girne', 'yakin dogu', 'yakın doğu', 'uluslararası kıbrıs', 'uluslararasi kibris', 'bahçeşehir kıbrıs', 'ada kent', 'rauf denktaş', 'on beş kasım']
    if any(v in uni for v in vakif_unis):
        return 'Vakıf'
    return 'Devlet'

def clean_val(val, val_type):
    if pd.isna(val):
        return None
    return val_type(val)

def main():
    print("Downloading Kaggle dataset...")
    try:
        path = kagglehub.dataset_download("yakupie/2022-2025-yks-niversite-baar-sralamalar")
        print(f"Dataset downloaded to: {path}")
    except Exception as e:
        print(f"Error downloading dataset: {e}", file=sys.stderr)
        sys.exit(1)

    file_path = os.path.join(path, "data.csv")
    if not os.path.exists(file_path):
        print(f"data.csv not found in downloaded folder: {path}", file=sys.stderr)
        sys.exit(1)

    print("Reading data.csv and filtering for year == 2025...")
    df_raw = pd.read_csv(file_path)
    df_2025 = df_raw[df_raw['yil'] == 2025].copy()
    total_rows = len(df_2025)
    print(f"Total 2025 rows: {total_rows}")

    print("Fetching YÖK Atlas university lookups...")
    yok_uni_cities = {}
    try:
        client = YokAtlasClient()
        yok_unis = client.list_universities()
        for u in yok_unis:
            norm = normalize_uni_name(u.universite_adi)
            m = re.search(r'\((.*?)\)', u.universite_adi)
            if m:
                yok_uni_cities[norm] = m.group(1).title()
    except Exception as e:
        print(f"Warning: YÖK Atlas lookup fetch failed: {e}", file=sys.stderr)

    print("Normalizing records and resolving city/type...")
    normalized_data = []
    matched_cities = 0
    matched_types = 0

    for idx, row in df_2025.iterrows():
        uni_raw = row['universite']
        norm = normalize_uni_name(uni_raw)
        
        # City resolution chain
        city = yok_uni_cities.get(norm, None)
        if not city and norm in known_uni_cities:
            city = known_uni_cities[norm]
        if not city:
            m = re.search(r'\((.*?)\)', uni_raw)
            if m:
                city = m.group(1).title()
        if not city:
            for c in turkish_cities:
                if c.lower() in uni_raw.lower():
                    city = c
                    break
                    
        # University type resolution
        uni_type = get_university_type(uni_raw, row['bolum'])
        score_type = classify_score_type(row)

        if city:
            matched_cities += 1
        if uni_type:
            matched_types += 1

        normalized_row = {
            "year": 2025,
            "university": uni_raw,
            "university_type": uni_type,
            "city": city,
            "faculty": clean_val(row['fakulte'], str),
            "program": row['bolum'],
            "score_type": score_type,
            "base_score": clean_val(row['puan'], float),
            "base_ranking": clean_val(row['siralama'], float),
            "quota": clean_val(row['kontenjan'], int)
        }
        normalized_data.append(normalized_row)

    print(f"\n--- JOIN REPORT ---")
    print(f"Total 2025 Programs: {len(normalized_data)}")
    print(f"City Match Rate: {matched_cities} / {len(normalized_data)} ({matched_cities / len(normalized_data) * 100:.2f}%)")
    print(f"Type Match Rate: {matched_types} / {len(normalized_data)} ({matched_types / len(normalized_data) * 100:.2f}%)")

    out_file = "src/data/universityRankings.json"
    os.makedirs("src/data", exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(normalized_data, f, ensure_ascii=False, separators=(',', ':'))
        
    print(f"\nSaved {len(normalized_data)} enriched records to {out_file} successfully.")

if __name__ == '__main__':
    main()
