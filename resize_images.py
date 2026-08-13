import os
from PIL import Image

input_dir = '/home/jair/copacajamarca/fotos_dnis'
for file in os.listdir(input_dir):
    if file.endswith('.jpg'):
        filepath = os.path.join(input_dir, file)
        try:
            with Image.open(filepath) as img:
                img = img.convert('RGB')
                # Resize to max width/height of 500px, keeping aspect ratio
                img.thumbnail((500, 500), Image.Resampling.LANCZOS)
                img.save(filepath, 'JPEG', quality=85)
        except Exception as e:
            print(f"Error procesando {file}: {e}")
print("Redimensionado de fotos completado.")
