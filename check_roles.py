import requests
from collections import Counter

URL = "https://uzyqpruqiqubwnqttnwf.supabase.co"
KEY = "sb_publishable_Li44BS4jk6I75zEFc05B1Q_NbBcuoPB"
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
}

res = requests.get(f"{URL}/rest/v1/personas?select=rol", headers=HEADERS)
data = res.json()
print(Counter([d.get('rol') for d in data]))
