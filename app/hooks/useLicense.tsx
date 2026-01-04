// ARQUIVO: app/hooks/useLicense.tsx
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface LicenseState {
  licenseId: string | null;
  role: 'gerente' | 'equipe' | 'admin' | null;
  userName: string | null;
  loading: boolean;
}

export function useLicense() {
  const [state, setState] = useState<LicenseState>({
    licenseId: null,
    role: null,
    userName: null,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          // 1. Busca o vínculo do usuário (Idêntico à lógica do Flutter)
          const userDoc = await getDoc(doc(db, "users", user.uid));
          
          if (userDoc.exists()) {
            const { licenseId } = userDoc.data();
            
            // 2. Busca o cargo dentro da licença do cliente
            const clienteDoc = await getDoc(doc(db, "clientes", licenseId));
            const clienteData = clienteDoc.data();
            const userDataInLicense = clienteData?.usuariosPermitidos?.[user.uid];

            setState({
              licenseId,
              role: userDataInLicense?.cargo || 'equipe',
              userName: userDataInLicense?.nome || user.displayName || 'Usuário',
              loading: false,
            });
          } else {
            // Caso seja o dono da licença (Gerente Raiz)
            setState({
              licenseId: user.uid,
              role: 'gerente',
              userName: user.displayName || 'Gerente Master',
              loading: false,
            });
          }
        } catch (error) {
          console.error("Erro na governança de licença:", error);
          setState(prev => ({ ...prev, loading: false }));
        }
      } else {
        setState({ licenseId: null, role: null, userName: null, loading: false });
      }
    });

    return () => unsubscribe();
  }, []);

  return state;
}