// ARQUIVO: app/hooks/useAuthContext.tsx
"use client"
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface LicenseState {
  licenseId: string | null;
  role: 'gerente' | 'equipe' | 'admin' | null;
  userName: string | null;
  userId: string | null;
  loading: boolean;
}

export function useLicense() {
  const [state, setState] = useState<LicenseState>({
    licenseId: null,
    role: null,
    userName: null,
    userId: null,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          // 1. Busca o documento do usuário para achar o licenseId
          const userDoc = await getDoc(doc(db, "users", user.uid));
          
          let currentLicenseId = user.uid; // Fallback se for o dono
          let currentRole: any = 'gerente';
          let currentName = user.displayName || "Gestor";

          if (userDoc.exists()) {
            const userData = userDoc.data();
            currentLicenseId = userData.licenseId;

            // 2. Busca na coleção 'clientes' os dados detalhados da equipe (IGUAL AO FLUTTER)
            const clienteDoc = await getDoc(doc(db, "clientes", currentLicenseId));
            if (clienteDoc.exists()) {
              const clienteData = clienteDoc.data();
              // Verifica se o usuário logado está no mapa de usuários permitidos
              const myMemberData = clienteData.usuariosPermitidos?.[user.uid];
              
              if (myMemberData) {
                currentRole = myMemberData.cargo || 'equipe';
                currentName = myMemberData.nome || currentName;
              }
            }
          }

          setState({
            licenseId: currentLicenseId,
            role: currentRole,
            userName: currentName,
            userId: user.uid,
            loading: false,
          });
        } catch (error) {
          console.error("Erro ao carregar governança do usuário:", error);
          setState(prev => ({ ...prev, loading: false }));
        }
      } else {
        setState({ licenseId: null, role: null, userName: null, userId: null, loading: false });
      }
    });

    return () => unsubscribe();
  }, []);

  return state;
}