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
    """ d/D = b0 + b1*h_rel + b2*h_rel**2 + ... """
    return b0 + b1*h_rel + b2*h_rel**2 + b3*h_rel**3 + b4*h_rel**4 + b5*h_rel**5

def area_transversal_ponto(h_rel, b0, b1, b2, b3, b4, b5, DAP):
    """ Calcula a área seccional (m2) em um ponto relativo da altura """
    d_rel = modelo_polinomial_5(h_rel, b0, b1, b2, b3, b4, b5)
    diametro_real_cm = d_rel * DAP
    return (np.pi / 40000) * (diametro_real_cm**2)

# -----------------------------------------------------------------------------
# MOTOR DE PROCESSAMENTO
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

    estratos_config = config.get("estratos", [])
    resultados_globais = []

    for est in estratos_config:
        nome_estrato = est.get("nome")
        talhoes_ids = est.get("talhoesIds", [])
        h_toco_config = float(est.get("hToco", 0.10))
        
        # Pega a lista dinâmica de sortimentos (Ex: Serraria, Celulose, etc)
        # Ordenamos do maior diâmetro para o menor para a lógica de classificação
        lista_sortimentos = sorted(est.get("sortimentos", []), key=lambda x: x['min'], reverse=True)

        # --- ETAPA A: CALIBRAÇÃO DO POLINÔMIO VIA CUBAGEM ---
        cubagem_df_list = []
        for t_id in talhoes_ids:
            cub_query = db.collection("clientes").document(uid).collection("dados_cubagem")\
                          .where("talhaoId", "in", [t_id, int(t_id)]).get()
            
            for tree_doc in cub_query:
                tree = tree_doc.to_dict()
                if tree.get('alturaTotal', 0) == 0: continue
                
                secoes = tree_doc.reference.collection("secoes").get()
                for s_doc in secoes:
                    s = s_doc.to_dict()
                    cubagem_df_list.append({
                        "dap": float(tree['valorCAP']) / np.pi,
                        "ht": float(tree['alturaTotal']),
                        "d_sec": float(s['circunferencia']) / np.pi,
                        "h_sec": float(s['alturaMedicao'])
                    })

        if len(cubagem_df_list) >= 10:
            df_cub = pd.DataFrame(cubagem_df_list)
            p = np.polyfit(df_cub['h_sec'] / df_cub['ht'], df_cub['d_sec'] / df_cub['dap'], 5)
            coefs = p[::-1] # Inverte para b0, b1, b2, b3, b4, b5
        else:
            # Fallback (Coeficientes padrão se não houver cubagem suficiente)
            coefs = [0.98, -0.5, 0.2, -1.5, 1.2, -0.4]

        # --- ETAPA B: APLICAR MODELO NO INVENTÁRIO (BIG DATA) ---
        volumes_parcelas_ha = []
        # Inicializa dicionário de volumes por sortimento + toco e ponteira
        acumulado_estrato = {s['nome']: 0.0 for s in lista_sortimentos}
        acumulado_estrato['Resíduo (Ponteira)'] = 0.0
        acumulado_estrato['Toco'] = 0.0
        
        total_arvores = 0

        for t_id in talhoes_ids:
            parcelas = db.collection("clientes").document(uid).collection("dados_coleta")\
                         .where("talhaoId", "in", [t_id, int(t_id)]).get()
            
            for p_doc in parcelas:
                p_data = p_doc.data()
                area_m2 = float(p_data.get('areaMetrosQuadrados', 400)) or 400
                vol_parcela_m3 = 0
                
                arvores_inv = p_doc.reference.collection("arvores").get()
                for a_doc in arvores_inv:
                    a = a_doc.to_dict()
                    cap = float(a.get('cap', 0))
                    if cap <= 5: continue # Ignora falhas ou mortas
                    
                    dap = cap / np.pi
                    ht = float(a.get('altura', 25))
                    total_arvores += 1

                    # 1. Volume do Toco (Cilindro na base)
                    vol_toco = area_transversal_ponto(0, *coefs, dap) * h_toco_config
                    acumulado_estrato['Toco'] += vol_toco
                    vol_parcela_m3 += vol_toco

                    # 2. Fatiamento e Integração (Do toco até o topo)
                    passo = 0.02 # Fatias de 2% da altura para balanço entre velocidade e precisão
                    for h_rel in np.arange(h_toco_config/ht, 1.0, passo):
                        # Diâmetro no início da fatia
                        d_ponto = modelo_polinomial_5(h_rel, *coefs) * dap
                        
                        # Integração da fatia
                        v_fatia = quad(area_transversal_ponto, h_rel, min(h_rel + passo, 1.0), 
                                       args=(*coefs, dap))[0] * ht
                        
                        vol_parcela_m3 += v_fatia

                        # Classificação dinâmica nos sortimentos
                        foi_alocado = False
                        for s in lista_sortimentos:
                            if d_ponto >= s['min']:
                                acumulado_estrato[s['nome']] += v_fatia
                                foi_alocado = True
                                break
                        
                        if not foi_alocado:
                            acumulado_estrato['Resíduo (Ponteira)'] += v_fatia

                volumes_parcelas_ha.append((vol_parcela_m3 / area_m2) * 10000)

        # --- ETAPA C: ESTATÍSTICA ---
        n = len(volumes_parcelas_ha)
        if n > 1:
            media_ha = np.mean(volumes_parcelas_ha)
            erro_padrao = np.std(volumes_parcelas_ha, ddof=1) / np.sqrt(n)
            t_critico = t.ppf(1 - 0.025, n - 1)
            erro_relativo = ((t_critico * erro_padrao) / media_ha) * 100 if media_ha > 0 else 0
        else:
            media_ha, erro_relativo = 0, 0

        # Arredondamentos para o JSON final
        resultados_globais.append({
            "estrato": nome_estrato,
            "volume_medio_ha": round(media_ha, 2),
            "erro_amostragem_perc": round(erro_relativo, 2),
            "n_amostras": n,
            "arvores_processadas": total_arvores,
            "sortimentos": {k: round(v, 2) for k, v in acumulado_estrato.items()},
            "coeficientes": [round(c, 8) for c in coefs]
        })

    # FINALIZAÇÃO
    event.data.reference.update({
        "status": "concluido",
        "resultados": resultados_globais,
        "finalizado_em": firestore.SERVER_TIMESTAMP
    })
    print(f"Processamento {event.params['procId']} finalizado com sucesso.")