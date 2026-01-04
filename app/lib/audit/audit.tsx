// ARQUIVO: app/lib/audit/audit.tsx (ou .ts)
import { db } from "../firebase"; // Ajustado para apontar para o arquivo firebase.ts
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export type AuditAction = 
  | 'EXCLUSAO_PROJETO' 
  | 'ALTERACAO_DADO_TECNICO' 
  | 'FECHAMENTO_NOTAFISCAL' 
  | 'MANUTENCAO_VEICULO' 
  | 'LOGIN_HUB';

/**
 * Registra uma ação importante no banco de dados para auditoria futura.
 */
export const registerLog = async (
  licenseId: string, 
  userId: string, 
  userName: string,
  action: AuditAction, 
  details: string
) => {
  if (!licenseId || !db) return; // Proteção profissional para não quebrar se o db não carregar

  try {
    await addDoc(collection(db, `clientes/${licenseId}/audit_logs`), {
      timestamp: serverTimestamp(),
      userId,
      userName,
      action,
      details,
      platform: 'WEB_HUB'
    });
  } catch (e) {
    console.error("Falha ao registrar log de auditoria:", e);
  }
};