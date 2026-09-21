import urllib.request, json, os, re

anonKey = 'sb_publishable_Li44BS4jk6I75zEFc05B1Q_NbBcuoPB'
headers = {'apikey': anonKey, 'Authorization': f'Bearer {anonKey}'}

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def build_pages():
    print("Iniciando SEO Programático para Equipos...")
    try:
        req = urllib.request.Request('https://uzyqpruqiqubwnqttnwf.supabase.co/rest/v1/equipos?select=id,nombre,logo_url', headers=headers)
        res = urllib.request.urlopen(req).read()
        equipos = json.loads(res)
    except Exception as e:
        print(f"Error conectando a Supabase: {e}")
        return

    out_dir = 'equipos'
    if not os.path.exists(out_dir):
        os.makedirs(out_dir)

    template = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Perfil oficial de competición, agenda de partidos y participación de la institución {nombre_equipo} en la Copa Cajamarca, el epicentro del fútbol formativo." />
  <title>{nombre_equipo} - Competición Oficial en Copa Cajamarca</title>
  <link rel="stylesheet" href="../assets/css/landing.css" />
  <link rel="stylesheet" href="../assets/css/desktop.css" />
  <style>
    .team-header {{ text-align: center; padding: 40px 20px; background: #001a4d; color: white; }}
    .team-logo {{ width: 120px; height: 120px; object-fit: contain; margin-bottom: 20px; background: white; border-radius: 50%; padding: 10px; }}
    .team-title {{ font-family: 'Bebas Neue', sans-serif; font-size: 3rem; margin: 0; }}
    .team-content {{ max-width: 800px; margin: 40px auto; padding: 0 20px; font-family: 'Barlow', sans-serif; color: #334155; line-height: 1.6; }}
  </style>
  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    "name": "{nombre_equipo}",
    "memberOf": {{
      "@type": "SportsOrganization",
      "name": "Copa Cajamarca",
      "url": "https://copacajamarca.com"
    }}{logo_schema}
  }}
  </script>
</head>
<body>
  <div class="team-header">
    {logo_html}
    <h1 class="team-title">{nombre_equipo}</h1>
    <p>Perfil de Competición Oficial - Copa Cajamarca</p>
  </div>
  <div class="team-content">
    <h2>Compromiso con el Fútbol Formativo</h2>
    <p>La institución deportiva <strong>{nombre_equipo}</strong> es parte fundamental del ecosistema de la Copa Cajamarca. Su presencia en nuestro certamen demuestra su compromiso con el roce competitivo interregional, enfrentando a las mejores canteras en un entorno de máxima exigencia y profesionalismo.</p>
    
    <div style="margin-top: 30px; display: flex; gap: 15px; justify-content: center;">
      <a href="/vivo/" style="padding: 12px 24px; background: #d60d0d; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Seguir sus Partidos en Vivo</a>
      <a href="/fixture/" style="padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Revisar Calendario</a>
    </div>
  </div>
</body>
</html>"""

    count = 0
    for equipo in equipos:
        nombre = equipo.get('nombre', '')
        if not nombre:
            continue
            
        slug = slugify(nombre)
        logo = equipo.get('logo_url') or ''
        
        logo_schema = f',\n    "logo": "{logo}"' if logo else ''
        logo_html = f'<img src="{logo}" alt="Logo de {nombre}" class="team-logo">' if logo else ''
        
        html = template.format(
            nombre_equipo=nombre,
            logo_schema=logo_schema,
            logo_html=logo_html
        )
        
        file_path = os.path.join(out_dir, f"{slug}.html")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html)
        count += 1
        
    print(f"Éxito: Se han generado {count} páginas estáticas de equipos.")

if __name__ == '__main__':
    build_pages()
