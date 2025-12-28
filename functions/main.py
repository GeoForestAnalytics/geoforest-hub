from firebase_functions import firestore_fn
from firebase_admin import initialize_app, firestore
import numpy as np
import pandas as pd
from scipy.integrate import quad
from scipy.stats import t
import math

# Inicializa o SDK do Firebase Admin
initialize_app()

# -----------------------------------------------------------------------------
# FUNÇÕES MATEMÁTICAS AUXILIARES
# -----------------------------------------------------------------------------

def modelo_polinomial_5(h_rel, b0, b1, b2, b3, b4, b5):
    """
    Calcula o d/D (diâmetro relativo) para uma altura relativa (h/H) 
    usando o polinômio de 5º grau (Schöepfer).
    """
    return b0 + b1*h_rel + b2*h_rel**2 + b3*h_rel**3 + b4*h_rel**4 + b5*h_rel**5

def area_transversal_ponto(h_rel, b0, b1, b2, b3, b4, b5, DAP):
    """
    Calcula a área seccional (m²) em um ponto específico da árvore.
    """
    # d_rel = d/D -> d = d_rel * DAP
    d_rel = modelo_polinomial_5(h_rel, b0, b1, b2, b3, b4, b5)
    diametro_real_cm = d_rel * DAP
    # Área (m2) = (pi * d^2) / 40000 (divisão por 40k pq d está em cm)
    return (np.pi / 40000) * (diametro_real_cm**2)

# -----------------------------------------------------------------------------
# MOTOR PRINCIPAL: PROCESSAMENTO BIG DATA
# -----------------------------------------------------------------------------

@firestore_fn.on_document_created(
    document="clientes/{uid}/processamentos/{procId}",
    region="southamerica-east1"
)
def processar_inventario_big_data(event: firestore_fn.Event[firestore_fn.DocumentSnapshot]):
    db = firestore.client()
    uid = event.params["uid"]
    config = event.data.to_dict()
    
    if not config:
        return

    # 1. Definições enviadas pelo Next.js
    estratos_config = config.get("estratos", [])
    resultados_globais = []

    for est in estratos_config:
        estrato_id = est.get("id")
        nome_estrato = est.get("nome")
        talhoes_ids = est.get("talhoesIds", [])
        
        # Limites de sortimento (cm)
        min_serraria = float(est.get("limiteSerraria", 25))
        min_celulose = float(est.get("limiteCelulose", 8))

        # --- ETAPA A: BUSCAR DADOS DE CUBAGEM (PARA CALIBRAR O POLINÔMIO) ---
        cubagem_df_list = []
        for t_id in talhoes_ids:
            # Busca cubagens do talhão (Firestore query)
            cub_query = db.collection("clientes").document(uid).collection("dados_cubagem")\
                          .where("talhaoId", "in", [t_id, int(t_id)]).get()
            
            for tree_doc in cub_query:
                tree = tree_doc.to_dict()
                if tree.get('alturaTotal', 0) == 0: continue
                
                # Busca subcoleção 'secoes'
                secoes = tree_doc.reference.collection("secoes").get()
                for s_doc in secoes:
                    s = s_doc.to_dict()
                    cubagem_df_list.append({
                        "dap": float(tree['valorCAP']) / np.pi,
                        "ht": float(tree['alturaTotal']),
                        "d_sec": float(s['circunferencia']) / np.pi,
                        "h_sec": float(s['alturaMedicao'])
                    })

        # Se não houver cubagem, usa coeficientes padrão (Fallback)
        if len(cubagem_df_list) >= 10:
            df_cub = pd.DataFrame(cubagem_df_list)
            x = df_cub['h_sec'] / df_cub['ht']
            y = df_cub['d_sec'] / df_cub['dap']
            # b5, b4, b3, b2, b1, b0
            p = np.polyfit(x, y, 5)
            # Reverter para b0, b1, b2, b3, b4, b5
            coefs = p[::-1] 
        else:
            # Coeficientes genéricos caso não tenha cubagem suficiente
            coefs = [0.98, -0.5, 0.2, -1.5, 1.2, -0.4]

        # --- ETAPA B: PROCESSAR INVENTÁRIO (APLICAR MODELO) ---
        lista_volumes_parcelas_ha = []
        soma_serraria = 0
        soma_celulose = 0
        soma_residuo = 0
        total_arvores_processadas = 0

        for t_id in talhoes_ids:
            parcelas_query = db.collection("clientes").document(uid).collection("dados_coleta")\
                               .where("talhaoId", "in", [t_id, int(t_id)]).get()
            
            for p_doc in parcelas_query:
                p_data = p_doc.data()
                area_m2 = float(p_data.get('areaMetrosQuadrados', 400))
                if area_m2 == 0: area_m2 = 400
                
                volume_parcela_m3 = 0
                
                # Busca subcoleção 'arvores'
                arvores_inv = p_doc.reference.collection("arvores").get()
                for a_doc in arvores_inv:
                    a = a_doc.to_dict()
                    cap = float(a.get('cap', 0))
                    if cap <= 0: continue
                    
                    dap = cap / np.pi
                    ht = float(a.get('altura', 25)) # Média se não houver ht
                    
                    # 1. Integração para Volume Total
                    v_total_unit, _ = quad(area_transversal_ponto, 0, 1, 
                                           args=(coefs[0], coefs[1], coefs[2], coefs[3], coefs[4], coefs[5], dap))
                    v_tree = v_total_unit * ht
                    volume_parcela_m3 += v_tree
                    total_arvores_processadas += 1

                    # 2. Fatiamento por Sortimento (Integração em fatias de 10cm)
                    passo = 0.01 # 1% da altura por vez
                    for h_rel in np.arange(0, 1, passo):
                        d_ponto = modelo_polinomial_5(h_rel, *coefs) * dap
                        v_fatia = quad(area_transversal_ponto, h_rel, h_rel + passo, 
                                       args=(*coefs, dap))[0] * ht
                        
                        if d_ponto >= min_serraria:
                            soma_serraria += v_fatia
                        elif d_ponto >= min_celulose:
                            soma_celulose += v_fatia
                        else:
                            soma_residuo += v_fatia

                # Guarda o volume por hectare da parcela para estatística
                lista_volumes_parcelas_ha.append((volume_parcela_m3 / area_m2) * 10000)

        # --- ETAPA C: CÁLCULO DE ESTATÍSTICA DE PRECISÃO (ERRO %) ---
        n = len(lista_volumes_parcelas_ha)
        if n > 1:
            media_ha = np.mean(lista_volumes_parcelas_ha)
            desvio = np.std(lista_volumes_parcelas_ha, ddof=1)
            erro_padrao = desvio / np.sqrt(n)
            # Valor de t para 95% de confiança
            t_critico = t.ppf(1 - 0.025, n - 1)
            erro_absoluto = t_critico * erro_padrao
            erro_relativo_perc = (erro_absoluto / media_ha) * 100 if media_ha > 0 else 0
        else:
            media_ha, erro_relativo_perc = 0, 0

        # Consolidar resultados do estrato
        vol_total_estrato = soma_serraria + soma_celulose + soma_residuo
        resultados_globais.append({
            "estrato": nome_estrato,
            "volume_medio_ha": round(media_ha, 2),
            "volume_total_m3": round(vol_total_estrato, 2),
            "erro_amostragem_perc": round(erro_relativo_perc, 2),
            "n_amostras": n,
            "arvores_processadas": total_arvores_processadas,
            "sortimentos": {
                "serraria": round(soma_serraria, 2),
                "celulose": round(soma_celulose, 2),
                "residuo": round(soma_residuo, 2)
            },
            "coeficientes": [round(c, 8) for c in coefs]
        })

    # 3. ATUALIZAR FIREBASE COM O RELATÓRIO FINAL
    event.data.reference.update({
        "status": "concluido",
        "resultados": resultados_globais,
        "finalizado_em": firestore.SERVER_TIMESTAMP
    })
    print(f"Job {event.params['procId']} finalizado com sucesso.")