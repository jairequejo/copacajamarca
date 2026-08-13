import zipfile
import xml.etree.ElementTree as ET
import os
import json
import re
import csv

ns = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
}

def clean_text(text):
    if not text: return ""
    return re.sub(r'\s+', ' ', text).strip()

def parse_docx(filepath, output_img_dir):
    with zipfile.ZipFile(filepath, 'r') as z:
        try:
            doc_xml = z.read('word/document.xml')
            rels_xml = z.read('word/_rels/document.xml.rels')
        except:
            return []
            
        rels_tree = ET.fromstring(rels_xml)
        rels = {}
        for rel in rels_tree.findall('.//{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
            rels[rel.attrib['Id']] = rel.attrib['Target']

        tree = ET.fromstring(doc_xml)
        
        # Extracción cruda por celdas
        tables = []
        for tbl in tree.findall('.//w:tbl', ns):
            table_data = []
            for tr in tbl.findall('.//w:tr', ns):
                row_data = []
                for tc in tr.findall('.//w:tc', ns):
                    texts = []
                    for t in tc.findall('.//w:t', ns):
                        if t.text: texts.append(t.text)
                    
                    imgs = []
                    for blip in tc.findall('.//a:blip', ns):
                        embed = blip.attrib.get('{%s}embed' % ns['r'])
                        if embed and embed in rels:
                            imgs.append(embed) # store relId to extract later
                    
                    row_data.append({'text': clean_text(' '.join(texts)), 'imgs': imgs})
                table_data.append(row_data)
            tables.append(table_data)
            
        # Analisis semantico
        players = []
        
        equipo = ""
        categoria = ""
        for t in tables:
            for r in t:
                if len(r) >= 2 and 'EQUIPO' in r[0]['text'].upper():
                    equipo = r[1]['text'].upper()
                if len(r) >= 2 and 'CATEGORIA' in r[0]['text'].upper():
                    categoria = r[1]['text'].upper()

        for t in tables:
            for i, r in enumerate(t):
                # Is it a DNI row?
                if len(r) >= 6 and 'DNI' in r[0]['text'].upper() and 'DNI' in r[2]['text'].upper():
                    for col_idx in [0, 2, 4]:
                        val_idx = col_idx + 1
                        if val_idx >= len(r): continue
                        
                        dni = r[val_idx]['text'].replace(' ', '')
                        if not dni or not dni.isdigit(): continue
                        
                        # Extract Nombres, Apellidos, Fecha Nac
                        try:
                            nombres = t[i-1][val_idx]['text']
                            apellidos = t[i-2][val_idx]['text']
                            fnac = t[i+1][val_idx]['text']
                            
                            # Convert DD/MM/YYYY to YYYY-MM-DD
                            m = re.search(r'(\d{2})[-/](\d{2})[-/](\d{4})', fnac)
                            if m:
                                fnac = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
                            
                            # Get image
                            img_data = None
                            if i >= 3:
                                img_row = t[i-3]
                                img_col = col_idx // 2
                                if img_col < len(img_row) and img_row[img_col]['imgs']:
                                    rel_id = img_row[img_col]['imgs'][0]
                                    img_target = rels[rel_id]
                                    img_data = z.read('word/' + img_target)
                                    
                                    img_path = os.path.join(output_img_dir, f"{dni}.jpg")
                                    with open(img_path, 'wb') as f:
                                        f.write(img_data)
                            
                            # Es entrenador?
                            rol = "JUGADOR"
                            if i >= 4 and 'ENTRENADOR' in t[i-4][0]['text'].upper():
                                rol = "ENTRENADOR"
                                
                            players.append({
                                'rol': rol,
                                'equipo': equipo,
                                'categorias': categoria,
                                'nombre_completo': f"{nombres} {apellidos}".strip(),
                                'dni': dni,
                                'fecha_nacimiento': fnac,
                                'has_foto': 'SI' if img_data else 'NO'
                            })
                        except Exception as e:
                            pass
        return players

input_dir = '/mnt/c/Users/Jair/Downloads/fichasjrstars'
output_dir = '/home/jair/copacajamarca/fotos_dnis'
os.makedirs(output_dir, exist_ok=True)

all_players = []
for file in os.listdir(input_dir):
    if file.endswith('.docx') and not file.startswith('~'):
        filepath = os.path.join(input_dir, file)
        print(f"Procesando: {file}")
        players = parse_docx(filepath, output_dir)
        all_players.extend(players)

with open('/home/jair/copacajamarca/importar_jugadores.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['rol', 'equipo', 'categorias', 'nombre_completo', 'dni', 'fecha_nacimiento', 'has_foto'])
    writer.writeheader()
    writer.writerows(all_players)

print(f"Completado. Extraidos {len(all_players)} registros.")
