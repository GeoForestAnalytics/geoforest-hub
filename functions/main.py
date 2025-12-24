from firebase_functions import firestore_fn
from firebase_admin import initialize_app, firestore
import numpy as np
import math

# Inicializa o SDK do Firebase
initialize_app()

# -----------------------------------------------------------------------------
# FUNÇÃO 1: CÁLCULO DE AFILAMENTO (TAPER)
# Dispara quando o técnico sincroniza uma árvore de cubagem no Flutter
# -----------------------------------------------------------------------------
@firestore_fn.on_document_written(
    document="clientes/{uid}/dados_cubagem/{treeId}",
    region="southamerica-east1"
)
def calcular_taper_polinomial(event: firestore_fn.Event[firestore_fn.Change[firestore_fn.DocumentSnapshot]]):
    db = firestore.client()
    
    # 1. Pega os dados da árvore após a sincronização
    dados_arvore = event.data.after.to_dict()
    if not dados_arvore or dados_arvore.get('alturaTotal', 0) == 0:
        return # Árvore ainda não foi medida ou foi deletada

    # 2. O Flutter salva as seções em uma subcoleção. Precisamos buscá-las.
    secoes_ref = event.data.after.reference.collection("secoes")
    secoes_docs = secoes_ref.get()

    h_lista = []
    d_lista = []

    for doc in secoes_docs:
        s = doc.to_dict()
        h_medido = s.get('alturaMedicao')
        circ = s.get('circunferencia')
        
        if h_medido is not None and circ is not None:
            h_lista.append(float(h_medido))
            # Converte circunferência para diâmetro (d = c / pi)
            d_lista.append(float(circ) / math.pi)

    # 3. Validação técnica: Polinômio de 5º grau exige 6 pontos
    if len(h_lista) < 6:
        print(f"Dados insuficientes para taper na árvore {event.params['treeId']}")
        return

    try:
        # 4. Cálculo Estatístico (NumPy)
        h = np.array(h_lista)
        d = np.array(d_lista)
        coefs = np.polyfit(h, d, 5) # Gera [b5, b4, b3, b2, b1, b0]

        # 5. Onde salvar? Precisamos do projetoId. 
        # O seu Flutter salva o talhaoId na árvore de cubagem.
        talhao_id = dados_arvore.get('talhaoId')
        uid = event.params["uid"]
        
        # Busca o projetoId através do talhão para saber onde o Next.js está olhando
        talhao_doc = db.collection("clientes").document(uid).collection("talhoes").document(str(talhao_id)).get()
        
        if talhao_doc.exists:
            proj_id = str(talhao_doc.to_dict().get('projetoId'))
            
            # Salva o resultado final para o Next.js exibir o gráfico
            stats_ref = db.collection("clientes").document(uid).collection("projetos").document(proj_id).collection("estatisticas").document("taper")
            
            stats_ref.set({
                "coeficientes": coefs.tolist(),
                "ultima_atualizacao": firestore.SERVER_TIMESTAMP,
                "arvore_origem": dados_arvore.get('identificador')
            })
            print(f"Sucesso! Taper calculado para o projeto {proj_id}")

    except Exception as e:
        print(f"Erro no processamento: {str(e)}")


# -----------------------------------------------------------------------------
# FUNÇÃO 2: PROGRESSO DO PROJETO (BARRA DE %)
# Dispara quando o técnico sincroniza uma parcela de inventário no Flutter
# -----------------------------------------------------------------------------
@firestore_fn.on_document_written(
    document="clientes/{uid}/dados_coleta/{parcelaId}",
    region="southamerica-east1"
)
def atualizar_progresso_projeto(event: firestore_fn.Event[firestore_fn.Change[firestore_fn.DocumentSnapshot]]):
    db = firestore.client()
    uid = event.params["uid"]

    # 1. Pega os dados da parcela sincronizada
    dados = event.data.after.to_dict() or event.data.before.to_dict()
    if not dados: return

    proj_id = str(dados.get("projetoId"))
    if proj_id == "None": return

    # 2. Conta no banco de dados todas as parcelas desse projeto
    coletas_ref = db.collection("clientes").document(uid).collection("dados_coleta")
    
    # Filtra por projeto (o Flutter pode mandar como int ou string, tratamos ambos)
    try:
        id_filtro = int(proj_id)
    except:
        id_filtro = proj_id

    todas_as_parcelas = coletas_ref.where("projetoId", "==", id_filtro).get()
    
    total = len(todas_as_parcelas)
    concluidas = 0

    for p in todas_as_parcelas:
        p_data = p.to_dict()
        status = str(p_data.get("status", "")).lower()
        # Se estiver concluída ou exportada, contamos como concluída para a barra
        if status in ["concluida", "exportada", "concluido"]:
            concluidas += 1

    # 3. Grava o resultado no documento do projeto para o Next.js atualizar a barra
    proj_ref = db.collection("clientes").document(uid).collection("projetos").document(proj_id)
    
    proj_ref.update({
        "totalTalhoes": total,
        "talhoesConcluidos": concluidas
    })

    print(f"Barra de Progresso atualizada: Projeto {proj_id} agora está com {concluidas}/{total}")