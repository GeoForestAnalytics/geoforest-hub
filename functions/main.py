from firebase_functions import firestore_fn
from firebase_admin import initialize_app, firestore
import math

# Inicializa o SDK do Firebase Admin
initialize_app()

# -----------------------------------------------------------------------------
# FUNÇÃO: ATUALIZAR PROGRESSO DO PROJETO (BARRA DE %)
# Dispara quando o técnico sincroniza uma parcela de inventário no Flutter.
# Esta função atualiza os contadores no documento do projeto para o Next.js.
# -----------------------------------------------------------------------------
@firestore_fn.on_document_written(
    document="clientes/{uid}/dados_coleta/{parcelaId}",
    region="southamerica-east1"
)
def atualizar_progresso_projeto(event: firestore_fn.Event[firestore_fn.Change[firestore_fn.DocumentSnapshot]]):
    db = firestore.client()
    uid = event.params["uid"]

    # 1. Tenta pegar os dados do documento (após a escrita ou antes da deleção)
    dados = event.data.after.to_dict() or event.data.before.to_dict()
    if not dados:
        return

    # 2. Identifica o projeto vinculado àquela parcela
    proj_id = str(dados.get("projetoId"))
    if proj_id == "None":
        print("Aviso: Parcela sem projetoId. Progresso não atualizado.")
        return

    # 3. Busca todas as parcelas pertencentes a este projeto
    coletas_ref = db.collection("clientes").document(uid).collection("dados_coleta")
    
    # Tratamento para ID que pode vir como número ou texto do Flutter
    try:
        id_filtro = int(proj_id)
    except ValueError:
        id_filtro = proj_id

    # Busca as parcelas do projeto
    query_parcelas = coletas_ref.where("projetoId", "==", id_filtro).get()
    
    total = len(query_parcelas)
    concluidas = 0

    for p in query_parcelas:
        p_data = p.to_dict()
        status = str(p_data.get("status", "")).lower()
        # Consideramos concluído se o status for 'concluida', 'concluido' ou 'exportada'
        if status in ["concluida", "exportada", "concluido"]:
            concluidas += 1

    # 4. Atualiza o documento principal do projeto com os novos números
    # Isso faz com que a barra de progresso no Next.js atualize em tempo real
    proj_ref = db.collection("clientes").document(uid).collection("projetos").document(proj_id)
    
    try:
        proj_ref.update({
            "totalTalhoes": total,
            "talhoesConcluidos": concluidas
        })
        print(f"Sucesso: Projeto {proj_id} atualizado para {concluidas}/{total} parcelas.")
    except Exception as e:
        print(f"Erro ao atualizar documento do projeto: {str(e)}")

# -----------------------------------------------------------------------------
# OBSERVAÇÃO: A função de processamento pesado de volumes (polinomial) foi 
# removida para garantir a integridade técnica do sistema nesta fase.
# -----------------------------------------------------------------------------