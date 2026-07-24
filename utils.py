import pandas as pd
from datetime import datetime, date

def processar_base_excel(file_stream, filename):
    """
    Processa o arquivo Excel ou CSV vindo de upload web.
    Garante que a 2ª coluna seja a Supervisão e a 1ª seja a Loja.
    """
    try:
        if filename.lower().endswith('.csv'):
            df = pd.read_csv(file_stream)
        else:
            df = pd.read_excel(file_stream)
            
        if df.shape[1] < 2:
            return None, "O arquivo precisa ter pelo menos 2 colunas (Coluna 1: Loja, Coluna 2: Supervisão)."
            
        col_loja = df.columns[0]
        col_supervisao = df.columns[1]
        
        df_normalizado = pd.DataFrame({
            'loja': df[col_loja].astype(str).str.strip(),
            'supervisao': df[col_supervisao].astype(str).str.strip()
        })
        
        # Remove valores nulos e vazios
        df_normalizado = df_normalizado.dropna(subset=['loja', 'supervisao'])
        df_normalizado = df_normalizado[(df_normalizado['loja'] != 'nan') & (df_normalizado['loja'] != '')]
        df_normalizado = df_normalizado[(df_normalizado['supervisao'] != 'nan') & (df_normalizado['supervisao'] != '')]
        
        return df_normalizado, None
    except Exception as e:
        return None, f"Erro ao ler arquivo: {str(e)}"

def calcular_tempo_excedente(data_inicio_str):
    """
    Calcula os dias decorridos desde data_inicio_str até a data atual.
    """
    if not data_inicio_str:
        return 0, "0 dias", "rec"
        
    try:
        if isinstance(data_inicio_str, (datetime, date)):
            data_inicio = data_inicio_str
        else:
            data_inicio = datetime.strptime(str(data_inicio_str)[:10], "%Y-%m-%d").date()
            
        hoje = date.today()
        dias = (hoje - data_inicio).days
        if dias < 0:
            dias = 0
            
        if dias < 30:
            badge_type = "rec"
            categoria = "Recente (<30d)"
        elif dias <= 60:
            badge_type = "atn"
            categoria = "Atenção (30-60d)"
        else:
            badge_type = "crt"
            categoria = "Crítico (>60d)"
            
        if dias >= 30:
            meses = dias // 30
            dias_resto = dias % 30
            if meses == 1:
                tempo_str = f"1 mês e {dias_resto} dias ({dias}d)"
            else:
                tempo_str = f"{meses} meses e {dias_resto} dias ({dias}d)"
        else:
            tempo_str = f"{dias} dias"
            
        return dias, tempo_str, badge_type
    except Exception:
        return 0, "Data inválida", "rec"
