from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import database as db
import utils
import os
import io
from datetime import datetime

app = Flask(__name__)
db.init_db()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/lojas", methods=["GET"])
def get_lojas(): 
    df_lojas = db.obter_lojas()
    supervisoes = db.obter_supervisoes()
    return jsonify({
        "lojas": df_lojas.to_dict(orient="records"),
        "supervisoes": supervisoes
    })

@app.route("/api/excedentes", methods=["GET"])
def get_excedentes():
    supervisao = request.args.get("supervisao", "Todas")
    df = db.obter_excedentes(supervisao=supervisao, apenas_ativos=True)
    
    records = []
    if not df.empty:
        for _, row in df.iterrows():
            dias, tempo_fmt, badge = utils.calcular_tempo_excedente(row['data_inicio'])
            rec = row.to_dict()
            rec['dias_decorridos'] = dias
            rec['tempo_formatado'] = tempo_fmt
            rec['badge_status'] = badge
            records.append(rec)
            
    # KPIs
    total_excedentes = sum(r['qtd_excedente'] for r in records)
    lojas_afetadas = len(records)
    media_dias = round(sum(r['dias_decorridos'] for r in records) / len(records), 1) if records else 0
    supervisoes_afetadas = len(set(r['supervisao'] for r in records))
    
    # Dados para Gráfico 1: Top Lojas (Bar Chart)
    top_lojas = sorted(records, key=lambda x: x['qtd_excedente'], reverse=True)[:8]
    chart_bar = {
        "categories": [r['nome_loja'] for r in top_lojas],
        "series": [r['qtd_excedente'] for r in top_lojas]
    }
    
    # Dados para Gráfico 2: Excedente por Supervisão (Donut Chart)
    sup_map = {}
    for r in records:
        sup = r['supervisao']
        sup_map[sup] = sup_map.get(sup, 0) + r['qtd_excedente']
        
    chart_pie = {
        "labels": list(sup_map.keys()),
        "series": list(sup_map.values())
    }
    
    # Dados para Gráfico 3: Permanência em Dias (Smooth Area Line Chart)
    records_sorted_time = sorted(records, key=lambda x: x['dias_decorridos'])
    chart_line = {
        "categories": [r['nome_loja'] for r in records_sorted_time],
        "series": [r['dias_decorridos'] for r in records_sorted_time]
    }

    return jsonify({
        "records": records,
        "kpis": {
            "total_excedentes": total_excedentes,
            "lojas_afetadas": lojas_afetadas,
            "media_dias": media_dias,
            "supervisoes_afetadas": supervisoes_afetadas
        },
        "charts": {
            "bar": chart_bar,
            "pie": chart_pie,
            "line": chart_line
        }
    })

@app.route("/api/upload-base", methods=["POST"])
def upload_base():
    if "file" not in request.files:
        return jsonify({"success": False, "message": "Nenhum arquivo enviado."}), 400
        
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "message": "Nome de arquivo inválido."}), 400
        
    df_normalizado, erro = utils.processar_base_excel(file.stream, file.filename)
    if erro:
        return jsonify({"success": False, "message": erro}), 400
        
    db.salvar_lojas_df(df_normalizado)
    return jsonify({
        "success": True,
        "message": f"Base atualizada! {len(df_normalizado)} lojas importadas com sucesso.",
        "count": len(df_normalizado)
    })

@app.route("/api/cadastrar-excedente", methods=["POST"])
def cadastrar_excedente():
    data = request.json or {}
    nome_loja = data.get("nome_loja")
    qtd_excedente = data.get("qtd_excedente")
    data_inicio = data.get("data_inicio")
    
    if not nome_loja or not qtd_excedente or not data_inicio:
        return jsonify({"success": False, "message": "Preencha todos os campos obrigatórios."}), 400
        
    df_lojas = db.obter_lojas()
    match = df_lojas[df_lojas["nome_loja"] == nome_loja]
    if match.empty:
        return jsonify({"success": False, "message": "Loja não encontrada na base."}), 400
        
    supervisao = match.iloc[0]["supervisao"]
    db.cadastrar_excedente(nome_loja, supervisao, int(qtd_excedente), data_inicio)
    
    return jsonify({"success": True, "message": "Excedente cadastrado com sucesso!"})

@app.route("/api/excedentes/<int:id_excedente>/resolve", methods=["POST"])
def resolver_excedente(id_excedente):
    db.encerrar_excedente(id_excedente)
    return jsonify({"success": True, "message": "Excedente resolvido com sucesso!"})

@app.route("/api/excedentes/<int:id_excedente>", methods=["DELETE"])
def deletar_excedente(id_excedente):
    db.excluir_excedente(id_excedente)
    return jsonify({"success": True, "message": "Registro excluído com sucesso!"})

@app.route("/api/excedentes/<int:id_excedente>/editar", methods=["POST", "PUT"])
def editar_excedente(id_excedente):
    data = request.json or {}
    qtd_excedente = data.get("qtd_excedente")
    if qtd_excedente is None or int(qtd_excedente) < 1:
        return jsonify({"success": False, "message": "Quantidade deve ser de pelo menos 1."}), 400
    
    db.atualizar_qtd_excedente(id_excedente, int(qtd_excedente))
    return jsonify({"success": True, "message": "Quantidade de excedente atualizada com sucesso!"})

@app.route("/api/exportar-excedentes", methods=["GET"])
def exportar_excedentes():
    supervisao = request.args.get("supervisao", "Todas")
    df = db.obter_excedentes(supervisao=supervisao, apenas_ativos=True)
    
    records = []
    if not df.empty:
        for _, row in df.iterrows():
            dias, tempo_fmt, badge = utils.calcular_tempo_excedente(row['data_inicio'])
            status_map = {"rec": "Recente", "atn": "Atenção", "crt": "Crítico"}
            rec = {
                "Status": status_map.get(badge, "Recente"),
                "Loja": row['nome_loja'],
                "Supervisão": row['supervisao'],
                "Quantidade Excedente": row['qtd_excedente'],
                "Data Inicial": row['data_inicio'],
                "Tempo Decorrido": tempo_fmt,
                "Dias Decorridos": dias
            }
            records.append(rec)
            
    df_export = pd.DataFrame(records if records else [{
        "Status": "", "Loja": "", "Supervisão": "", "Quantidade Excedente": "", "Data Inicial": "", "Tempo Decorrido": "", "Dias Decorridos": ""
    }])
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_export.to_excel(writer, index=False, sheet_name='Excedentes')
        
    output.seek(0)
    
    filename = f"Relatorio_Excedentes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename
    )

if __name__ == "__main__":

    app.run(debug=True, host="0.0.0.0", port=5000)
