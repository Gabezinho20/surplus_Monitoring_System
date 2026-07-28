import requests

sessao = requests.Session()

login = sessao.post(
    "http://10.1.1.93:8000/login/",
    data={
        "username": "gabriel.lopes",
        "password": "Ino.2024"
    }
)

print(login.status_code)

meus_dados = sessao.get("http://10.1.1.93:8000/api/me/")
print(meus_dados.text)