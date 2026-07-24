import sqlite3
import pandas as pd
from datetime import datetime
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "excedentes.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Tabela de Lojas da Base
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS lojas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_loja TEXT UNIQUE NOT NULL,
            supervisao TEXT NOT NULL
        )
    """)
    
    # Tabela de Excedentes Registrados
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS excedentes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_loja TEXT NOT NULL,
            supervisao TEXT NOT NULL,
            qtd_excedente INTEGER NOT NULL,
            data_inicio TEXT NOT NULL,
            status TEXT DEFAULT 'Ativo',
            criado_em TEXT NOT NULL
        )
    """)
    
    conn.commit()
    conn.close()

def salvar_lojas_df(df):
    """
    Recebe um DataFrame com colunas para Loja e Supervisão (coluna 2 da base).
    Substitui ou insere as lojas no banco.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    for _, row in df.iterrows():
        nome_loja = str(row['loja']).strip()
        supervisao = str(row['supervisao']).strip()
        if nome_loja and supervisao:
            cursor.execute("""
                INSERT INTO lojas (nome_loja, supervisao)
                VALUES (?, ?)
                ON CONFLICT(nome_loja) DO UPDATE SET supervisao = excluded.supervisao
            """, (nome_loja, supervisao))
            
    conn.commit()
    conn.close()

def obter_lojas():
    conn = get_connection()
    df = pd.read_sql_query("SELECT id, nome_loja, supervisao FROM lojas ORDER BY nome_loja ASC", conn)
    conn.close()
    return df

def obter_supervisoes():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT supervisao FROM lojas WHERE supervisao IS NOT NULL AND supervisao != '' ORDER BY supervisao ASC")
    supervisoes = [row[0] for row in cursor.fetchall()]
    conn.close()
    return supervisoes

def cadastrar_excedente(nome_loja, supervisao, qtd_excedente, data_inicio):
    conn = get_connection()
    cursor = conn.cursor()
    criado_em = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute("""
        INSERT INTO excedentes (nome_loja, supervisao, qtd_excedente, data_inicio, status, criado_em)
        VALUES (?, ?, ?, ?, 'Ativo', ?)
    """, (nome_loja, supervisao, qtd_excedente, str(data_inicio), criado_em))
    
    conn.commit()
    conn.close()

def obter_excedentes(supervisao=None, apenas_ativos=True):
    conn = get_connection()
    query = "SELECT * FROM excedentes"
    conditions = []
    params = []
    
    if apenas_ativos:
        conditions.append("status = 'Ativo'")
    if supervisao and supervisao != "Todas":
        conditions.append("supervisao = ?")
        params.append(supervisao)
        
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
        
    query += " ORDER BY data_inicio ASC"
    
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    return df

def encerrar_excedente(id_excedente):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE excedentes SET status = 'Resolvido' WHERE id = ?", (id_excedente,))
    conn.commit()
    conn.close()

def excluir_excedente(id_excedente):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM excedentes WHERE id = ?", (id_excedente,))
    conn.commit()
    conn.close()

def atualizar_qtd_excedente(id_excedente, nova_qtd):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE excedentes SET qtd_excedente = ? WHERE id = ?", (nova_qtd, id_excedente))
    conn.commit()
    conn.close()

