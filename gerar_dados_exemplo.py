import pandas as pd
import database as db

# Dados de Exemplo
lojas_data = [
    {"Loja": "Loja 101 - Centro SP", "Supervisao": "Supervisão SP Capital"},
    {"Loja": "Loja 102 - Moema", "Supervisao": "Supervisão SP Capital"},
    {"Loja": "Loja 103 - Pinheiros", "Supervisao": "Supervisão SP Capital"},
    {"Loja": "Loja 201 - Campinas Centro", "Supervisao": "Supervisão SP Interior"},
    {"Loja": "Loja 202 - Ribeirão Preto", "Supervisao": "Supervisão SP Interior"},
    {"Loja": "Loja 203 - Sorocaba", "Supervisao": "Supervisão SP Interior"},
    {"Loja": "Loja 301 - Niterói", "Supervisao": "Supervisão Rio de Janeiro"},
    {"Loja": "Loja 302 - Copacabana", "Supervisao": "Supervisão Rio de Janeiro"},
    {"Loja": "Loja 303 - Barra da Tijuca", "Supervisao": "Supervisão Rio de Janeiro"},
    {"Loja": "Loja 401 - BH Savassi", "Supervisao": "Supervisão Minas Gerais"},
    {"Loja": "Loja 402 - Uberlândia", "Supervisao": "Supervisão Minas Gerais"},
    {"Loja": "Loja 501 - Curitiba Batel", "Supervisao": "Supervisão Sul"},
    {"Loja": "Loja 502 - Florianópolis Centro", "Supervisao": "Supervisão Sul"},
]

def main():
    print("Inicializando banco de dados...")
    db.init_db()
    
    # 1. Salvar na base de dados
    df_base = pd.DataFrame(lojas_data)
    df_base_renomeada = pd.DataFrame({
        'loja': df_base['Loja'],
        'supervisao': df_base['Supervisao']
    })
    db.salvar_lojas_df(df_base_renomeada)
    print(f"[OK] {len(df_base)} lojas inseridas no banco de dados!")
    
    # 2. Gerar arquivo Excel de exemplo
    excel_path = "base_lojas_exemplo.xlsx"
    df_base.to_excel(excel_path, index=False)
    print(f"[OK] Arquivo Excel de exemplo criado em '{excel_path}'")
    
    # 3. Inserir alguns registros de teste de excedentes
    excedentes_teste = [
        ("Loja 101 - Centro SP", "Supervisão SP Capital", 3, "2026-05-10"),
        ("Loja 103 - Pinheiros", "Supervisão SP Capital", 1, "2026-07-01"),
        ("Loja 201 - Campinas Centro", "Supervisão SP Interior", 5, "2026-04-15"),
        ("Loja 302 - Copacabana", "Supervisão Rio de Janeiro", 2, "2026-06-20"),
        ("Loja 401 - BH Savassi", "Supervisão Minas Gerais", 4, "2026-05-28"),
        ("Loja 501 - Curitiba Batel", "Supervisão Sul", 2, "2026-07-10")
    ]
    
    for nome, sup, qtd, dt in excedentes_teste:
        db.cadastrar_excedente(nome, sup, qtd, dt)
        
    print("[OK] Registros de teste de excedentes criados com sucesso!")


if __name__ == "__main__":
    main()
