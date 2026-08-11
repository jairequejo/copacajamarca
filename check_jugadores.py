import requests

URL = "https://uzyqpruqiqubwnqttnwf.supabase.co"
KEY = "sb_publishable_Li44BS4jk6I75zEFc05B1Q_NbBcuoPB"
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
}

res = requests.get(f"{URL}/rest/v1/personas?rol=eq.JUGADOR&limit=5", headers=HEADERS)
print(res.json())
